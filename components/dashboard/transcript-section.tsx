"use client";

import { useState } from "react";

import { ExportTranscriptButton } from "@/components/dashboard/export-transcript-button";
import {
  TranscriptView,
  type DiarizedSegment,
} from "@/components/dashboard/transcript-view";

/**
 * Envuelve la transcripción y su botón de descarga para compartir el filtro
 * de hablante: así la descarga puede respetar el hablante seleccionado en la
 * vista.
 */
export function TranscriptSection({
  meetingId,
  segments,
}: {
  meetingId: string;
  segments: DiarizedSegment[];
}) {
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Transcripción</h2>
        <ExportTranscriptButton meetingId={meetingId} speaker={speakerFilter} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <TranscriptView
          segments={segments}
          onSpeakerFilterChange={setSpeakerFilter}
        />
      </div>
    </>
  );
}
