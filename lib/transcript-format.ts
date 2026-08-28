import type { DiarizedSegment } from "@/lib/deepgram";

export type { DiarizedSegment };

export interface SegmentGroup {
  speaker: string;
  segments: DiarizedSegment[];
}

/**
 * Agrupa segmentos consecutivos del mismo hablante en un solo bloque, para
 * no repetir la etiqueta de hablante en cada línea. Se usa tanto en la UI
 * (transcript-view.tsx) como en las exportaciones a PDF/Word.
 */
export function groupConsecutiveSegments(
  segments: DiarizedSegment[],
): SegmentGroup[] {
  const groups: SegmentGroup[] = [];

  for (const segment of segments) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.speaker === segment.speaker) {
      lastGroup.segments.push(segment);
    } else {
      groups.push({ speaker: segment.speaker, segments: [segment] });
    }
  }

  return groups;
}

/**
 * Une el texto de varios segmentos en un solo párrafo. Se usa para la
 * exportación "sin marcas de tiempo": aunque el hablante lo dijo de corrido,
 * la diarización lo parte en varias líneas. Colapsa espacios repetidos y
 * evita duplicar el espacio cuando un segmento ya termina en signo de
 * puntuación.
 */
export function joinSegmentsText(segments: DiarizedSegment[]): string {
  return segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Filtra los segmentos por hablante. Si `speaker` es null/undefined devuelve
 * todos. Se comparte entre la UI y las rutas de exportación para que la
 * descarga respete el filtro de hablante seleccionado.
 */
export function filterSegmentsBySpeaker(
  segments: DiarizedSegment[],
  speaker: string | null | undefined,
): DiarizedSegment[] {
  if (!speaker) return segments;
  return segments.filter((segment) => segment.speaker === speaker);
}

export function formatTimestamp(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const totalSeconds = Math.floor(safeSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
