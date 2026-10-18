import { OrganizationList, SignOutButton } from "@clerk/nextjs";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";

import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { CrearOrganizacionForm } from "@/components/onboarding/crear-organizacion-form";
import { puedeCrearOrganizacion } from "@/lib/acceso";

/**
 * Sin organización activa. Muestra, según el caso:
 *  · sus organizaciones e invitaciones pendientes (miembros invitados);
 *  · el formulario para crear una, solo si su cuenta está autorizada en la
 *    Consola SGP (lib/acceso.ts);
 *  · si no tiene nada de eso, el aviso de cuenta no autorizada.
 */
export default async function OnboardingPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  const clerk = await clerkClient();
  const [membresias, invitaciones, puedeCrear] = await Promise.all([
    userId ? clerk.users.getOrganizationMembershipList({ userId, limit: 1 }) : null,
    userId ? clerk.users.getOrganizationInvitationList({ userId, status: "pending", limit: 1 }) : null,
    puedeCrearOrganizacion(email),
  ]);
  const tieneOrganizaciones = (membresias?.totalCount ?? 0) + (invitaciones?.totalCount ?? 0) > 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
        {tieneOrganizaciones ? (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-semibold">Elige tu organización</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Entra a una de tus organizaciones o acepta la invitación que te enviaron.
              </p>
            </div>
            <OrganizationList hidePersonal afterSelectOrganizationUrl="/dashboard" />
          </>
        ) : null}

        {puedeCrear ? (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-semibold">
                {tieneOrganizaciones ? "O crea una nueva" : "Crea tu organización"}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Necesitas una organización para empezar a documentar tus reuniones.
              </p>
            </div>
            <CrearOrganizacionForm />
          </>
        ) : null}

        {!tieneOrganizaciones && !puedeCrear ? (
          <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border/50 bg-background/70 p-8 text-center shadow-lg shadow-black/10 backdrop-blur-xl">
            <h1 className="text-2xl font-semibold">Tu cuenta no está autorizada</h1>
            <p className="text-muted-foreground text-sm">
              {email ? <><b>{email}</b> no </> : "Tu cuenta no "}
              tiene permiso para crear una organización en Verbixa. Si tu equipo ya usa Verbixa,
              pide a su administrador que te invite. Para contratar Verbixa, escríbenos a NexGovIA.
            </p>
            <SignOutButton>
              <Button variant="outline">Cerrar sesión</Button>
            </SignOutButton>
          </div>
        ) : null}
      </div>
      <Footer variant="floating" />
    </div>
  );
}
