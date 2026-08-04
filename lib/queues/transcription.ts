import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export const TRANSCRIPTION_QUEUE_NAME = "transcription";

export interface TranscriptionJobData {
  meetingId: string;
}

const globalForQueue = globalThis as unknown as {
  transcriptionQueue: Queue<TranscriptionJobData> | undefined;
};

/**
 * La instancia se crea de forma perezosa (no al importar el módulo): el
 * constructor de `Queue` conecta a Redis de inmediato, lo cual rompe el
 * `next build` (que evalúa este módulo para inspeccionar las rutas) cuando
 * no hay Redis disponible en tiempo de build.
 */
function getTranscriptionQueue(): Queue<TranscriptionJobData> {
  if (!globalForQueue.transcriptionQueue) {
    globalForQueue.transcriptionQueue = new Queue<TranscriptionJobData>(
      TRANSCRIPTION_QUEUE_NAME,
      {
        connection: redisConnection,
        defaultJobOptions: {
          // 1 intento inicial + 2 reintentos
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: { age: 60 * 60 * 24 * 7 },
          removeOnFail: { age: 60 * 60 * 24 * 30 },
        },
      },
    );
  }

  return globalForQueue.transcriptionQueue;
}

export async function addTranscriptionJob(meetingId: string) {
  return getTranscriptionQueue().add(
    "transcribe-meeting",
    { meetingId },
    { jobId: `meeting-${meetingId}` },
  );
}
