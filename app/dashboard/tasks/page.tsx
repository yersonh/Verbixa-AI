import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { TaskChecklist } from "@/components/dashboard/task-checklist";
import { prisma } from "@/lib/prisma";

export default async function TasksPage() {
  const { orgId } = await auth();

  const organization = orgId
    ? await prisma.organization.findUnique({ where: { clerkOrgId: orgId } })
    : null;

  if (!organization) {
    notFound();
  }

  const tasks = await prisma.task.findMany({
    where: { summary: { meeting: { organizationId: organization.id } } },
    include: { summary: { include: { meeting: true } } },
    orderBy: { createdAt: "desc" },
  });

  const meetingGroups = new Map<
    string,
    { meetingId: string; title: string; tasks: typeof tasks }
  >();

  for (const task of tasks) {
    const meeting = task.summary.meeting;
    const group = meetingGroups.get(meeting.id);
    if (group) {
      group.tasks.push(task);
    } else {
      meetingGroups.set(meeting.id, {
        meetingId: meeting.id,
        title: meeting.title,
        tasks: [task],
      });
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tareas</h1>
        <p className="text-sm text-muted-foreground">
          Tareas extraídas de las actas de tus reuniones.
        </p>
      </div>

      {meetingGroups.size === 0 ? (
        <EmptyState icon={ListChecks} message="Todavía no hay tareas registradas." />
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(meetingGroups.values()).map((group) => (
            <div
              key={group.meetingId}
              className="rounded-xl border border-border bg-card p-4"
            >
              <Link
                href={`/dashboard/meetings/${group.meetingId}`}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                {group.title}
              </Link>
              <div className="mt-3">
                <TaskChecklist
                  tasks={group.tasks.map((task) => ({
                    id: task.id,
                    description: task.description,
                    assignee: task.assignee,
                    dueDate: task.dueDate,
                    completed: task.completed,
                  }))}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
