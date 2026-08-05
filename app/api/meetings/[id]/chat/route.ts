import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  formatTranscriptForPrompt,
  streamMeetingChatAnswer,
  type ChatTurn,
  type DiarizedSegment,
} from "@/lib/gemini";

interface ChatRequestBody {
  message?: string;
}

async function resolveMeetingForChat(meetingId: string, orgId: string) {
  const organization = await prisma.organization.findUnique({
    where: { clerkOrgId: orgId },
  });
  if (!organization) return { error: "org_not_found" as const };

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizationId: organization.id },
    include: { transcript: true },
  });
  if (!meeting) return { error: "meeting_not_found" as const };

  return { meeting };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "No autenticado o sin organización activa" },
      { status: 401 },
    );
  }

  const result = await resolveMeetingForChat(id, orgId);
  if ("error" in result) {
    return NextResponse.json(
      { error: "Reunión no encontrada" },
      { status: 404 },
    );
  }

  const messages = await prisma.meetingChatMessage.findMany({
    where: { meetingId: result.meeting.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ messages });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "No autenticado o sin organización activa" },
      { status: 401 },
    );
  }

  const { message } = (await req.json()) as ChatRequestBody;
  if (!message || !message.trim()) {
    return NextResponse.json(
      { error: "Falta el campo requerido: message" },
      { status: 400 },
    );
  }

  const [result, user] = await Promise.all([
    resolveMeetingForChat(id, orgId),
    prisma.user.findUnique({ where: { clerkUserId: userId } }),
  ]);

  if ("error" in result) {
    return NextResponse.json(
      { error: "Reunión no encontrada" },
      { status: 404 },
    );
  }
  if (!user) {
    return NextResponse.json(
      { error: "Usuario todavía no sincronizado" },
      { status: 409 },
    );
  }

  const { meeting } = result;
  if (!meeting.transcript) {
    return NextResponse.json(
      { error: "Esta reunión todavía no tiene transcripción disponible." },
      { status: 409 },
    );
  }

  const previousMessages = await prisma.meetingChatMessage.findMany({
    where: { meetingId: meeting.id },
    orderBy: { createdAt: "asc" },
  });

  const history: ChatTurn[] = previousMessages.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));

  await prisma.meetingChatMessage.create({
    data: {
      meetingId: meeting.id,
      role: "USER",
      content: message,
      userId: user.id,
    },
  });

  const transcriptText = formatTranscriptForPrompt(
    meeting.transcript.segments as unknown as DiarizedSegment[],
  );

  let stream;
  try {
    stream = await streamMeetingChatAnswer(transcriptText, history, message);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }

  const encoder = new TextEncoder();
  let fullAnswer = "";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          fullAnswer += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[Error: ${errorMessage}]`));
      } finally {
        if (fullAnswer.trim()) {
          await prisma.meetingChatMessage.create({
            data: {
              meetingId: meeting.id,
              role: "ASSISTANT",
              content: fullAnswer,
            },
          });
        }
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
