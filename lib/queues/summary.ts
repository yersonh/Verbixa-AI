import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export const SUMMARY_QUEUE_NAME = "summary";

export interface SummaryJobData {
  meetingId: string;
}

const globalForQueue = globalThis as unknown as {
  summaryQueue: Queue<SummaryJobData> | undefined;
};

/**
 * La instancia se crea de forma perezosa (no al importar el módulo): el
 * constructor de `Queue` conecta a Redis de inmediato, lo cual rompe el
 * `next build` (que evalúa este módulo para inspeccionar las rutas) cuando
 * no hay Redis disponible en tiempo de build.
 */
function getSummaryQueue(): Queue<SummaryJobData> {
  if (!globalForQueue.summaryQueue) {
    globalForQueue.summaryQueue = new Queue<SummaryJobData>(
      SUMMARY_QUEUE_NAME,
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

  return globalForQueue.summaryQueue;
}

export async function addSummaryJob(meetingId: string) {
  return getSummaryQueue().add(
    "generate-summary",
    { meetingId },
    { jobId: `meeting-${meetingId}` },
  );
}
