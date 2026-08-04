"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { Notification } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("es", {
  numeric: "auto",
});

function formatRelativeTime(date: Date): string {
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSeconds) < 60) return relativeTimeFormatter.format(diffSeconds, "second");
  if (Math.abs(diffMinutes) < 60) return relativeTimeFormatter.format(diffMinutes, "minute");
  if (Math.abs(diffHours) < 24) return relativeTimeFormatter.format(diffHours, "hour");
  return relativeTimeFormatter.format(diffDays, "day");
}

export function NotificationsMenu() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
  }

  async function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    await fetch("/api/notifications/read-all", { method: "POST" });
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative">
            <Bell />
            {unreadCount > 0 ? (
              <span className="absolute top-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-medium text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
            <span className="sr-only">Notificaciones</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between px-1.5 py-1">
            <DropdownMenuLabel className="p-0">Notificaciones</DropdownMenuLabel>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline"
              >
                Marcar todas leídas
              </button>
            ) : null}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {!loaded ? (
          <p className="px-1.5 py-3 text-center text-sm text-muted-foreground">
            Cargando...
          </p>
        ) : notifications.length === 0 ? (
          <p className="px-1.5 py-3 text-center text-sm text-muted-foreground">
            No tienes notificaciones.
          </p>
        ) : (
          <div className="flex max-h-80 flex-col overflow-y-auto">
            {notifications.map((notification) => {
              const content = (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    {!notification.read ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="text-sm font-medium">
                      {notification.title}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {notification.message}
                  </span>
                  <span className="text-[11px] text-muted-foreground/70">
                    {formatRelativeTime(new Date(notification.createdAt))}
                  </span>
                </div>
              );

              return (
                <DropdownMenuItem
                  key={notification.id}
                  className="items-start py-2"
                  onClick={() => !notification.read && markAsRead(notification.id)}
                  render={
                    notification.meetingId ? (
                      <Link href={`/dashboard/meetings/${notification.meetingId}`} />
                    ) : undefined
                  }
                >
                  {content}
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
