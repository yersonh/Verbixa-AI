import { formatTranscriptForPrompt, getGeminiClient } from "@/lib/gemini";
import type { DiarizedSegment } from "@/lib/gemini";

/**
 * Umbral (en tokens estimados) a partir del cual se activa el flujo
 * map-reduce en lugar de resumir la transcripción completa en una sola
 * llamada a Gemini.
 *
 * Esto NO es un límite técnico del modelo: la ventana de contexto real de
 * Gemini es enorme (millones de tokens) y podría procesar transcripciones
 * mucho más largas de una sola vez. Es una decisión de producto deliberada
 * y conservadora: en inputs de una sola pasada muy largos, los modelos
 * tienden a perder fidelidad/atención sobre partes del texto, así que
 * preferimos trocear reuniones muy largas (aprox. varias horas) para
 * mantener alta fidelidad en el acta final, a costa de llamadas adicionales
 * (más baratas, de texto plano) en la fase de "map".
 */
export const MAP_REDUCE_TOKEN_THRESHOLD = 30_000;

/**
 * Aproximación de caracteres por token para texto en español/inglés, usada
 * habitualmente como heurística rápida para tokenizadores estilo
 * GPT/Gemini cuando no hay una librería de tokenización instalada.
 */
const CHARS_PER_TOKEN_ESTIMATE = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * Formatea segundos como mm:ss (sin librería de fechas), igual que el
 * helper interno de lib/gemini.ts, para etiquetar el rango temporal de
 * cada bloque en el texto reducido.
 */
function formatTimestamp(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const MAP_PROMPT_PREFIX = `Eres un asistente que ayuda a documentar reuniones corporativas. A continuación
recibirás un fragmento (no la reunión completa) de la transcripción de una
reunión, con cada intervención marcada por hablante y marca de tiempo.

Genera un resumen fiel y conciso en formato de viñetas de este fragmento.
Conserva los hechos concretos, nombres, decisiones y tareas/acciones
mencionadas explícitamente. No agregues opiniones ni interpretes más allá de
lo dicho. No inventes información que no esté en el texto.

FRAGMENTO:
`;

/**
 * Divide los segmentos en bloques contiguos y ordenados en el tiempo, sin
 * partir el texto de un mismo segmento entre dos bloques. Acumula
 * segmentos de forma voraz en un bloque hasta que agregar el siguiente
 * superaría el presupuesto de caracteres por bloque; en ese punto arranca
 * un bloque nuevo.
 */
function splitIntoBlocks(
  segments: DiarizedSegment[],
  charBudgetPerBlock: number,
): DiarizedSegment[][] {
  const blocks: DiarizedSegment[][] = [];
  let currentBlock: DiarizedSegment[] = [];
  let currentLength = 0;

  for (const segment of segments) {
    const segmentLength = formatTranscriptForPrompt([segment]).length;

    if (currentBlock.length > 0 && currentLength + segmentLength > charBudgetPerBlock) {
      blocks.push(currentBlock);
      currentBlock = [];
      currentLength = 0;
    }

    currentBlock.push(segment);
    currentLength += segmentLength;
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks;
}

async function summarizeBlock(block: DiarizedSegment[]): Promise<string> {
  const client = getGeminiClient();
  const blockText = formatTranscriptForPrompt(block);
  const prompt = `${MAP_PROMPT_PREFIX}${blockText}`;

  let response;
  try {
    response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini API error al resumir un bloque de la transcripción: ${message}`, {
      cause: err,
    });
  }

  const text = response.text;
  if (text === undefined) {
    throw new Error(
      "Gemini API no devolvió texto en la respuesta al resumir un bloque de la transcripción",
    );
  }

  return text.trim();
}

/**
 * Punto de entrada único que reemplaza una llamada directa a
 * `formatTranscriptForPrompt(segments)` para manejar de forma transparente
 * transcripciones cortas y largas.
 *
 * - Si la transcripción formateada está por debajo de
 *   MAP_REDUCE_TOKEN_THRESHOLD (estimado), se devuelve tal cual, sin
 *   llamadas adicionales a Gemini.
 * - Si la supera, se divide en bloques contiguos ordenados en el tiempo,
 *   se resume cada bloque individualmente ("map") con Gemini, y los
 *   resúmenes se concatenan en un solo texto delimitado por bloque,
 *   incluyendo el rango de tiempo aproximado de cada uno ("reduce"). Ese
 *   texto reducido es lo que el llamador debe pasar luego a
 *   `generateMeetingMinutes`.
 *
 * Los errores de la API de Gemini en cualquier llamada de "map" se
 * propagan sin capturar: si un bloque falla, toda la función falla y se
 * deja que la lógica de reintentos del worker (BullMQ, con sus propios
 * attempts/backoff) maneje el reintento del job completo.
 */
export async function prepareTranscriptForSummary(
  segments: DiarizedSegment[],
): Promise<string> {
  const formattedText = formatTranscriptForPrompt(segments);
  const estimatedTokens = estimateTokens(formattedText);

  if (estimatedTokens <= MAP_REDUCE_TOKEN_THRESHOLD) {
    return formattedText;
  }

  // Presupuesto de caracteres por bloque derivado del umbral, para que cada
  // bloque individual quede cómodamente por debajo del umbral de tokens
  // (y así la llamada de "map" en sí sea rápida y de alta fidelidad).
  const charBudgetPerBlock = MAP_REDUCE_TOKEN_THRESHOLD * CHARS_PER_TOKEN_ESTIMATE;
  const blocks = splitIntoBlocks(segments, charBudgetPerBlock);

  const blockSummaries: string[] = [];
  for (const block of blocks) {
    const summary = await summarizeBlock(block);
    blockSummaries.push(summary);
  }

  const sections = blocks.map((block, index) => {
    const firstSegment = block[0];
    const lastSegment = block[block.length - 1];
    const startLabel = formatTimestamp(firstSegment.startTime);
    const endLabel = formatTimestamp(lastSegment.endTime);
    const summary = blockSummaries[index];

    return `--- Resumen del bloque ${index + 1} (${startLabel}–${endLabel}) ---\n${summary}`;
  });

  return sections.join("\n\n");
}
