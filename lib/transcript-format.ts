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

export function formatTimestamp(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const totalSeconds = Math.floor(safeSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
