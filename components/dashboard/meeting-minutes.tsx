import { TaskChecklist, type ChecklistTask } from "@/components/dashboard/task-checklist";

interface MeetingMinutesSummary {
  id: string;
  executiveSummary: string;
  keyDecisions: unknown;
  tasks: ChecklistTask[];
}

export function MeetingMinutes({ summary }: { summary: MeetingMinutesSummary }) {
  const keyDecisions = summary.keyDecisions as string[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Resumen ejecutivo
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {summary.executiveSummary}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Decisiones clave
        </h3>
        {keyDecisions && keyDecisions.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-muted-foreground">
            {keyDecisions.map((decision, index) => (
              <li key={index}>{decision}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin decisiones registradas.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Tareas</h3>
        <TaskChecklist tasks={summary.tasks} />
      </div>
    </div>
  );
}
