import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { MeetingSource, MeetingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addTranscriptionJob } from "@/lib/queues/transcription";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const ALLOWED_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
]);

// request.formData() de Next.js carga el cuerpo completo en memoria (no hay
// streaming incremental disponible en Route Handlers), así que se limita el
// tamaño para evitar picos de memoria excesivos en el proceso del servidor.
const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "No autenticado o sin organización activa" },
      { status: 401 },
    );
  }

  const formData = await req.formData();
  const title = formData.get("title");
  const file = formData.get("file");

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Debes adjuntar un archivo de audio o video" },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el tamaño máximo permitido (500 MB)" },
      { status: 413 },
    );
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `Formato de archivo no soportado: ${ext || "desconocido"}` },
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
      title: title.trim(),
      scheduledAt: new Date(),
      status: MeetingStatus.PROCESSING,
      source: MeetingSource.UPLOAD,
      organizationId: organization.id,
      createdById: user.id,
    },
  });

  const filePath = path.join(UPLOADS_DIR, `${meeting.id}${ext}`);

  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);
  } catch (err) {
    console.error("No se pudo guardar el archivo subido:", err);
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: MeetingStatus.FAILED },
    });
    return NextResponse.json(
      { error: "No se pudo guardar el archivo subido" },
      { status: 500 },
    );
  }

  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { recordingUrl: filePath },
  });

  await addTranscriptionJob(updated.id);

  return NextResponse.json(updated, { status: 201 });
}
