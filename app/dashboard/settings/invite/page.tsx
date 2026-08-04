import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { InviteMembersForm } from "@/components/dashboard/invite-members-form";

export default async function InviteMembersPage() {
  const { orgRole } = await auth();

  if (orgRole !== "org:admin") {
    redirect("/dashboard/settings");
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Invitar miembros
        </h1>
        <p className="text-sm text-muted-foreground">
          Envía invitaciones para que nuevas personas se unan a tu
          organización.
        </p>
      </div>

      <InviteMembersForm />
    </div>
  );
}
