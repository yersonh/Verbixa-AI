import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";

import { prisma } from "@/lib/prisma";
import {
  groupConsecutiveSegments,
  formatTimestamp,
  filterSegmentsBySpeaker,
  joinSegmentsText,
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

function renderTranscriptPdf(meeting: {
  title: string;
  scheduledAt: Date;
  segments: DiarizedSegment[];
  showTimestamps: boolean;
  speaker: string | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text(meeting.title);
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#666666")
      .text(formatDate(meeting.scheduledAt));
    doc.moveDown(1.5);
    doc.fillColor("#1a1a1a");

    doc.fontSize(14).font("Helvetica-Bold").text("Transcripción");
    if (meeting.speaker) {
      doc
        .fontSize(10)
        .font("Helvetica-Oblique")
        .fillColor("#666666")
        .text(`Filtrado por: ${meeting.speaker}`)
        .fillColor("#1a1a1a");
    }
    doc.moveDown(0.5);

    const groups = groupConsecutiveSegments(
      filterSegmentsBySpeaker(meeting.segments, meeting.speaker),
    );

    if (groups.length === 0) {
      doc
        .fontSize(11)
        .font("Helvetica-Oblique")
        .fillColor("#888888")
        .text("Sin contenido.")
        .fillColor("#1a1a1a");
    }

    for (const group of groups) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a1a1a").text(group.speaker);
      doc.moveDown(0.2);
      if (meeting.showTimestamps) {
        for (const segment of group.segments) {
          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#1a1a1a")
            .text(`[${formatTimestamp(segment.startTime)}]  ${segment.text}`, {
              lineGap: 2,
            });
        }
      } else {
        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#1a1a1a")
          .text(joinSegmentsText(group.segments), {
            lineGap: 2,
            align: "justify",
          });
      }
      doc.moveDown(0.8);
    }

    doc.end();
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const showTimestamps = url.searchParams.get("timestamps") !== "false";
  const speaker = url.searchParams.get("speaker") || null;
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

  const buffer = await renderTranscriptPdf({
    title: meeting.title,
    scheduledAt: meeting.scheduledAt,
    segments: meeting.transcript.segments as unknown as DiarizedSegment[],
    showTimestamps,
    speaker,
  });

  const filenameParts = ["transcripcion", slugify(meeting.title || meeting.id)];
  if (speaker) filenameParts.push(slugify(speaker));
  const filename = `${filenameParts.join("-")}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
