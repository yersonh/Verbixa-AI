import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Search, SearchX } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

const SNIPPET_RADIUS = 60;

function buildSnippet(text: string, query: string) {
  const matchIndex = text.toLowerCase().indexOf(query.toLowerCase());

  if (matchIndex === -1) {
    const plain = text.slice(0, SNIPPET_RADIUS * 2);
    return {
      before: plain + (text.length > plain.length ? "…" : ""),
      match: "",
      after: "",
    };
  }

  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(
    text.length,
    matchIndex + query.length + SNIPPET_RADIUS
  );

  const before =
    (start > 0 ? "…" : "") + text.slice(start, matchIndex);
  const match = text.slice(matchIndex, matchIndex + query.length);
  const after =
    text.slice(matchIndex + query.length, end) +
    (end < text.length ? "…" : "");

  return { before, match, after };
}

function Snippet({ text, query }: { text: string; query: string }) {
  const { before, match, after } = buildSnippet(text, query);

  return (
    <p className="text-sm text-muted-foreground">
      {before}
      {match && (
        <span className="bg-yellow-500/30 text-foreground">{match}</span>
      )}
      {after}
    </p>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const { orgId } = await auth();

  const organization = orgId
    ? await prisma.organization.findUnique({ where: { clerkOrgId: orgId } })
    : null;

  if (!organization) {
    notFound();
  }

  const hasQuery = query.length > 0;

  const [transcriptMatches, summaryMatches] = hasQuery
    ? await Promise.all([
        prisma.transcript.findMany({
          where: {
            rawText: { contains: query, mode: "insensitive" },
            meeting: { organizationId: organization.id },
          },
          include: { meeting: true },
          take: 20,
        }),
        prisma.summary.findMany({
          where: {
            executiveSummary: { contains: query, mode: "insensitive" },
            meeting: { organizationId: organization.id },
          },
          include: { meeting: true },
          take: 20,
        }),
      ])
    : [[], []];

  const results = [
    ...transcriptMatches.map((match) => ({
      key: `transcript-${match.id}`,
      meeting: match.meeting,
      label: "Transcripción",
      text: match.rawText,
    })),
    ...summaryMatches.map((match) => ({
      key: `summary-${match.id}`,
      meeting: match.meeting,
      label: "Acta",
      text: match.executiveSummary,
    })),
  ];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buscar</h1>
        <p className="text-sm text-muted-foreground">
          Busca dentro de tus transcripciones y actas
        </p>
      </div>

      <form method="GET" className="flex items-center gap-2">
        <Input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Buscar en transcripciones y actas..."
          className="max-w-sm"
          autoFocus
        />
        <Button type="submit" size="sm">
          Buscar
        </Button>
      </form>

      {!hasQuery ? (
        <EmptyState
          icon={Search}
          message="Busca dentro de tus transcripciones y actas"
          className="min-h-[160px]"
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          message={`No se encontraron coincidencias para «${query}»`}
          className="min-h-[160px]"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((result) => (
            <Link
              key={result.key}
              href={`/dashboard/meetings/${result.meeting.id}`}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">
                  {result.meeting.title}
                </h2>
                <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {result.label}
                </span>
              </div>
              <div className="mt-2">
                <Snippet text={result.text} query={query} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
