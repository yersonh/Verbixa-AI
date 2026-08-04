import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBot } from "@/lib/recall";
import { detectMeetingPlatform } from "@/lib/meeting-platform";

interface CreateMeetingBody {
  title?: string;
  meetingUrl?: string;
  scheduledAt?: string;
}

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "No autenticado o sin organización activa" },
      { status: 401 },
    );
  }

  const { title, meetingUrl, scheduledAt } = (await req.json()) as CreateMeetingBody;

  if (!title || !meetingUrl || !scheduledAt) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: title, meetingUrl, scheduledAt" },
      { status: 400 },
    );
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: "scheduledAt inválido" }, { status: 400 });
  }

  if (!detectMeetingPlatform(meetingUrl)) {
    return NextResponse.json(
      {
        error:
          "El enlace debe ser de Google Meet (meet.google.com) o Microsoft Teams (teams.microsoft.com / teams.live.com)",
      },
      { status: 400 },
    );
  }

  const [organization, user] = await Promise.all([
    prisma.organization.findUnique({ where: { clerkOrgId: orgId } }),
    prisma.user.findUnique({ where: { clerkUserId: userId } }),
  ]);

  if (!organization || !user) {
    return NextResponse.json(
      { error: "Organización o usuario todavía no sincronizados" },
      { status: 409 },
    );
  }

  const meeting = await prisma.meeting.create({
    data: {
      title,
      meetingUrl,
      scheduledAt: scheduledDate,
      organizationId: organization.id,
      createdById: user.id,
    },
  });

  try {
    const bot = await createBot({
      meetingUrl,
      joinAt: scheduledDate.toISOString(),
    });

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { recallBotId: bot.id },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    console.error("No se pudo crear el bot de Recall.ai:", err);
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      { error: "La reunión se guardó, pero no se pudo crear el bot de Recall.ai" },
      { status: 502 },
    );
  }
}
