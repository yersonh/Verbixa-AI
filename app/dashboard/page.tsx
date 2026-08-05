import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MeetingStatus } from "@prisma/client";
import { CalendarClock, FileCheck2, ListChecks, Video } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { MeetingStatusBadge } from "@/components/dashboard/meeting-status-badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const { orgId } = await auth();

  const organization = orgId
    ? await prisma.organization.findUnique({ where: { clerkOrgId: orgId } })
    : null;

  if (!organization) {
    notFound();
  }

  const [totalMeetings, completedMeetings, pendingTasks, recentMeetings] =
    await Promise.all([
      prisma.meeting.count({ where: { organizationId: organization.id } }),
      prisma.meeting.count({
        where: { organizationId: organization.id, status: MeetingStatus.COMPLETED },
      }),
      prisma.task.count({
        where: {
          completed: false,
          summary: { meeting: { organizationId: organization.id } },
        },
      }),
      prisma.meeting.findMany({
        where: { organizationId: organization.id },
        orderBy: { scheduledAt: "desc" },
        take: 5,
      }),
    ]);

  const dateFormatter = new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const stats = [
    { label: "Reuniones totales", value: totalMeetings, icon: Video },
    { label: "Actas completadas", value: completedMeetings, icon: FileCheck2 },
    { label: "Tareas pendientes", value: pendingTasks, icon: ListChecks },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de tus reuniones y actas recientes.
        </p>
      </div>

      <div
        data-tour="dashboard-stats"
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/5 transition-shadow hover:shadow-md hover:shadow-black/10"
          >
            <div className="brand-gradient-bg flex size-10 shrink-0 items-center justify-center rounded-lg text-white">
              <stat.icon className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold tracking-tight">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div data-tour="dashboard-recent" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Reuniones recientes
          </h2>
          {recentMeetings.length > 0 ? (
            <Link
              href="/dashboard/meetings"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Ver todas
            </Link>
          ) : null}
        </div>

        {recentMeetings.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            message="Aún no hay reuniones documentadas."
            action={
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/dashboard/meetings/new" />}
              >
                Agendar tu primera reunión
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {recentMeetings.map((meeting) => (
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
    </div>
  );
}
