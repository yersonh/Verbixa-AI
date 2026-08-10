"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CircleOff,
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";

const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.75] as const;
const BAR_COUNT = 56;

/** PRNG determinista (mulberry32) para que las barras del visualizador sean
 * siempre las mismas para una misma reunión, en vez de "saltar" en cada
 * render. */
function seededBarHeights(seed: string, count: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  let state = h || 1;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, () => 0.25 + next() * 0.75);
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MeetingRecordingPlayer({
  meetingId,
  mediaType,
}: {
  meetingId: string;
  mediaType: "audio" | "video";
}) {
  const src = `/api/meetings/${meetingId}/recording`;
  const downloadHref = `${src}?download=1`;

  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);
  const [muted, setMuted] = useState(false);

  const barHeights = useMemo(
    () => seededBarHeights(meetingId, BAR_COUNT),
    [meetingId],
  );

  useEffect(() => {
    setStatus("loading");
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [meetingId]);

  function togglePlay() {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      media.play();
    } else {
      media.pause();
    }
  }

  function seekTo(fraction: number) {
    const media = mediaRef.current;
    if (!media || !duration) return;
    media.currentTime = Math.min(Math.max(fraction, 0), 1) * duration;
  }

  function skip(deltaSeconds: number) {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = Math.min(
      Math.max(media.currentTime + deltaSeconds, 0),
      duration || media.currentTime,
    );
  }

  function cycleRate() {
    const nextIndex = (rateIndex + 1) % PLAYBACK_RATES.length;
    setRateIndex(nextIndex);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = PLAYBACK_RATES[nextIndex];
    }
  }

  function toggleMute() {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = !media.muted;
    setMuted(media.muted);
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  const mediaElement =
    mediaType === "video" ? (
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        src={src}
        className={cn(
          "w-full rounded-xl border border-border bg-black",
          status !== "ready" && "hidden",
        )}
        controls
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setStatus("ready");
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setStatus("error")}
      />
    ) : (
      <audio
        ref={mediaRef as React.RefObject<HTMLAudioElement>}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setStatus("ready");
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setStatus("error")}
      />
    );

  if (status === "error") {
    return (
      <>
        {mediaElement}
        <EmptyState
          icon={CircleOff}
          message="La grabación ya no está disponible. Puede haber expirado su periodo de retención."
          className="min-h-[160px]"
        />
      </>
    );
  }

  if (mediaType === "video") {
    return (
      <div className="flex flex-col gap-3">
        {status === "loading" && (
          <div className="flex aspect-video w-full animate-pulse items-center justify-center rounded-xl border border-border bg-muted">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {mediaElement}
        <a
          href={downloadHref}
          className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          <Download className="size-3.5" />
          Descargar grabación
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-primary/[0.03] p-4">
      {mediaElement}

      <div className="flex items-center gap-3 sm:gap-4">
        <motion.button
          type="button"
          onClick={togglePlay}
          disabled={status === "loading"}
          whileTap={{ scale: 0.92 }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-opacity disabled:opacity-50"
        >
          {status === "loading" ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-4.5 fill-current" />
          ) : (
            <Play className="size-4.5 fill-current pl-0.5" />
          )}
        </motion.button>

        {/* Visualizador: barras decorativas (no representan la amplitud
            real del audio) que se iluminan según el progreso de
            reproducción y sirven como barra de búsqueda al hacer clic. */}
        <button
          type="button"
          aria-label="Buscar en la grabación"
          disabled={status === "loading"}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - rect.left) / rect.width);
          }}
          className="flex h-11 flex-1 items-center gap-[2px] disabled:opacity-40"
        >
          {barHeights.map((h, i) => {
            const barProgress = i / BAR_COUNT;
            const active = barProgress <= progress;
            return (
              <motion.span
                key={i}
                className={cn(
                  "w-full min-w-[2px] rounded-full",
                  active ? "bg-primary" : "bg-muted-foreground/25",
                )}
                animate={{
                  height: `${h * 100}%`,
                  opacity:
                    isPlaying && active && barProgress > progress - 0.02
                      ? [1, 0.6, 1]
                      : 1,
                }}
                transition={{
                  height: { duration: 0.2 },
                  opacity: { duration: 0.6, repeat: Infinity },
                }}
              />
            );
          })}
        </button>

        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => skip(-10)}
            aria-label="Retroceder 10 segundos"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => skip(10)}
            aria-label="Adelantar 10 segundos"
          >
            <RotateCw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-xs tabular-nums"
            onClick={cycleRate}
          >
            {PLAYBACK_RATES[rateIndex]}x
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleMute}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<a href={downloadHref} aria-label="Descargar grabación" />}
          >
            <Download className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
