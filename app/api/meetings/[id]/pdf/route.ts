import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";

import { prisma } from "@/lib/prisma";

interface MeetingForPdf {
  title: string;
  scheduledAt: Date;
  summary: {
    executiveSummary: string;
    keyDecisions: unknown;
    conclusions: string;
    tasks: {
      id: string;
      description: string;
      assignee: string | null;
      dueDate: Date | null;
      completed: boolean;
    }[];
  };
}

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

/**
 * Se usa pdfkit (no React) para generar el PDF. @react-pdf/renderer se
 * probó primero pero fallaba consistentemente con "Minified React error
 * #31" al llamar a renderToBuffer dentro de un Route Handler de Next.js en
 * este entorno (reproducido incluso con un documento mínimo estático, sin
 * datos reales de por medio, con y sin bundling de webpack) — una
 * incompatibilidad real entre su reconciliador interno y este setup, no un
 * problema de nuestros datos. pdfkit no depende de React en absoluto, así
 * que evita esa clase de problema por completo.
 */
function renderActaPdf(meeting: MeetingForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const keyDecisions = (meeting.summary.keyDecisions as string[]) ?? [];
    const tasks = meeting.summary.tasks;

    doc.fontSize(20).font("Helvetica-Bold").text(meeting.title);
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#666666")
      .text(formatDate(meeting.scheduledAt));
    doc.moveDown(1.5);
    doc.fillColor("#1a1a1a");

    doc.fontSize(14).font("Helvetica-Bold").text("Resumen ejecutivo");
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(meeting.summary.executiveSummary, { lineGap: 3 });
    doc.moveDown(1.2);

    doc.fontSize(14).font("Helvetica-Bold").text("Decisiones clave");
    doc.moveDown(0.3);
    if (keyDecisions.length > 0) {
      doc.fontSize(11).font("Helvetica");
      for (const decision of keyDecisions) {
        doc.text(`•  ${decision}`, { lineGap: 3 });
      }
    } else {
      doc
        .fontSize(11)
        .font("Helvetica-Oblique")
        .fillColor("#888888")
        .text("Sin decisiones registradas.")
        .fillColor("#1a1a1a");
    }
    doc.moveDown(1.2);

    doc.fontSize(14).font("Helvetica-Bold").text("Conclusiones");
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(meeting.summary.conclusions, { lineGap: 3 });
    doc.moveDown(1.2);

    doc.fontSize(14).font("Helvetica-Bold").text("Tareas");
    doc.moveDown(0.3);
    if (tasks.length > 0) {
      for (const task of tasks) {
        doc
          .fontSize(11)
          .font("Helvetica")
          .text(`${task.completed ? "[x]" : "[ ]"}  ${task.description}`);
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#666666")
          .text(
            `${task.assignee ?? "Sin asignar"} · ${
              task.dueDate ? formatDate(task.dueDate) : "Sin fecha"
            }`,
          )
          .fillColor("#1a1a1a");
        doc.moveDown(0.6);
      }
    } else {
      doc
        .fontSize(11)
        .font("Helvetica-Oblique")
        .fillColor("#888888")
        .text("Sin tareas.")
        .fillColor("#1a1a1a");
    }

    doc.end();
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
    include: { summary: { include: { tasks: true } } },
  });

  if (!meeting) {
    return NextResponse.json(
      { error: "Reunión no encontrada" },
      { status: 404 },
    );
  }

  if (!meeting.summary) {
    return NextResponse.json(
      { error: "El acta todavía no está disponible para esta reunión." },
      { status: 409 },
    );
  }

  const buffer = await renderActaPdf({
    title: meeting.title,
    scheduledAt: meeting.scheduledAt,
    summary: meeting.summary,
  });

  const filename = `acta-${slugify(meeting.title || meeting.id)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
