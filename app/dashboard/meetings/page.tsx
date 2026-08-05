import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Video } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { MeetingStatusBadge } from "@/components/dashboard/meeting-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; date?: string }>;
}) {
  const { q, date } = await searchParams;
  const { orgId } = await auth();

  const organization = orgId
    ? await prisma.organization.findUnique({ where: { clerkOrgId: orgId } })
    : null;

  if (!organization) {
    notFound();
  }

  const where: Prisma.MeetingWhereInput = { organizationId: organization.id };

  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }

  if (date) {
    const startOfDay = new Date(`${date}T00:00:00`);
    if (!Number.isNaN(startOfDay.getTime())) {
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      where.scheduledAt = { gte: startOfDay, lt: endOfDay };
    }
  }

  const hasFilters = Boolean(q || date);

  const meetings = await prisma.meeting.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
  });

  const totalMeetings = hasFilters
    ? await prisma.meeting.count({
        where: { organizationId: organization.id },
      })
    : meetings.length;

  const dateFormatter = new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reuniones</h1>
          <p className="text-sm text-muted-foreground">
            Historial de reuniones documentadas por tu organización.
          </p>
        </div>
        <div data-tour="meetings-actions" className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/meetings/upload" />}
          >
            + Subir grabación
          </Button>
          <Button nativeButton={false} render={<Link href="/dashboard/meetings/new" />}>
            + Agendar con bot
          </Button>
        </div>
      </div>

      <form
        method="GET"
        data-tour="meetings-filters"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Título
          </label>
          <Input
            id="q"
            name="q"
            type="text"
            placeholder="Buscar por título..."
            defaultValue={q ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="date" className="text-sm font-medium">
            Fecha
          </label>
          <Input id="date" name="date" type="date" defaultValue={date ?? ""} />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
          {hasFilters ? (
            <Link
              href="/dashboard/meetings"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Limpiar filtros
            </Link>
          ) : null}
        </div>
      </form>

      <div data-tour="meetings-list">
        {meetings.length === 0 ? (
          <EmptyState
            icon={Video}
            message={
              hasFilters
                ? "No se encontraron reuniones con esos filtros."
                : "Aún no hay reuniones todavía."
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/dashboard/meetings/${meeting.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{meeting.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {dateFormatter.format(meeting.scheduledAt)}
                  </span>
                </div>
                <MeetingStatusBadge status={meeting.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {hasFilters ? (
        <p className="text-xs text-muted-foreground">
          Mostrando {meetings.length} de {totalMeetings} reuniones en total.
        </p>
      ) : null}
    </div>
  );
}
