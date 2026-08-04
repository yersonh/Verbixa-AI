import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { prisma } from "@/lib/prisma";

export default async function TranscriptsPage() {
  const { orgId } = await auth();

  const organization = orgId
    ? await prisma.organization.findUnique({ where: { clerkOrgId: orgId } })
    : null;

  if (!organization) {
    notFound();
  }

  const transcripts = await prisma.transcript.findMany({
    where: { meeting: { organizationId: organization.id } },
    include: { meeting: true },
    orderBy: { meeting: { scheduledAt: "desc" } },
  });

  const dateFormatter = new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Transcripciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Transcripciones generadas a partir de tus reuniones grabadas.
        </p>
      </div>

      {transcripts.length === 0 ? (
        <EmptyState
          icon={FileText}
          message="Todavía no hay transcripciones disponibles."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {transcripts.map((transcript) => (
            <Link
              key={transcript.id}
              href={`/dashboard/meetings/${transcript.meeting.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{transcript.meeting.title}</span>
                <span className="text-sm text-muted-foreground">
                  {dateFormatter.format(transcript.meeting.scheduledAt)}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {transcript.rawText}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
