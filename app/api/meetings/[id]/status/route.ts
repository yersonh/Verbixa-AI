import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Endpoint liviano para polling desde el cliente (ver
 * MeetingLiveRefresher): solo trae lo mínimo para detectar cambios de
 * estado del pipeline (bot -> transcripción -> acta) sin traer segments ni
 * el resto del contenido pesado que sí trae la página completa.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { orgId } = await auth();

  if (!orgId) {
    return NextResponse.json(
      { error: "No autenticado o sin organización activa" },
      { status: 401 },
    );
  }

  const organization = await prisma.organization.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!organization) {
    return NextResponse.json(
      { error: "Organización no encontrada" },
      { status: 404 },
    );
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id, organizationId: organization.id },
    select: {
      status: true,
      transcript: { select: { id: true } },
      summary: { select: { id: true } },
    },
  });

  if (!meeting) {
    return NextResponse.json(
      { error: "Reunión no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    status: meeting.status,
    hasTranscript: Boolean(meeting.transcript),
    hasSummary: Boolean(meeting.summary),
  });
}
