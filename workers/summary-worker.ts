import { Worker, type Job } from "bullmq";
import { Prisma } from "@prisma/client";

import { redisConnection } from "../lib/redis";
import { SUMMARY_QUEUE_NAME, type SummaryJobData } from "../lib/queues/summary";
import { generateMeetingMinutes, type DiarizedSegment } from "../lib/gemini";
import { prepareTranscriptForSummary } from "../lib/transcript-chunking";
import { notifySummaryReady, notifyTaskAssigned } from "../lib/notifications";
import { prisma } from "../lib/prisma";

async function processSummaryJob(job: Job<SummaryJobData>): Promise<void> {
  const { meetingId } = job.data;

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { transcript: true },
  });

  if (!meeting) {
    throw new Error(
      `[summary-worker] Meeting ${meetingId} no encontrada (job ${job.id}).`,
    );
  }

  if (!meeting.transcript) {
    throw new Error(
      `[summary-worker] Meeting ${meetingId} no tiene transcript (job ${job.id}).`,
    );
  }

  const segments = meeting.transcript.segments as unknown as DiarizedSegment[];

  const transcriptText = await prepareTranscriptForSummary(segments);
  const minutes = await generateMeetingMinutes(transcriptText);

  // Transacción: upsert del Summary + reemplazo completo de sus Tasks, para
  // que un reintento tras un fallo parcial no deje datos duplicados ni
  // inconsistentes.
  const createdTasks = await prisma.$transaction(async (tx) => {
    const summary = await tx.summary.upsert({
      where: { meetingId: meeting.id },
      update: {
        executiveSummary: minutes.executiveSummary,
        keyDecisions: minutes.keyDecisions as unknown as Prisma.InputJsonValue,
      },
      create: {
        meetingId: meeting.id,
        executiveSummary: minutes.executiveSummary,
        keyDecisions: minutes.keyDecisions as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.task.deleteMany({ where: { summaryId: summary.id } });

    if (minutes.tasks.length === 0) return [];

    return tx.task.createManyAndReturn({
      data: minutes.tasks.map((task) => ({
        summaryId: summary.id,
        description: task.description,
        assignee: task.assignee,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
      })),
    });
  });

  await notifySummaryReady(meeting.id);

  for (const task of createdTasks) {
    if (task.assignee) {
      await notifyTaskAssigned(task.id);
    }
  }
}

const worker = new Worker<SummaryJobData>(
  SUMMARY_QUEUE_NAME,
  processSummaryJob,
  { connection: redisConnection, concurrency: 2 },
);

worker.on("completed", (job) => {
  console.log(
    `[summary-worker] Job ${job.id} (meeting ${job.data.meetingId}) completado.`,
  );
});

worker.on("failed", async (job, err) => {
  if (!job) {
    console.error(
      "[summary-worker] Falló un job sin referencia disponible:",
      err,
    );
    return;
  }

  const attemptsMade = job.attemptsMade;
  const maxAttempts = job.opts.attempts ?? 1;

  console.error(
    `[summary-worker] Job ${job.id} (meeting ${job.data.meetingId}) falló ` +
      `(intento ${attemptsMade}/${maxAttempts}):`,
    err,
  );

  const isFinalAttempt = attemptsMade >= maxAttempts;

  if (!isFinalAttempt) {
    console.log(
      `[summary-worker] Se reintentará el job ${job.id} (meeting ${job.data.meetingId}).`,
    );
    return;
  }

  // A diferencia del worker de transcripción, aquí NO se marca el Meeting
  // como FAILED: la grabación y la transcripción ya se completaron
  // exitosamente y siguen siendo útiles aunque falle la generación del
  // acta. Solo se deja constancia en los logs para que quede claro que el
  // acta de esta reunión no se pudo generar.
  console.error(
    `[summary-worker] Job ${job.id} (meeting ${job.data.meetingId}) agotó sus reintentos. ` +
      "El acta no pudo generarse; la transcripción sigue disponible.",
  );
});

worker.on("error", (err) => {
  console.error("[summary-worker] Error del worker:", err);
});

console.log(
  `[summary-worker] Worker de generación de actas escuchando en la cola "${SUMMARY_QUEUE_NAME}"...`,
);

async function shutdown(signal: string) {
  console.log(`[summary-worker] Señal ${signal} recibida. Cerrando worker...`);
  await worker.close();
  console.log("[summary-worker] Worker de generación de actas cerrado.");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
