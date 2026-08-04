import { createReadStream } from "fs";
import { DeepgramClient } from "@deepgram/sdk";
import type { Deepgram } from "@deepgram/sdk";

export interface DiarizedSegment {
  speaker: string; // e.g. "Speaker 0"
  text: string;
  startTime: number; // seconds
  endTime: number; // seconds
}

export interface TranscriptionResult {
  rawText: string;
  segments: DiarizedSegment[];
}

// Opciones de transcripción compartidas por las variantes URL (grabación de
// Recall.ai) y archivo (subida manual): mismas features de Deepgram, solo
// cambia la fuente del audio.
const TRANSCRIPTION_OPTIONS = {
  diarize: true,
  utterances: true,
  punctuate: true,
  smart_format: true,
  model: "nova-3",
  // Sin esto, Deepgram asume `language=en` por defecto y no reconoce audio
  // en español (devuelve confidence 0 / transcript vacío). "multi" cubre
  // reuniones en español, inglés o mezcladas.
  language: "multi",
} as const;

function createClient(): DeepgramClient {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY no está configurada");

  return new DeepgramClient({ apiKey });
}

function parseTranscriptionResponse(
  response: Deepgram.listen.v1.MediaTranscribeResponse,
): TranscriptionResult {
  if (!("results" in response)) {
    // ListenV1AcceptedResponse (solicitud asíncrona vía callback): no aplica
    // en este flujo síncrono, pero se maneja para que TypeScript pueda
    // estrechar el tipo y por robustez ante cambios futuros.
    return { rawText: "", segments: [] };
  }

  const rawText =
    response.results.channels[0]?.alternatives?.[0]?.transcript ?? "";

  const utterances = response.results.utterances ?? [];

  const segments: DiarizedSegment[] = utterances
    .filter(
      (u): u is typeof u & { transcript: string; start: number; end: number } =>
        u.transcript !== undefined && u.start !== undefined && u.end !== undefined,
    )
    .map((u) => ({
      speaker: `Speaker ${u.speaker ?? 0}`,
      text: u.transcript,
      startTime: u.start,
      endTime: u.end,
    }));

  return { rawText, segments };
}

/**
 * Transcribe una grabación remota (URL) usando Deepgram, con diarización de
 * hablantes. No instancia el cliente a nivel de módulo para evitar efectos
 * secundarios en tiempo de import/build.
 */
export async function transcribeRecording(
  recordingUrl: string,
): Promise<TranscriptionResult> {
  const client = createClient();

  let response;
  try {
    response = await client.listen.v1.media.transcribeUrl({
      url: recordingUrl,
      ...TRANSCRIPTION_OPTIONS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Deepgram API error al transcribir ${recordingUrl}: ${message}`, {
      cause: err,
    });
  }

  return parseTranscriptionResponse(response);
}

/**
 * Transcribe un archivo local (audio o video subido manualmente) usando
 * Deepgram, con las mismas opciones/diarización que `transcribeRecording`.
 * A diferencia de la variante por URL, el archivo se envía directamente
 * como stream binario: no necesita ser accesible públicamente por Deepgram.
 */
export async function transcribeUploadedFile(
  filePath: string,
): Promise<TranscriptionResult> {
  const client = createClient();

  let response;
  try {
    response = await client.listen.v1.media.transcribeFile(
      createReadStream(filePath),
      TRANSCRIPTION_OPTIONS,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Deepgram API error al transcribir ${filePath}: ${message}`, {
      cause: err,
    });
  }

  return parseTranscriptionResponse(response);
}
