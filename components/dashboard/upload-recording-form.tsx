"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Combine, FileAudio } from "lucide-react";

import {
  confirmBeforeUnload,
  UploadProgressOverlay,
  uploadRecording,
  type UploadStage,
} from "@/components/dashboard/upload-progress-overlay";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  useEffect(() => confirmBeforeUnload(isSubmitting), [isSubmitting]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Debes seleccionar un archivo de audio o video");
      return;
    }

    setStage("uploading");
    setProgress(0);

    try {
      const id = await uploadRecording(title, file, {
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
          {/* Herramientas externas para preparar el audio antes de subirlo. */}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href="https://www.online-convert.com/es"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <FileAudio />
              Convertir a MP3
            </a>
            <a
              href="https://cut.audio/es/unir-audios/"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Combine />
              Unir audios
            </a>
          </div>
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

      <UploadProgressOverlay stage={stage} progress={progress} />
    </>
  );
}
