import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { Meeting } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Resuelve y autoriza el Meeting para las rutas de grabación (la principal
 * y `meta`), que comparten exactamente la misma validación: sesión activa,
 * organización sincronizada, y la reunión (con grabación) perteneciendo a
 * esa organización.
 */
type MeetingWithRecording = Meeting & { recordingUrl: string };

export async function resolveMeetingForRecording(
  id: string,
): Promise<{ meeting: MeetingWithRecording } | { error: NextResponse }> {
  const { orgId } = await auth();

  if (!orgId) {
    return {
      error: NextResponse.json(
        { error: "No autenticado o sin organización activa" },
        { status: 401 },
      ),
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!organization) {
    return {
      error: NextResponse.json(
        { error: "Organización no encontrada" },
        { status: 404 },
      ),
    };
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id, organizationId: organization.id },
  });

  if (!meeting || !meeting.recordingUrl) {
    return {
      error: NextResponse.json(
        { error: "La grabación no está disponible para esta reunión." },
        { status: 404 },
      ),
    };
  }

  return { meeting: meeting as MeetingWithRecording };
}
