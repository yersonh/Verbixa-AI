"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MeetingStatus } from "@prisma/client";

const POLL_INTERVAL_MS = 4000;
// Tope de seguridad: si el acta nunca llega a generarse (falla silenciosa
// del summary-worker, que a propósito no marca el Meeting como FAILED), no
// tiene sentido seguir haciendo polling para siempre.
const MAX_POLLS = 150; // ~10 min a 4s por poll

interface MeetingStatusSnapshot {
  status: MeetingStatus;
  hasTranscript: boolean;
  hasSummary: boolean;
}

/**
 * No renderiza nada visible: mientras la reunión no haya "asentado" (bot
 * terminó Y ya hay acta, o falló), consulta /status cada pocos segundos y,
 * si detecta un cambio, dispara router.refresh() para que el Server
 * Component de la página vuelva a traer los datos frescos de Prisma — así
 * el badge de estado, la transcripción y el acta aparecen solos, sin que
 * el usuario tenga que recargar manualmente.
 */
export function MeetingLiveRefresher({
  meetingId,
  status,
  hasTranscript,
  hasSummary,
}: MeetingStatusSnapshot & { meetingId: string }) {
  const router = useRouter();
  const lastKnown = useRef<MeetingStatusSnapshot>({
    status,
    hasTranscript,
    hasSummary,
  });

  useEffect(() => {
    lastKnown.current = { status, hasTranscript, hasSummary };
  }, [status, hasTranscript, hasSummary]);

  const isSettled = status === MeetingStatus.FAILED || (status === MeetingStatus.COMPLETED && hasSummary);

  useEffect(() => {
    if (isSettled) return;

    let cancelled = false;
    let polls = 0;

    const timer = setInterval(async () => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(timer);
        return;
      }

      try {
        const res = await fetch(`/api/meetings/${meetingId}/status`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;

        const data: MeetingStatusSnapshot = await res.json();
        const prev = lastKnown.current;
        const changed =
          data.status !== prev.status ||
          data.hasTranscript !== prev.hasTranscript ||
          data.hasSummary !== prev.hasSummary;

        if (changed && !cancelled) {
          router.refresh();
        }
      } catch {
        // Un poll fallido no es motivo para detener el intervalo; se
        // reintenta en el siguiente tick.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [meetingId, isSettled, router]);

  return null;
}
