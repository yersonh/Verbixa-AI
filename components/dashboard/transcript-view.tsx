"use client";

import { useMemo, useState } from "react";

export interface DiarizedSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface SpeakerPalette {
  bubble: string;
  avatar: string;
  name: string;
}

const SPEAKER_PALETTES: SpeakerPalette[] = [
  {
    bubble: "bg-blue-500/10 border-blue-500/20",
    avatar: "bg-blue-500 text-white",
    name: "text-blue-400",
  },
  {
    bubble: "bg-emerald-500/10 border-emerald-500/20",
    avatar: "bg-emerald-500 text-white",
    name: "text-emerald-400",
  },
  {
    bubble: "bg-amber-500/10 border-amber-500/20",
    avatar: "bg-amber-500 text-white",
    name: "text-amber-400",
  },
  {
    bubble: "bg-fuchsia-500/10 border-fuchsia-500/20",
    avatar: "bg-fuchsia-500 text-white",
    name: "text-fuchsia-400",
  },
  {
    bubble: "bg-cyan-500/10 border-cyan-500/20",
    avatar: "bg-cyan-500 text-white",
    name: "text-cyan-400",
  },
  {
    bubble: "bg-rose-500/10 border-rose-500/20",
    avatar: "bg-rose-500 text-white",
    name: "text-rose-400",
  },
];

function paletteForSpeaker(speaker: string, speakerOrder: string[]): SpeakerPalette {
  const index = speakerOrder.indexOf(speaker);
  return SPEAKER_PALETTES[index % SPEAKER_PALETTES.length];
}

function initialsForSpeaker(speaker: string): string {
  const match = speaker.match(/(\d+)/);
  if (match) {
    return `S${match[1]}`;
  }
  return speaker.slice(0, 2).toUpperCase();
}

function formatTimestamp(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const totalSeconds = Math.floor(safeSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface SegmentGroup {
  speaker: string;
  segments: DiarizedSegment[];
}

function groupConsecutiveSegments(segments: DiarizedSegment[]): SegmentGroup[] {
  const groups: SegmentGroup[] = [];

  for (const segment of segments) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.speaker === segment.speaker) {
      lastGroup.segments.push(segment);
    } else {
      groups.push({ speaker: segment.speaker, segments: [segment] });
    }
  }

  return groups;
}

export function TranscriptView({ segments }: { segments: DiarizedSegment[] }) {
  const speakerOrder = useMemo(
    () => Array.from(new Set(segments.map((s) => s.speaker))),
    [segments],
  );
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);

  if (!segments || segments.length === 0) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">Sin contenido.</p>
      </div>
    );
  }

  const filteredSegments = speakerFilter
    ? segments.filter((s) => s.speaker === speakerFilter)
    : segments;
  const groups = groupConsecutiveSegments(filteredSegments);

  return (
    <div className="flex flex-col gap-4">
      {speakerOrder.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSpeakerFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              speakerFilter === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            Todos
          </button>
          {speakerOrder.map((speaker) => {
            const palette = paletteForSpeaker(speaker, speakerOrder);
            const isActive = speakerFilter === speaker;
            return (
              <button
                key={speaker}
                type="button"
                onClick={() => setSpeakerFilter(speaker)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? `${palette.avatar} border-transparent`
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {speaker}
              </button>
            );
          })}
        </div>
      )}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Este hablante no tiene intervenciones.
        </p>
      )}

      {groups.map((group, groupIndex) => {
        const palette = paletteForSpeaker(group.speaker, speakerOrder);

        return (
          <div key={groupIndex} className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${palette.avatar}`}
              aria-hidden="true"
            >
              {initialsForSpeaker(group.speaker)}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={`text-sm font-medium ${palette.name}`}>
                {group.speaker}
              </span>

              <div className="flex flex-col gap-1">
                {group.segments.map((segment, segmentIndex) => (
                  <div
                    key={segmentIndex}
                    className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-3 py-2 ${palette.bubble}`}
                  >
                    <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
                      {segment.text}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums">
                      {formatTimestamp(segment.startTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
