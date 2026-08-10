import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { MeetingSource } from "@prisma/client";

import { getRecordingPlaybackUrl } from "@/lib/recall";
import { resolveMeetingForRecording } from "./shared";

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
};

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
 * Sirve la grabación de una reunión, ya sea un archivo subido (disco local,
 * con soporte de Range para permitir avanzar/retroceder sin descargar todo)
 * o la grabación de un bot de Recall.ai (redirige a una download_url fresca
 * — expiran a las 5h, así que nunca se debe cachear ni reusar la que quedó
 * guardada en Meeting.recordingUrl en el momento del webhook `bot.done`).
 *
 * `?download=1` fuerza la descarga con un nombre de archivo legible; para
 * grabaciones de Recall esto implica proxyear el stream (en vez de
 * redirigir) porque el atributo `download` del navegador no aplica a
 * redirecciones cross-origin.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const resolved = await resolveMeetingForRecording(id);
  if ("error" in resolved) return resolved.error;
  const { meeting } = resolved;

  const wantsDownload = req.nextUrl.searchParams.get("download") === "1";
  const filename = `grabacion-${slugify(meeting.title || meeting.id)}`;

  if (meeting.source === MeetingSource.RECALL_BOT) {
    if (!meeting.recallBotId) {
      return NextResponse.json(
        { error: "La grabación no está disponible para esta reunión." },
        { status: 404 },
      );
    }

    const playback = await getRecordingPlaybackUrl(meeting.recallBotId).catch(
      () => null,
    );

    if (!playback) {
      return NextResponse.json(
        {
          error:
            "La grabación ya no está disponible (puede haber expirado su periodo de retención).",
        },
        { status: 404 },
      );
    }

    if (!wantsDownload) {
      return NextResponse.redirect(playback.url, { status: 302 });
    }

    const upstream = await fetch(playback.url);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "No se pudo descargar la grabación." },
        { status: 502 },
      );
    }

    const isVideo = playback.mediaType === "video";
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": isVideo ? "video/mp4" : "audio/mpeg",
        "Content-Disposition": `attachment; filename="${filename}.${isVideo ? "mp4" : "mp3"}"`,
      },
    });
  }

  // MeetingSource.UPLOAD: recordingUrl es una ruta local absoluta.
  const filePath = meeting.recordingUrl;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return NextResponse.json(
      { error: "El archivo de la grabación ya no existe en el servidor." },
      { status: 404 },
    );
  }

  const fileSize = fileStat.size;
  const disposition = wantsDownload
    ? `attachment; filename="${filename}${ext}"`
    : "inline";

  const range = req.headers.get("range");
  if (range && !wantsDownload) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2] ? parseInt(match[2], 10) : fileSize - 1;

    const nodeStream = createReadStream(filePath, { start, end });
    return new NextResponse(
      Readable.toWeb(nodeStream) as unknown as ReadableStream,
      {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          "Content-Type": contentType,
          "Content-Disposition": disposition,
        },
      },
    );
  }

  const nodeStream = createReadStream(filePath);
  return new NextResponse(
    Readable.toWeb(nodeStream) as unknown as ReadableStream,
    {
      status: 200,
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Disposition": disposition,
      },
    },
  );
}
