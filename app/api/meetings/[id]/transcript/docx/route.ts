import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

import { prisma } from "@/lib/prisma";
import {
  groupConsecutiveSegments,
  formatTimestamp,
  type DiarizedSegment,
} from "@/lib/transcript-format";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "reunion"
  );
}

function buildTranscriptDocx(meeting: {
  title: string;
  scheduledAt: Date;
  segments: DiarizedSegment[];
}): Document {
  const groups = groupConsecutiveSegments(meeting.segments);

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(meeting.title)],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({ text: formatDate(meeting.scheduledAt), color: "666666" }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [new TextRun("Transcripción")],
    }),
  ];

  if (groups.length === 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Sin contenido.", italics: true, color: "888888" })],
      }),
    );
  }

  for (const group of groups) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: group.speaker, bold: true })],
      }),
    );

    for (const segment of group.segments) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: `[${formatTimestamp(segment.startTime)}]  `,
              color: "888888",
            }),
            new TextRun(segment.text),
          ],
        }),
      );
    }
  }

  return new Document({
    sections: [{ children }],
  });
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
    include: { transcript: true },
  });

  if (!meeting) {
    return NextResponse.json(
      { error: "Reunión no encontrada" },
      { status: 404 },
    );
  }

  if (!meeting.transcript) {
    return NextResponse.json(
      { error: "La transcripción todavía no está disponible para esta reunión." },
      { status: 409 },
    );
  }

  const doc = buildTranscriptDocx({
    title: meeting.title,
    scheduledAt: meeting.scheduledAt,
    segments: meeting.transcript.segments as unknown as DiarizedSegment[],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `transcripcion-${slugify(meeting.title || meeting.id)}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
