"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationsMenu } from "@/components/dashboard/notifications-menu";
import { HelpTourButton } from "@/components/dashboard/help-tour-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  meetings: "Reuniones",
  new: "Agendar reunión",
  upload: "Subir grabación",
  transcripts: "Transcripciones",
  tasks: "Tareas",
  settings: "Configuración",
  invite: "Invitar miembros",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildCrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  return segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = UUID_PATTERN.test(segment)
      ? "Detalle"
      : (SEGMENT_LABELS[segment] ?? segment);

    return { href, label };
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function DashboardHeader() {
  const pathname = usePathname();
  const { user } = useUser();
  const crumbs = buildCrumbs(pathname);

  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "Usuario";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/70 px-4 backdrop-blur-xl">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <Fragment key={crumb.href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={crumb.href} />}>
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast ? <BreadcrumbSeparator /> : null}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <HelpTourButton />
        <div data-tour="notifications">
          <NotificationsMenu />
        </div>
        <Separator orientation="vertical" className="h-4" />
        <Avatar size="sm">
          <AvatarImage src={user?.imageUrl} alt={displayName} />
          <AvatarFallback>{initials(displayName)}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
