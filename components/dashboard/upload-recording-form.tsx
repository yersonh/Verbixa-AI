"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UploadStage = "idle" | "uploading" | "processing";

const STAGE_MESSAGES: Record<Exclude<UploadStage, "idle">, string> = {
  uploading: "Subiendo grabación…",
  processing: "Preparando la transcripción…",
};

function parseUploadResponse(responseText: string): { id?: string; error?: string } {
  try {
    const parsed: unknown = JSON.parse(responseText);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as { id?: string; error?: string };
    }
  } catch {
    // Respuesta no era JSON (p. ej. un 502 del proxy); se maneja como error genérico.
  }
  return {};
}

export function UploadRecordingForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = stage !== "idle";

  // Evita que el usuario cierre o recargue la pestaña a mitad de una subida
  // grande (puede tardar varios minutos) sin darse cuenta de que va a
  // perder la subida en curso.
  useEffect(() => {
    if (!isSubmitting) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSubmitting]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Debes seleccionar un archivo de audio o video");
      return;
    }

    setStage("uploading");
    setProgress(0);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/meetings/upload");
    xhr.withCredentials = true;

    // fetch() no expone progreso de subida; XHR sí, vía este evento. Se
    // necesita para la barra de progreso del overlay de carga.
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.upload.onload = () => {
      // El archivo ya llegó al servidor; de aquí en adelante el tiempo de
      // espera es el servidor guardando el archivo y encolando el job, no
      // más transferencia de red.
      setStage("processing");
    };

    xhr.onload = () => {
      const data = parseUploadResponse(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300 && data.id) {
        router.push(`/dashboard/meetings/${data.id}`);
        return;
      }

      setError(data.error ?? "No se pudo subir la grabación. Intenta de nuevo.");
      setStage("idle");
    };

    xhr.onerror = () => {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setStage("idle");
    };

    xhr.send(formData);
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex max-w-lg flex-col gap-5 rounded-xl border border-border bg-card p-6"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="upload-title" className="text-sm font-medium">
            Título de la reunión
          </label>
          <Input
            id="upload-title"
            type="text"
            placeholder="Ej. Sync semanal de producto"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="upload-file" className="text-sm font-medium">
            Archivo de audio o video
          </label>
          <Input
            id="upload-file"
            type="file"
            accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.webm,.mkv,.avi"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={isSubmitting}
            required
          />
          <p className="text-xs text-muted-foreground">
            Formatos soportados: mp3, wav, m4a, aac, ogg, flac, mp4, mov, webm,
            mkv, avi. Tamaño máximo: 500 MB.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Subiendo..." : "Subir grabación"}
        </Button>
      </form>

      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex w-full max-w-sm flex-col items-center gap-5 rounded-xl border border-border bg-card p-8 text-center shadow-lg"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <Loader2 className="size-8 animate-spin text-primary" />

              <div className="flex flex-col gap-1">
                <p className="font-medium">{STAGE_MESSAGES[stage]}</p>
                <p className="text-sm text-muted-foreground">
                  No cierres ni recargues esta ventana, el sistema sigue
                  trabajando.
                </p>
              </div>

              {stage === "uploading" && (
                <div className="flex w-full flex-col gap-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "easeOut", duration: 0.2 }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {progress}%
                  </span>
                </div>
              )}

              {stage === "processing" && (
                <motion.div
                  className="text-xs text-muted-foreground"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  Guardando el archivo y preparando la transcripción…
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
