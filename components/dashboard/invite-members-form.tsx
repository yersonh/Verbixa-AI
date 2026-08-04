"use client";

import * as React from "react";
import { useOrganization } from "@clerk/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FeedbackState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "org:member", label: "Miembro" },
  { value: "org:admin", label: "Administrador" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  revoked: "Revocada",
  expired: "Expirada",
};

export function InviteMembersForm() {
  const { isLoaded, organization, invitations } = useOrganization({
    invitations: {
      infinite: true,
      keepPreviousData: true,
    },
  });

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState(ROLE_OPTIONS[0]!.value);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<FeedbackState>({
    type: "idle",
  });
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;

    setIsSubmitting(true);
    setFeedback({ type: "idle" });

    try {
      await organization.inviteMember({
        emailAddress: email.trim(),
        role,
      });
      setFeedback({
        type: "success",
        message: `Invitación enviada a ${email.trim()}.`,
      });
      setEmail("");
      await invitations?.revalidate?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo enviar la invitación. Inténtalo de nuevo.";
      setFeedback({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    const invitation = invitations?.data?.find((i) => i.id === invitationId);
    if (!invitation) return;

    setRevokingId(invitationId);
    try {
      await invitation.revoke();
      await invitations?.revalidate?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo revocar la invitación.";
      setFeedback({ type: "error", message });
    } finally {
      setRevokingId(null);
    }
  }

  if (!isLoaded) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="mt-3 h-8 w-1/3" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <label
            htmlFor="invite-email"
            className="text-sm font-medium text-foreground"
          >
            Correo electrónico
          </label>
          <Input
            id="invite-email"
            type="email"
            required
            placeholder="persona@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="invite-role"
            className="text-sm font-medium text-foreground"
          >
            Rol
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isSubmitting}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 sm:w-40"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={isSubmitting || !email.trim()}>
          {isSubmitting ? "Enviando..." : "Enviar invitación"}
        </Button>
      </form>

      {feedback.type !== "idle" && (
        <p
          className={cn(
            "text-sm",
            feedback.type === "success" ? "text-emerald-500" : "text-destructive"
          )}
        >
          {feedback.message}
        </p>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Invitaciones pendientes
          </h2>
        </div>

        {!invitations || invitations.data === undefined ? (
          <div className="p-4">
            <Skeleton className="h-6 w-full" />
          </div>
        ) : invitations.data.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No hay invitaciones pendientes.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {invitations.data.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {invitation.emailAddress}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {invitation.roleName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={
                      invitation.status === "pending" ? "secondary" : "outline"
                    }
                  >
                    {STATUS_LABEL[invitation.status] ?? invitation.status}
                  </Badge>
                  {invitation.status === "pending" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={revokingId === invitation.id}
                      onClick={() => handleRevoke(invitation.id)}
                    >
                      {revokingId === invitation.id
                        ? "Revocando..."
                        : "Revocar"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {invitations?.hasNextPage && (
          <div className="border-t border-border p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={invitations.isFetching}
              onClick={() => invitations.fetchNext?.()}
            >
              {invitations.isFetching ? "Cargando..." : "Cargar más"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
