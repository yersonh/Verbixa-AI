import type { DiarizedSegment } from "@/lib/deepgram";
import type { RecallSpeakerTimelineEntry } from "@/lib/recall";

/**
 * Reemplaza las etiquetas numéricas de hablante de Deepgram ("Speaker 0",
 * "Speaker 1", ...) por los nombres reales de los participantes de Google
 * Meet, usando el timeline de actividad de voz que provee Recall.ai.
 *
 * Para cada etiqueta de Deepgram, se elige el participante cuyo tiempo total
 * de solapamiento con los segmentos de esa etiqueta sea mayor (voto por
 * solapamiento acumulado, no por segmento individual, para evitar que un
 * mismo hablante cambie de nombre entre líneas por pequeños desfases).
 * Si no hay timeline disponible o no hay solapamiento para una etiqueta, esa
 * etiqueta se deja igual (fallback a "Speaker N").
 */
export function resolveSpeakerNames(
  segments: DiarizedSegment[],
  timeline: RecallSpeakerTimelineEntry[],
): DiarizedSegment[] {
  if (timeline.length === 0) return segments;

  const overlapByLabel = new Map<string, Map<string, number>>();

  for (const segment of segments) {
    const votes = overlapByLabel.get(segment.speaker) ?? new Map<string, number>();

    for (const entry of timeline) {
      if (!entry.participant.name) continue;
      // Rango abierto (start/end nulos): se ignora, no se puede solapar con
      // certeza contra los segmentos de Deepgram.
      if (!entry.start_timestamp || !entry.end_timestamp) continue;

      const overlap =
        Math.min(segment.endTime, entry.end_timestamp.relative) -
        Math.max(segment.startTime, entry.start_timestamp.relative);

      if (overlap > 0) {
        votes.set(
          entry.participant.name,
          (votes.get(entry.participant.name) ?? 0) + overlap,
        );
      }
    }

    overlapByLabel.set(segment.speaker, votes);
  }

  const nameByLabel = new Map<string, string>();
  for (const [label, votes] of overlapByLabel) {
    let bestName: string | null = null;
    let bestScore = 0;
    for (const [name, score] of votes) {
      if (score > bestScore) {
        bestScore = score;
        bestName = name;
      }
    }
    if (bestName) nameByLabel.set(label, bestName);
  }

  return segments.map((segment) => ({
    ...segment,
    speaker: nameByLabel.get(segment.speaker) ?? segment.speaker,
  }));
}
