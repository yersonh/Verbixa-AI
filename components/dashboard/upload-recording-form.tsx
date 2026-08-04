"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UploadRecordingForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Debes seleccionar un archivo de audio o video");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("file", file);

      const response = await fetch("/api/meetings/upload", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "No se pudo subir la grabación. Intenta de nuevo.");
        setIsSubmitting(false);
        return;
      }

      router.push(`/dashboard/meetings/${data.id}`);
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setIsSubmitting(false);
    }
  }

  return (
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
  );
}
