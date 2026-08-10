import path from "path";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { MeetingSource, MeetingStatus } from "@prisma/client";
import { FileText, ScrollText } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { MeetingMinutes } from "@/components/dashboard/meeting-minutes";
import { MeetingPlatformBadge } from "@/components/dashboard/meeting-platform-badge";
import { MeetingStatusBadge } from "@/components/dashboard/meeting-status-badge";
import { MeetingProcessingState } from "@/components/dashboard/meeting-processing-state";
import { MeetingRecordingPlayer } from "@/components/dashboard/meeting-recording-player";
import { ExportPdfButton } from "@/components/dashboard/export-pdf-button";
import { MeetingChatDrawer } from "@/components/dashboard/meeting-chat-drawer";
import {
  TranscriptView,
  type DiarizedSegment,
} from "@/components/dashboard/transcript-view";
import { detectMeetingPlatform } from "@/lib/meeting-platform";
import { prisma } from "@/lib/prisma";

const IN_PROGRESS_STATUSES: MeetingStatus[] = [
  MeetingStatus.JOINING,
  MeetingStatus.RECORDING,
  MeetingStatus.PROCESSING,
];

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi"]);

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { orgId } = await auth();

  const organization = orgId
    ? await prisma.organization.findUnique({ where: { clerkOrgId: orgId } })
    : null;

  if (!organization) {
    notFound();
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id, organizationId: organization.id },
  });

  if (!meeting) {
    notFound();
  }

  const transcript = await prisma.transcript.findUnique({
    where: { meetingId: meeting.id },
  });

  const summary = await prisma.summary.findUnique({
    where: { meetingId: meeting.id },
    include: { tasks: true },
  });

  const chatMessages = transcript
    ? await prisma.meetingChatMessage.findMany({
        where: { meetingId: meeting.id },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, email: true } } },
      })
    : [];

  const formattedDate = new Intl.DateTimeFormat("es", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(meeting.scheduledAt);

  const isInProgress = IN_PROGRESS_STATUSES.includes(meeting.status);
  const platform = meeting.meetingUrl
    ? detectMeetingPlatform(meeting.meetingUrl)
    : null;

  // Los bots de Recall.ai solo generan audio (audio_mixed_mp3); solo los
  // archivos subidos por el usuario pueden ser video.
  const recordingMediaType: "audio" | "video" =
    meeting.source === MeetingSource.UPLOAD &&
    VIDEO_EXTENSIONS.has(path.extname(meeting.recordingUrl ?? "").toLowerCase())
      ? "video"
      : "audio";

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {meeting.title}
          </h1>
          <p className="text-sm text-muted-foreground">{formattedDate}</p>
        </div>

        {summary && <ExportPdfButton meetingId={meeting.id} />}
      </div>

      <div data-tour="meeting-info" className="rounded-xl border border-border bg-card p-4">
        <dl className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">Estado</dt>
            <dd>
              <MeetingStatusBadge status={meeting.status} />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">
              Fecha y hora
            </dt>
            <dd className="text-sm">{formattedDate}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">Origen</dt>
            <dd className="text-sm">
              {meeting.source === MeetingSource.UPLOAD
                ? "Archivo subido"
                : "Bot de Recall.ai"}
            </dd>
          </div>
          {platform ? (
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">Plataforma</dt>
              <dd>
                <MeetingPlatformBadge platform={platform} />
              </dd>
            </div>
          ) : null}
          {meeting.meetingUrl ? (
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">
                Enlace de la reunión
              </dt>
              <dd className="text-sm">
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:opacity-80"
                >
                  {meeting.meetingUrl}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {meeting.recordingUrl && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Grabación</h2>
          <MeetingRecordingPlayer
            meetingId={meeting.id}
            mediaType={recordingMediaType}
          />
        </div>
      )}

      <div data-tour="meeting-transcript" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Transcripción
        </h2>

        {transcript ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <TranscriptView
              segments={transcript.segments as unknown as DiarizedSegment[]}
            />
          </div>
        ) : isInProgress ? (
          <MeetingProcessingState status={meeting.status} />
        ) : (
          <EmptyState
            icon={FileText}
            message="La transcripción todavía no está disponible."
            className="min-h-[160px]"
          />
        )}
      </div>

      <div data-tour="meeting-summary" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Acta</h2>

        {summary ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <MeetingMinutes summary={summary} />
          </div>
        ) : isInProgress ? (
          <MeetingProcessingState status={meeting.status} />
        ) : (
          <EmptyState
            icon={ScrollText}
            message="El acta se genera automáticamente después de la transcripción. Todavía no está lista."
            className="min-h-[160px]"
          />
        )}
      </div>

      {transcript && (
        <MeetingChatDrawer meetingId={meeting.id} initialMessages={chatMessages} />
      )}
    </div>
  );
}
