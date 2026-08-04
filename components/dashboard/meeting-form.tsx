"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { detectMeetingPlatform } from "@/lib/meeting-platform";

export function MeetingForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!detectMeetingPlatform(meetingUrl)) {
      setError(
        "El enlace debe ser de Google Meet (meet.google.com) o Microsoft Teams (teams.microsoft.com / teams.live.com)",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          meetingUrl,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "No se pudo agendar la reunión. Intenta de nuevo.");
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
        <label htmlFor="title" className="text-sm font-medium">
          Título de la reunión
        </label>
        <Input
          id="title"
          type="text"
          placeholder="Ej. Sync semanal de producto"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="meetingUrl" className="text-sm font-medium">
          Enlace de la reunión
        </label>
        <Input
          id="meetingUrl"
          type="url"
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
          value={meetingUrl}
          onChange={(event) => setMeetingUrl(event.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Se admiten enlaces de Google Meet y Microsoft Teams.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="scheduledAt" className="text-sm font-medium">
          Fecha y hora
        </label>
        <Input
          id="scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
          required
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Agendando..." : "Agendar reunión"}
      </Button>
    </form>
  );
}
