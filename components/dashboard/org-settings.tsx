"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, useOrganization } from "@clerk/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

function initialsFromName(name: string | null | undefined, fallback: string) {
  const source = name?.trim() || fallback;
  return source.slice(0, 2).toUpperCase();
}

function OrganizationNameSection() {
  const { isLoaded, organization } = useOrganization();
  const { orgRole } = useAuth();
  const isAdmin = orgRole === "org:admin";
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentName = organization?.name ?? "";
  const displayName = editing ? name : currentName;

  const startEditing = () => {
    setName(currentName);
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    if (!organization) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === organization.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await organization.update({ name: trimmed });
      setEditing(false);
    } catch {
      setError("No se pudo actualizar el nombre. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">
        Nombre de la organización
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Este nombre es visible para todos los miembros de la organización.
      </p>

      <div className="mt-4 flex items-center gap-2">
        {!isLoaded ? (
          <Skeleton className="h-8 w-64" />
        ) : editing ? (
          <>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              className="max-w-sm"
              autoFocus
            />
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEditing}
              disabled={saving}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <span className="text-base font-medium text-foreground">
              {displayName}
            </span>
            {isAdmin ? (
              <Button size="sm" variant="outline" onClick={startEditing}>
                Editar
              </Button>
            ) : null}
          </>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function OrganizationMembersSection() {
  const { isLoaded, memberships } = useOrganization({
    memberships: true,
  });
  const { orgRole } = useAuth();
  const isAdmin = orgRole === "org:admin";

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-foreground">Miembros</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personas con acceso a esta organización.
          </p>
        </div>
        {isAdmin ? (
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/settings/invite" />}
          >
            Invitar miembros
          </Button>
        ) : null}
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-3">
        {!isLoaded || !memberships ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : memberships.data && memberships.data.length > 0 ? (
          memberships.data.map((membership) => {
            const user = membership.publicUserData;
            const fullName = [user?.firstName, user?.lastName]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={membership.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    <AvatarImage src={user?.imageUrl} alt={fullName} />
                    <AvatarFallback>
                      {initialsFromName(fullName, user?.identifier ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {fullName || user?.identifier}
                    </span>
                    {fullName && (
                      <span className="text-xs text-muted-foreground">
                        {user?.identifier}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant={membership.role === "org:admin" ? "default" : "outline"}
                >
                  {membership.roleName}
                </Badge>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no hay miembros en esta organización.
          </p>
        )}
      </div>
    </section>
  );
}

export function OrgSettings() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Configuración de la organización
        </h1>
        <p className="text-sm text-foreground/80">
          Administra el nombre y los miembros de tu organización.
        </p>
      </div>

      <OrganizationNameSection />
      <OrganizationMembersSection />
    </div>
  );
}
