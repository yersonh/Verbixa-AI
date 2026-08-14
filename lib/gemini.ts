import { GoogleGenAI, Type } from "@google/genai";
import type { DiarizedSegment } from "@/lib/deepgram";

export type { DiarizedSegment };

export interface MeetingMinutesTask {
  description: string;
  assignee: string | null;
  dueDate: string | null; // formato "YYYY-MM-DD" o null
}

export interface MeetingMinutes {
  executiveSummary: string;
  keyDecisions: string[];
  conclusions: string;
  tasks: MeetingMinutesTask[];
}

const PROMPT_TEMPLATE = `Eres un asistente que documenta reuniones corporativas. Recibirás la transcripción
completa de una reunión, con cada intervención marcada por hablante y marca de tiempo.

Tu tarea es generar un acta estructurada en formato JSON siguiendo EXACTAMENTE este esquema:

{
  "executiveSummary": "string (ver regla 6 sobre extensión)",
  "keyDecisions": ["string", "string", ...],
  "conclusions": "string (ver regla 7)",
  "tasks": [
    {
      "description": "string (qué hay que hacer, en forma de acción clara)",
      "assignee": "string o null (nombre del hablante responsable, solo si se mencionó explícitamente)",
      "dueDate": "string en formato YYYY-MM-DD o null (solo si se mencionó una fecha específica)"
    }
  ]
}

REGLAS IMPORTANTES:
1. Solo incluye decisiones que se mencionaron explícitamente como acordadas o aprobadas
   en la transcripción. No infieras decisiones que no se dijeron con claridad.
2. Solo asigna una tarea a una persona si su nombre fue mencionado explícitamente en
   relación a esa tarea. Si no está claro quién la hará, usa null en "assignee".
3. Solo incluye una fecha límite si se mencionó una fecha o plazo específico
   (ej. "para el viernes", "antes del 15"). Si no se mencionó, usa null en "dueDate".
4. Si la reunión no tuvo decisiones claras o tareas asignadas, devuelve arreglos vacíos
   en lugar de inventar contenido.
5. El resumen ejecutivo y las conclusiones deben ser neutrales y factuales, sin
   opiniones ni suposiciones.
6. Extensión de "executiveSummary": debe tener 3 párrafos (separados por \\n\\n) SOLO
   si la transcripción tiene contenido suficiente para sostenerlos sin relleno ni
   repetición (en la práctica, reuniones de más de ~20 minutos o con varios temas
   tratados). Si la reunión es corta o tiene poco contenido (p. ej. una prueba de un
   minuto), usa 1-2 oraciones en un solo párrafo en lugar de forzar 3 párrafos vacíos
   de contenido real.
7. "conclusions": un cierre breve (1-2 oraciones, o un párrafo corto si el contenido lo
   amerita) con el balance final o próximos pasos generales de la reunión, distinto del
   resumen ejecutivo. Si no hay contenido suficiente para una conclusión real, usa una
   frase breve que indique que la reunión fue demasiado breve para extraer conclusiones.
8. Responde ÚNICAMENTE con el JSON, sin texto adicional antes o después, sin markdown,
   sin \`\`\`json.

TRANSCRIPCIÓN:
{{transcript_with_speakers_and_timestamps}}`;

const MEETING_MINUTES_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { type: Type.STRING },
    keyDecisions: { type: Type.ARRAY, items: { type: Type.STRING } },
    conclusions: { type: Type.STRING },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          assignee: { type: Type.STRING, nullable: true },
          dueDate: { type: Type.STRING, nullable: true },
        },
        required: ["description", "assignee", "dueDate"],
      },
    },
  },
  required: ["executiveSummary", "keyDecisions", "conclusions", "tasks"],
};

/**
 * Formatea segundos como mm:ss (sin librería de fechas).
 */
function formatTimestamp(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Convierte los segmentos diarizados en un bloque de texto legible para
 * inyectar en el prompt, con formato "Hablante: [mm:ss] texto".
 */
export function formatTranscriptForPrompt(segments: DiarizedSegment[]): string {
  return segments
    .map((s) => `${s.speaker}: [${formatTimestamp(s.startTime)}] ${s.text}`)
    .join("\n");
}

/**
 * Crea un cliente de Gemini nuevo cada vez (sin singleton a nivel de módulo)
 * para evitar efectos secundarios en tiempo de import/build. Se exporta para
 * que otros módulos (p. ej. el de chunking map-reduce) puedan reutilizar la
 * misma configuración de cliente sin duplicar la validación de API key.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada");

  return new GoogleGenAI({ apiKey });
}

/**
 * Genera un acta estructurada (resumen ejecutivo, decisiones y tareas) a
 * partir de un texto de transcripción ya formateado. No formatea el texto
 * por sí misma: el llamador decide si pasa la transcripción completa
 * formateada o una versión condensada (map-reduce) de un módulo de chunking.
 */
export async function generateMeetingMinutes(
  transcriptText: string,
): Promise<MeetingMinutes> {
  const client = getGeminiClient();

  const prompt = PROMPT_TEMPLATE.replace(
    "{{transcript_with_speakers_and_timestamps}}",
    transcriptText,
  );

  let response;
  try {
    response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: MEETING_MINUTES_RESPONSE_SCHEMA,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini API error al generar el acta de la reunión: ${message}`, {
      cause: err,
    });
  }

  const text = response.text;
  if (text === undefined) {
    throw new Error(
      "Gemini API no devolvió texto en la respuesta al generar el acta de la reunión",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `No se pudo parsear la respuesta JSON de Gemini al generar el acta de la reunión: ${message}`,
      { cause: err },
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as MeetingMinutes).executiveSummary !== "string" ||
    !Array.isArray((parsed as MeetingMinutes).keyDecisions) ||
    typeof (parsed as MeetingMinutes).conclusions !== "string" ||
    !Array.isArray((parsed as MeetingMinutes).tasks)
  ) {
    throw new Error(
      "La respuesta de Gemini no tiene la forma esperada de MeetingMinutes (executiveSummary/keyDecisions/conclusions/tasks)",
    );
  }

  return parsed as MeetingMinutes;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const CHAT_SYSTEM_INSTRUCTION = `Eres un asistente que responde preguntas sobre una reunión corporativa
específica, usando ÚNICAMENTE la transcripción de esa reunión que se te
proporciona a continuación como contexto.

Reglas:
1. Responde solo con información que esté presente en la transcripción. Si la
   pregunta no se puede responder con la transcripción, dilo explícitamente
   en vez de inventar una respuesta.
2. Responde en español, de forma clara y concisa.
3. Puedes citar quién dijo algo (usando las etiquetas de hablante) y en qué
   momento aproximado (marca de tiempo), si es relevante para la respuesta.
4. No repitas la transcripción completa; responde directamente a la pregunta.

TRANSCRIPCIÓN DE LA REUNIÓN:
{{transcript}}`;

/**
 * Responde una pregunta sobre una reunión en streaming, usando la
 * transcripción como contexto (vía systemInstruction) y el historial previo
 * de la conversación como turnos de chat multi-turno.
 */
export async function streamMeetingChatAnswer(
  transcriptText: string,
  history: ChatTurn[],
  question: string,
): Promise<AsyncGenerator<string>> {
  const client = getGeminiClient();

  const systemInstruction = CHAT_SYSTEM_INSTRUCTION.replace(
    "{{transcript}}",
    transcriptText,
  );

  const contents = [
    ...history.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];

  let stream: Awaited<ReturnType<typeof client.models.generateContentStream>>;
  try {
    stream = await client.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: { systemInstruction },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini API error al responder la pregunta: ${message}`, {
      cause: err,
    });
  }

  async function* textChunks() {
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  }

  return textChunks();
}
