"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";

import {
  confirmBeforeUnload,
  UploadProgressOverlay,
  uploadRecording,
  type UploadStage,
} from "@/components/dashboard/upload-progress-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RecorderState = "idle" | "recording" | "paused" | "stopped";

// Formatos en orden de preferencia. Chrome/Firefox graban webm/opus; Safari
// solo soporta audio/mp4. Se usan .weba/.m4a (no .webm/.mp4) para que el
// reproductor de la reunión lo trate como audio y no como video.
const RECORDING_FORMATS = [
  { mimeType: "audio/webm;codecs=opus", ext: ".weba" },
  { mimeType: "audio/webm", ext: ".weba" },
  { mimeType: "audio/ogg;codecs=opus", ext: ".ogg" },
  { mimeType: "audio/mp4", ext: ".m4a" },
];

// ~29 MB por hora de grabación: deja margen de sobra bajo el límite de
// 500 MB de /api/meetings/upload y es suficiente para transcribir voz.
const AUDIO_BITS_PER_SECOND = 64_000;

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

export function RecordMeetingForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [includeTabAudio, setIncludeTabAudio] = useState(false);
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const isSubmitting = stage !== "idle";
  const isCapturing = recorderState === "recording" || recorderState === "paused";

  // Mientras se graba o hay una grabación sin subir, cerrar la pestaña
  // significaría perderla.
  useEffect(
    () => confirmBeforeUnload(isCapturing || recorderState === "stopped" || isSubmitting),
    [isCapturing, recorderState, isSubmitting],
  );

  useEffect(() => {
    if (recorderState !== "recording") return;
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [recorderState]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Al salir de la página se libera el micrófono / la pestaña compartida.
  useEffect(() => releaseDevices, []);

  function releaseDevices() {
    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamsRef.current = [];
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  async function buildInputStream(): Promise<MediaStream> {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    streamsRef.current.push(micStream);

    if (!includeTabAudio) return micStream;

    // Para reuniones virtuales: el micrófono solo capta la voz propia, así
    // que se pide además compartir la pestaña/pantalla de la reunión con su
    // audio. Chrome exige pedir video para getDisplayMedia; solo se usa el
    // audio.
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    streamsRef.current.push(displayStream);

    if (displayStream.getAudioTracks().length === 0) {
      throw new Error(
        'No se compartió audio. Al elegir la pestaña o pantalla, activa la opción "Compartir audio".',
      );
    }

    // Se mezclan ambas fuentes en una sola pista para que MediaRecorder grabe
    // las dos voces.
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const destination = audioContext.createMediaStreamDestination();
    audioContext.createMediaStreamSource(micStream).connect(destination);
    audioContext.createMediaStreamSource(displayStream).connect(destination);
    return destination.stream;
  }

  async function startRecording() {
    setError(null);

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      setError("Tu navegador no permite grabar audio. Prueba con Chrome, Edge o Firefox.");
      return;
    }

    const format = RECORDING_FORMATS.find((f) => MediaRecorder.isTypeSupported(f.mimeType));
    if (!format) {
      setError("Tu navegador no soporta ningún formato de grabación compatible.");
      return;
    }

    let inputStream: MediaStream;
    try {
      inputStream = await buildInputStream();
    } catch (err) {
      releaseDevices();
      const name = (err as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Se negó el permiso para usar el micrófono o compartir la pestaña."
          : name === "NotFoundError"
            ? "No se encontró ningún micrófono."
            : (err as Error).message,
      );
      return;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(inputStream, {
      mimeType: format.mimeType,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      releaseDevices();
      const blob = new Blob(chunks, { type: format.mimeType });
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      setRecording(new File([blob], `grabacion-${stamp}${format.ext}`, { type: format.mimeType }));
      setPreviewUrl(URL.createObjectURL(blob));
      setRecorderState("stopped");
    };

    recorderRef.current = recorder;
    // Se emite un trozo cada segundo para no perder todo si algo falla al final.
    recorder.start(1000);
    setElapsed(0);
    setRecorderState("recording");
  }

  function togglePause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setRecorderState("paused");
    } else if (recorder.state === "paused") {
      recorder.resume();
      setRecorderState("recording");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function discardRecording() {
    setRecording(null);
    setPreviewUrl(null);
    setElapsed(0);
    setRecorderState("idle");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!recording) {
      setError("Primero graba la reunión");
      return;
    }

    setStage("uploading");
    setProgress(0);

    try {
      const id = await uploadRecording(title, recording, {
        onProgress: setProgress,
        onUploaded: () => setStage("processing"),
      });
      router.push(`/dashboard/meetings/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setStage("idle");
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex max-w-lg flex-col gap-5 rounded-xl border border-border bg-card p-6"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="record-title" className="text-sm font-medium">
            Título de la reunión
          </label>
          <Input
            id="record-title"
            type="text"
            placeholder="Ej. Reunión de equipo en sala"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={includeTabAudio}
            onChange={(event) => setIncludeTabAudio(event.target.checked)}
            disabled={recorderState !== "idle"}
          />
          <span>
            Incluir el audio de una pestaña o pantalla
            <span className="block text-xs text-muted-foreground">
              Para reuniones virtuales (Meet, Teams, Zoom en el navegador):
              graba también lo que dicen los demás participantes. Al compartir,
              activa &quot;Compartir audio&quot;.
            </span>
          </span>
        </label>

        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-6">
          <div className="flex items-center gap-2">
            {recorderState === "recording" && (
              <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
            )}
            <span className="text-3xl font-semibold tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {recorderState === "idle" && "Listo para grabar"}
            {recorderState === "recording" && "Grabando…"}
            {recorderState === "paused" && "En pausa"}
            {recorderState === "stopped" && "Grabación finalizada. Escúchala antes de enviarla."}
          </p>

          {recorderState === "idle" && (
            <Button type="button" onClick={startRecording} disabled={isSubmitting}>
              <Mic />
              Iniciar grabación
            </Button>
          )}

          {isCapturing && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" onClick={togglePause}>
                {recorderState === "paused" ? <Play /> : <Pause />}
                {recorderState === "paused" ? "Reanudar" : "Pausar"}
              </Button>
              <Button type="button" variant="destructive" onClick={stopRecording}>
                <Square />
                Detener
              </Button>
            </div>
          )}

          {recorderState === "stopped" && previewUrl && (
            <div className="flex w-full flex-col items-center gap-3">
              <audio controls src={previewUrl} className="w-full" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={discardRecording}
                disabled={isSubmitting}
              >
                <Trash2 />
                Descartar y grabar de nuevo
              </Button>
            </div>
          )}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting || recorderState !== "stopped"}
          className="self-start"
        >
          {isSubmitting ? "Subiendo..." : "Transcribir grabación"}
        </Button>
      </form>

      <UploadProgressOverlay stage={stage} progress={progress} />
    </>
  );
}
