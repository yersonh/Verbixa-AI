import crypto from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma, MeetingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRecordingDownloadUrl } from "@/lib/recall";
import { addTranscriptionJob } from "@/lib/queues/transcription";
import { notifyMeetingFailed } from "@/lib/notifications";

/**
 * Verifica la firma de un webhook de Recall.ai (Standard Webhooks / HMAC-SHA256).
 * Ver: https://docs.recall.ai/docs/authenticating-requests-from-recallai
 */
function verifyRecallSignature(args: {
  secret: string;
  headers: { id: string | null; timestamp: string | null; signature: string | null };
  payload: string;
}): boolean {
  const { secret, headers, payload } = args;
  const { id: msgId, timestamp: msgTimestamp, signature: msgSignature } = headers;

  if (!msgId || !msgTimestamp || !msgSignature) return false;
  if (!secret.startsWith("whsec_")) return false;

  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const toSign = `${msgId}.${msgTimestamp}.${payload}`;
  const expectedSig = crypto.createHmac("sha256", key).update(toSign).digest("base64");
  const expected = Buffer.from(expectedSig);

  return msgSignature
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter((sig): sig is string => Boolean(sig))
    .some((sig) => {
      const provided = Buffer.from(sig);
      return (
        provided.length === expected.length &&
        crypto.timingSafeEqual(provided, expected)
      );
    });
}

interface RecallBotStatusEvent {
  event: string;
  data: {
    data: { code: string; sub_code: string | null; updated_at: string };
    bot: { id: string; metadata: Record<string, unknown> };
  };
}

// "bot.done" se maneja aparte: no marca COMPLETED directamente, sino que
// encola la transcripción; el worker es quien decide el estado final.
const STATUS_BY_EVENT: Partial<Record<string, MeetingStatus>> = {
  "bot.joining_call": MeetingStatus.JOINING,
  "bot.in_waiting_room": MeetingStatus.JOINING,
  "bot.in_call_not_recording": MeetingStatus.JOINING,
  "bot.in_call_recording": MeetingStatus.RECORDING,
  "bot.call_ended": MeetingStatus.PROCESSING,
  "bot.fatal": MeetingStatus.FAILED,
};

export async function POST(req: NextRequest) {
  const payload = await req.text();

  const secret = process.env.RECALL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RECALL_WEBHOOK_SECRET no está configurada");
    return new Response("Server misconfigured", { status: 500 });
  }

  const isValid = verifyRecallSignature({
    secret,
    headers: {
      id: req.headers.get("webhook-id"),
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
    },
    payload,
  });

  if (!isValid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const evt = JSON.parse(payload) as RecallBotStatusEvent;
  const botId = evt.data.bot.id;

  try {
    if (evt.event === "bot.done") {
      const recordingUrl = await getRecordingDownloadUrl(botId).catch((err) => {
        console.error("No se pudo obtener la URL de grabación:", err);
        return null;
      });

      if (!recordingUrl) {
        const failedMeeting = await prisma.meeting.update({
          where: { recallBotId: botId },
          data: { status: MeetingStatus.FAILED },
        });
        await notifyMeetingFailed(failedMeeting.id);
        return NextResponse.json({ ok: true, noRecording: true });
      }

      const meeting = await prisma.meeting.update({
        where: { recallBotId: botId },
        data: { status: MeetingStatus.PROCESSING, recordingUrl },
      });

      await addTranscriptionJob(meeting.id);
      return NextResponse.json({ ok: true });
    }

    const status = STATUS_BY_EVENT[evt.event];
    if (!status) {
      return NextResponse.json({ ok: true, ignored: evt.event });
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { recallBotId: botId },
      data: { status },
    });

    if (status === MeetingStatus.FAILED) {
      await notifyMeetingFailed(updatedMeeting.id);
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      console.warn(`Webhook de Recall.ai para bot desconocido: ${botId}`);
      return NextResponse.json({ ok: true, unknownBot: botId });
    }
    console.error("Error al sincronizar el estado del Meeting:", err);
    return new Response("Internal error", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
