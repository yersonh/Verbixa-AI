import { Worker, type Job } from "bullmq";
import { Prisma, MeetingSource, MeetingStatus } from "@prisma/client";

import { redisConnection } from "../lib/redis";
import {
  TRANSCRIPTION_QUEUE_NAME,
  type TranscriptionJobData,
} from "../lib/queues/transcription";
import { transcribeRecording, transcribeUploadedFile } from "../lib/deepgram";
import { getSpeakerTimeline } from "../lib/recall";
import { resolveSpeakerNames } from "../lib/speaker-names";
import { addSummaryJob } from "../lib/queues/summary";
import { notifyMeetingFailed, notifyTranscriptReady } from "../lib/notifications";
import { prisma } from "../lib/prisma";

async function processTranscriptionJob(
  job: Job<TranscriptionJobData>,
): Promise<void> {
  const { meetingId } = job.data;

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
  });

  if (!meeting) {
    throw new Error(
      `[transcription-worker] Meeting ${meetingId} no encontrada (job ${job.id}).`,
    );
  }

  if (!meeting.recordingUrl) {
    throw new Error(
      `[transcription-worker] Meeting ${meetingId} no tiene recordingUrl (job ${job.id}).`,
    );
  }

  // Idempotente: se marca como PROCESSING al inicio de cada intento, aunque
  // ya lo esté (p. ej. seteado por el webhook, o por un intento previo).
  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: MeetingStatus.PROCESSING },
  });

  const { rawText, segments: rawSegments } =
    meeting.source === MeetingSource.UPLOAD
      ? await transcribeUploadedFile(meeting.recordingUrl)
      : await transcribeRecording(meeting.recordingUrl);

  // Reemplaza "Speaker 0"/"Speaker 1" por nombres reales de los participantes
  // cuando estén disponibles (best-effort: si Recall no tiene el timeline,
  // o no hay bot asociado, se conservan las etiquetas numéricas).
  const timeline = meeting.recallBotId
    ? await getSpeakerTimeline(meeting.recallBotId).catch((err) => {
        console.error(
          `[transcription-worker] No se pudo obtener el timeline de hablantes (meeting ${meeting.id}):`,
          err,
        );
        return [];
      })
    : [];

  const segments = resolveSpeakerNames(rawSegments, timeline);

  await prisma.transcript.upsert({
    where: { meetingId: meeting.id },
    update: {
      rawText,
      segments: segments as unknown as Prisma.InputJsonValue,
    },
    create: {
      meetingId: meeting.id,
      rawText,
      segments: segments as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: MeetingStatus.COMPLETED },
  });

  await notifyTranscriptReady(meeting.id);
  await addSummaryJob(meeting.id);
}

const worker = new Worker<TranscriptionJobData>(
  TRANSCRIPTION_QUEUE_NAME,
  processTranscriptionJob,
  { connection: redisConnection, concurrency: 2 },
);

worker.on("completed", (job) => {
  console.log(
    `[transcription-worker] Job ${job.id} (meeting ${job.data.meetingId}) completado.`,
  );
});

worker.on("failed", async (job, err) => {
  if (!job) {
    console.error(
      "[transcription-worker] Falló un job sin referencia disponible:",
      err,
    );
    return;
  }

  const attemptsMade = job.attemptsMade;
  const maxAttempts = job.opts.attempts ?? 1;

  console.error(
    `[transcription-worker] Job ${job.id} (meeting ${job.data.meetingId}) falló ` +
      `(intento ${attemptsMade}/${maxAttempts}):`,
    err,
  );

  const isFinalAttempt = attemptsMade >= maxAttempts;

  if (!isFinalAttempt) {
    console.log(
      `[transcription-worker] Se reintentará el job ${job.id} (meeting ${job.data.meetingId}).`,
    );
    return;
  }

  console.error(
    `[transcription-worker] Job ${job.id} (meeting ${job.data.meetingId}) agotó sus reintentos. ` +
      "Marcando meeting como FAILED.",
  );

  try {
    await prisma.meeting.update({
      where: { id: job.data.meetingId },
      data: { status: MeetingStatus.FAILED },
    });
    await notifyMeetingFailed(job.data.meetingId);
  } catch (updateErr) {
    console.error(
      `[transcription-worker] No se pudo marcar meeting ${job.data.meetingId} como FAILED:`,
      updateErr,
    );
  }
});

worker.on("error", (err) => {
  console.error("[transcription-worker] Error del worker:", err);
});

console.log(
  `[transcription-worker] Worker de transcripción escuchando en la cola "${TRANSCRIPTION_QUEUE_NAME}"...`,
);

async function shutdown(signal: string) {
  console.log(
    `[transcription-worker] Señal ${signal} recibida. Cerrando worker...`,
  );
  await worker.close();
  console.log("[transcription-worker] Worker de transcripción cerrado.");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
