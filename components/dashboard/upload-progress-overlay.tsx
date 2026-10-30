"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export type UploadStage = "idle" | "uploading" | "processing";

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

/**
 * Sube una grabación a /api/meetings/upload y resuelve con el id de la
 * reunión creada. Compartido por el formulario de subida y el de grabación
 * en vivo.
 */
export function uploadRecording(
  title: string,
  file: File,
  handlers: { onProgress: (percent: number) => void; onUploaded: () => void },
): Promise<string> {
  const formData = new FormData();
  formData.set("title", title);
  formData.set("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/meetings/upload");
    xhr.withCredentials = true;

    // fetch() no expone progreso de subida; XHR sí, vía este evento. Se
    // necesita para la barra de progreso del overlay de carga.
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        handlers.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    // El archivo ya llegó al servidor; de aquí en adelante el tiempo de
    // espera es el servidor guardando el archivo y encolando el job, no
    // más transferencia de red.
    xhr.upload.onload = handlers.onUploaded;

    xhr.onload = () => {
      const data = parseUploadResponse(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300 && data.id) {
        resolve(data.id);
        return;
      }

      reject(new Error(data.error ?? "No se pudo subir la grabación. Intenta de nuevo."));
    };

    xhr.onerror = () => {
      reject(new Error("No se pudo conectar con el servidor. Intenta de nuevo."));
    };

    xhr.send(formData);
  });
}

export function UploadProgressOverlay({
  stage,
  progress,
}: {
  stage: UploadStage;
  progress: number;
}) {
  return (
    <AnimatePresence>
      {stage !== "idle" && (
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
  );
}

/** Pide confirmación al cerrar/recargar la pestaña mientras `active` sea true. */
export function confirmBeforeUnload(active: boolean) {
  if (!active) return;

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    event.preventDefault();
    event.returnValue = "";
  }

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}
