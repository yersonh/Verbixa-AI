"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useOrganization, useUser } from "@clerk/react";
import {
  LayoutDashboard,
  Video,
  FileText,
  ListChecks,
  Settings,
  ChevronsUpDown,
  LogOut,
  UserCircle,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, tour: "nav-dashboard" },
  { title: "Reuniones", href: "/dashboard/meetings", icon: Video, tour: "nav-meetings" },
  {
    title: "Transcripciones",
    href: "/dashboard/transcripts",
    icon: FileText,
    tour: "nav-transcripts",
  },
  { title: "Tareas", href: "/dashboard/tasks", icon: ListChecks, tour: "nav-tasks" },
  {
    title: "Configuración",
    href: "/dashboard/settings",
    icon: Settings,
    tour: "nav-settings",
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { signOut, openUserProfile } = useClerk();

  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "Usuario";
  const displayOrg = organization?.name ?? "Sin organización";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              data-tour="brand"
              size="lg"
              render={<Link href="/dashboard" />}
            >
              <div className="relative size-8 shrink-0 overflow-hidden rounded-md">
                <Image
                  src="/logo.png"
                  alt="Verbixa AI"
                  fill
                  sizes="32px"
                  className="object-cover"
                  priority
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-semibold">Verbixa AI</span>
                <span className="text-xs text-sidebar-foreground/60">
                  Actas con IA
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      data-tour={item.tour}
                      tooltip={item.title}
                      isActive={isActive}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg">
                    <Avatar size="sm">
                      <AvatarImage src={user?.imageUrl} alt={displayName} />
                      <AvatarFallback>{initials(displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col text-left leading-tight">
                      <span className="truncate font-medium">
                        {displayName}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/60">
                        {displayOrg}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent align="end" side="right">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openUserProfile()}>
                  <UserCircle />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => signOut({ redirectUrl: "/" })}
                >
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
