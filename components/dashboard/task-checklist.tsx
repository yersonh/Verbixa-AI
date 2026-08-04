"use client";

import { useState } from "react";

export interface ChecklistTask {
  id: string;
  description: string;
  assignee: string | null;
  dueDate: Date | null;
  completed: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("es", { dateStyle: "medium" });

export function TaskChecklist({ tasks }: { tasks: ChecklistTask[] }) {
  const [items, setItems] = useState(tasks);
  const [errorId, setErrorId] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin tareas.</p>;
  }

  async function toggleTask(taskId: string, nextCompleted: boolean) {
    setErrorId(null);
    setItems((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, completed: nextCompleted } : task,
      ),
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }
    } catch {
      setItems((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, completed: !nextCompleted } : task,
        ),
      );
      setErrorId(taskId);
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((task) => (
        <li
          key={task.id}
          className="flex items-start gap-3 rounded-lg border border-border px-3 py-2"
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={task.completed}
            onClick={() => toggleTask(task.id, !task.completed)}
            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
              task.completed
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent"
            }`}
          >
            {task.completed ? (
              <svg
                viewBox="0 0 12 12"
                className="size-3"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 6l2.5 2.5L10 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p
              className={`text-sm leading-relaxed ${
                task.completed
                  ? "text-muted-foreground line-through"
                  : "text-foreground"
              }`}
            >
              {task.description}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{task.assignee ?? "Sin asignar"}</span>
              {task.dueDate ? (
                <span>{dateFormatter.format(new Date(task.dueDate))}</span>
              ) : null}
            </div>
            {errorId === task.id ? (
              <span className="text-xs text-destructive">
                No se pudo actualizar la tarea. Intenta de nuevo.
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
