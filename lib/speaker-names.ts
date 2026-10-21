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

      // Rango abierto: Recall deja start/end en null cuando el evento de
      // habla nunca se cerró (p. ej. la grabación terminó mientras el
      // participante seguía "hablando", o el evento arrancó antes de que
      // empezara el tracking). Se trata como si se extendiera hasta el
      // borde correspondiente de la grabación en vez de descartarlo — de lo
      // contrario, una reunión corta con un solo tramo de habla sin cerrar
      // se queda sin ningún voto y todo cae al fallback "Speaker N".
      const entryStart = entry.start_timestamp?.relative ?? 0;
      const entryEnd = entry.end_timestamp?.relative ?? Infinity;

      const overlap =
        Math.min(segment.endTime, entryEnd) -
        Math.max(segment.startTime, entryStart);

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

// Etiqueta genérica que asigna Deepgram (ver `parseTranscriptionResponse`).
const GENERIC_SPEAKER_LABEL = /^Speaker \d+$/;

// Solo se buscan presentaciones en las primeras intervenciones de cada
// hablante: es donde la gente dice "hola, soy X". Más adelante en la
// reunión, frases como "soy Fulano de Tal" son mucho menos frecuentes y el
// riesgo de falso positivo ("como decía Juan...") crece.
const MAX_INTRO_SEGMENTS_PER_SPEAKER = 3;

const UPPER = "A-ZÁÉÍÓÚÑÜ";
const LOWER = "a-záéíóúñü";

// Frases de presentación. Las "fuertes" ("me llamo", "mi nombre es") casi
// siempre van seguidas de un nombre, así que se acepta aunque Deepgram lo
// haya transcrito en minúsculas. Las "débiles" ("soy", "I'm") se usan para
// muchas otras cosas ("soy de Monterrey", "soy el encargado"), por lo que
// solo cuentan si lo que sigue empieza con mayúscula.
const STRONG_INTRO =
  /\b(?:me\s+llamo|mi\s+nombre\s+es|my\s+name\s+is)\s+/gi;
const WEAK_INTRO =
  /(?:^|[\s,.¡!¿?])(?:yo\s+soy|soy|les\s+habla|te\s+habla|le\s+habla|i\s+am|i['’]m|this\s+is)\s+/gi;

// Títulos que pueden ir entre la frase y el nombre:
// "soy el ingeniero Carlos Pérez", "les habla la doctora Ana Ruiz".
const TITLE_PREFIX = new RegExp(
  String.raw`^(?:(?:el|la)\s+)?(?:ingenier[oa]|ing\.?|licenciad[oa]|lic\.?|doctor[a]?|dr[a]?\.?|maestr[oa]|profesor[a]?|contador[a]?|arquitect[oa]|señor[a]?|sr[a]?\.?)\s+`,
  "i",
);

// Palabras que pueden aparecer capitalizadas tras "soy"/"I'm" (inicio de
// frase, transcripción con mayúscula espuria) y que no son nombres.
const NOT_A_NAME = new Set([
  "yo", "el", "la", "los", "las", "un", "una", "de", "del", "en", "y", "e",
  "o", "que", "muy", "bueno", "hola", "gracias", "aqui", "aquí", "nuevo",
  "nueva", "parte", "quien", "quién", "responsable", "encargado", "encargada",
  "gerente", "director", "directora", "jefe", "jefa", "ingeniero", "ingeniera",
  "licenciado", "licenciada", "doctor", "doctora", "the", "a", "an", "here",
  "just", "not", "so", "sure", "sorry", "going", "from", "very", "really",
  "fine", "good", "ok", "okay", "happy", "glad",
]);

// Partículas que pueden ir entre palabras de un nombre ("María de la Cruz").
const NAME_PARTICLES = new Set(["de", "del", "la", "las", "los", "y"]);

const MAX_NAME_WORDS = 3;

const WORD = new RegExp(`^[${UPPER}${LOWER}][${UPPER}${LOWER}'-]*`);
const CAPITALIZED = new RegExp(`^[${UPPER}]`);

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Extrae el nombre que sigue a una frase de presentación. `requireCapital`
 * indica si la primera palabra (y las siguientes) deben venir con mayúscula
 * para considerarse parte del nombre.
 */
function readName(text: string, requireCapital: boolean): string | null {
  const rest = text.replace(TITLE_PREFIX, "");
  const tokens = rest.split(/\s+/);
  const words: string[] = [];
  // Las partículas no cuentan para el límite de palabras del nombre.
  let nameWords = 0;

  for (let i = 0; i < tokens.length && nameWords < MAX_NAME_WORDS; i++) {
    const match = tokens[i].match(WORD);
    if (!match) break;
    const word = match[0];
    const lower = word.toLowerCase();
    // La puntuación pegada al final ("Juan,") cierra el nombre.
    const endsHere = match[0].length < tokens[i].length;

    if (words.length > 0 && NAME_PARTICLES.has(lower)) {
      // Partícula solo si le sigue otra palabra con mayúscula
      // ("María de la Cruz"), no "Juan y trabajo en...".
      if (endsHere || lower === "y") break;
      const next = tokens.slice(i + 1).find((t) => !NAME_PARTICLES.has(t.toLowerCase()));
      if (!next || !CAPITALIZED.test(next)) break;
      words.push(lower);
      continue;
    }

    if (NOT_A_NAME.has(lower)) break;
    if (requireCapital || words.length > 0) {
      if (!CAPITALIZED.test(word)) break;
    }

    words.push(capitalize(word));
    nameWords++;
    if (endsHere) break;
  }

  // No terminar en partícula ("Juan de").
  while (words.length > 0 && NAME_PARTICLES.has(words[words.length - 1])) {
    words.pop();
  }

  return words.length > 0 ? words.join(" ") : null;
}

/**
 * Busca en un texto una presentación del tipo "me llamo Ana", "soy Carlos
 * Pérez" o "my name is John" y devuelve el nombre, o null si no hay.
 */
export function extractSelfIntroducedName(text: string): string | null {
  const candidates: { index: number; name: string }[] = [];

  for (const [pattern, requireCapital] of [
    [STRONG_INTRO, false],
    [WEAK_INTRO, true],
  ] as const) {
    for (const match of text.matchAll(pattern)) {
      const after = text.slice((match.index ?? 0) + match[0].length);
      const name = readName(after, requireCapital);
      if (name) candidates.push({ index: match.index ?? 0, name });
    }
  }

  if (candidates.length === 0) return null;
  // La primera presentación del texto es la que vale.
  candidates.sort((a, b) => a.index - b.index);
  return candidates[0].name;
}

/**
 * Reemplaza las etiquetas genéricas "Speaker N" por el nombre con el que
 * esa persona se presentó al inicio de la grabación ("Hola, soy Ana...").
 *
 * Pensado para las grabaciones subidas manualmente, donde no hay timeline de
 * Recall.ai con los nombres de los participantes. Solo toca etiquetas que
 * siguen siendo "Speaker N" (las ya resueltas por `resolveSpeakerNames` se
 * respetan) y solo mira las primeras intervenciones de cada hablante. Si dos
 * etiquetas distintas se presentan con el mismo nombre, se le asigna solo a
 * la primera, para no fusionar a dos personas distintas por un falso
 * positivo.
 */
export function resolveSpeakerNamesFromIntroductions(
  segments: DiarizedSegment[],
): DiarizedSegment[] {
  const seenSegments = new Map<string, number>();
  const nameByLabel = new Map<string, string>();
  const usedNames = new Set(
    segments
      .map((s) => s.speaker)
      .filter((label) => !GENERIC_SPEAKER_LABEL.test(label))
      .map((name) => name.toLowerCase()),
  );

  for (const segment of segments) {
    const label = segment.speaker;
    if (!GENERIC_SPEAKER_LABEL.test(label) || nameByLabel.has(label)) continue;

    const seen = seenSegments.get(label) ?? 0;
    if (seen >= MAX_INTRO_SEGMENTS_PER_SPEAKER) continue;
    seenSegments.set(label, seen + 1);

    const name = extractSelfIntroducedName(segment.text);
    if (!name || usedNames.has(name.toLowerCase())) continue;

    nameByLabel.set(label, name);
    usedNames.add(name.toLowerCase());
  }

  if (nameByLabel.size === 0) return segments;

  return segments.map((segment) => ({
    ...segment,
    speaker: nameByLabel.get(segment.speaker) ?? segment.speaker,
  }));
}
