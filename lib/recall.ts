const RECALL_API_REGION = process.env.RECALL_API_REGION ?? "us-west-2";
const RECALL_API_BASE = `https://${RECALL_API_REGION}.recall.ai/api/v1`;

function recallHeaders() {
  const apiKey = process.env.RECALL_API_KEY;
  if (!apiKey) throw new Error("RECALL_API_KEY no está configurada");

  return {
    Authorization: apiKey,
    "Content-Type": "application/json",
  };
}

async function recallFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RECALL_API_BASE}${path}`, {
    ...init,
    headers: { ...recallHeaders(), ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Recall.ai API error (${res.status}) en ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export interface RecallBot {
  id: string;
  meeting_url: { meeting_id?: string; platform?: string } | string;
  join_at: string | null;
  status_changes: { code: string; sub_code: string | null; created_at: string }[];
  recordings: { id: string }[];
}

export interface RecallRecording {
  id: string;
  media_shortcuts: {
    video_mixed?: { data?: { download_url?: string } };
    audio_mixed?: { data?: { download_url?: string } };
    participant_events?: {
      data?: {
        speaker_timeline_download_url?: string;
      };
    };
  };
}

export interface RecallSpeakerTimelineEntry {
  participant: {
    id: number;
    name: string | null;
    is_host: boolean;
  };
  // `null` cuando el evento quedó abierto (p. ej. la grabación terminó
  // mientras el participante seguía "hablando" y nunca se cerró el rango).
  start_timestamp: { relative: number } | null;
  end_timestamp: { relative: number } | null;
}

export interface CreateBotParams {
  /** URL de la reunión (Google Meet o Microsoft Teams). */
  meetingUrl: string;
  /** ISO 8601. Si se omite, el bot intenta unirse de inmediato. */
  joinAt?: string;
  botName?: string;
}

/**
 * Crea un bot de Recall.ai que se unirá a la reunión indicada. Recall.ai
 * detecta la plataforma (Google Meet o Microsoft Teams) a partir de
 * `meeting_url` automáticamente — no requiere ningún parámetro adicional ni
 * distinto entre plataformas para el flujo básico ("Teams Web bot", que se
 * une como invitado anónimo, igual que el bot de Meet). Ver nota en
 * lib/meeting-platform.ts sobre la validación de URLs que hace esta app.
 */
export async function createBot({
  meetingUrl,
  joinAt,
  botName,
}: CreateBotParams): Promise<RecallBot> {
  return recallFetch<RecallBot>("/bot/", {
    method: "POST",
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName ?? "Verbixa AI Notetaker",
      ...(joinAt ? { join_at: joinAt } : {}),
      // Se pide explícitamente un artefacto de audio dedicado (pipeline
      // separado del video_mixed) para diagnosticar/evitar problemas de
      // mezcla de audio en video_mixed.
      //
      // `participant_events` viene habilitado por defecto en Recall.ai,
      // pero especificar `recording_config` manualmente REEMPLAZA todo el
      // set por defecto en vez de extenderlo — sin este campo explícito,
      // Recall nunca genera el speaker_timeline_download_url y
      // getSpeakerTimeline()/resolveSpeakerNames() siempre caen al
      // fallback "Speaker N" (bug real, detectado porque las reuniones
      // seguían mostrando "Speaker 0" en vez del nombre real).
      recording_config: {
        audio_mixed_mp3: {},
        participant_events: {},
      },
    }),
  });
}

/** Consulta el estado actual de un bot. */
export async function getBot(botId: string): Promise<RecallBot> {
  return recallFetch<RecallBot>(`/bot/${botId}/`);
}

/** Devuelve la grabación más reciente de un bot, o null si aún no existe. */
async function getLatestRecording(botId: string): Promise<RecallRecording | null> {
  const bot = await getBot(botId);
  const recordingId = bot.recordings?.[0]?.id;
  if (!recordingId) return null;

  return recallFetch<RecallRecording>(`/recording/${recordingId}/`);
}

/**
 * Descarga la URL de la grabación de un bot una vez finalizada la reunión.
 * Devuelve null si el bot todavía no tiene ninguna grabación asociada.
 */
export async function getRecordingDownloadUrl(
  botId: string,
): Promise<string | null> {
  const recording = await getLatestRecording(botId);
  if (!recording) return null;

  return (
    // Se prioriza el artefacto de audio dedicado (mismo que solicitamos en
    // recording_config) sobre el audio muxeado dentro de video_mixed.
    recording.media_shortcuts.audio_mixed?.data?.download_url ??
    recording.media_shortcuts.video_mixed?.data?.download_url ??
    null
  );
}

/**
 * Obtiene el timeline de actividad de voz por participante (nombres reales
 * de los participantes) que Recall.ai genera junto con la grabación. Se usa para
 * mapear los índices numéricos de hablante que devuelve la diarización de
 * Deepgram (p. ej. "Speaker 0") a nombres reales.
 * Devuelve un array vacío si no está disponible.
 */
export async function getSpeakerTimeline(
  botId: string,
): Promise<RecallSpeakerTimelineEntry[]> {
  const recording = await getLatestRecording(botId);
  const url = recording?.media_shortcuts.participant_events?.data
    ?.speaker_timeline_download_url;
  if (!url) return [];

  const res = await fetch(url);
  if (!res.ok) return [];

  return res.json() as Promise<RecallSpeakerTimelineEntry[]>;
}
