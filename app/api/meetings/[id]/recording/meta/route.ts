import path from "path";
import { NextResponse } from "next/server";
import { MeetingSource } from "@prisma/client";

import { getRecordingPlaybackUrl } from "@/lib/recall";
import { resolveMeetingForRecording } from "../shared";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi"]);

/**
 * Le dice al reproductor si la grabación es audio o video (y si sigue
 * disponible) SIN exponer la URL real ni cargar el media de una — el
 * componente decide qué elemento renderizar (<audio> vs <video>) antes de
 * pedir el stream en sí a la ruta principal.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const resolved = await resolveMeetingForRecording(id);
  if ("error" in resolved) return resolved.error;
  const { meeting } = resolved;

  if (meeting.source === MeetingSource.UPLOAD) {
    const ext = path.extname(meeting.recordingUrl ?? "").toLowerCase();
    return NextResponse.json({
      available: true,
      mediaType: VIDEO_EXTENSIONS.has(ext) ? "video" : "audio",
    });
  }

  if (!meeting.recallBotId) {
    return NextResponse.json({ available: false });
  }

  const playback = await getRecordingPlaybackUrl(meeting.recallBotId).catch(
    () => null,
  );

  if (!playback) {
    return NextResponse.json({ available: false });
  }

  return NextResponse.json({ available: true, mediaType: playback.mediaType });
}
