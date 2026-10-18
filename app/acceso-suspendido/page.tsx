import { OrganizationSwitcher, SignOutButton } from "@clerk/nextjs";

import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";

/**
 * La organización activa está suspendida (o ya no está autorizada) en la
 * Consola SGP: el middleware manda aquí en vez de al panel.
 */
export default function AccesoSuspendidoPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border/50 bg-background/70 p-8 text-center shadow-lg shadow-black/10 backdrop-blur-xl">
          <h1 className="text-2xl font-semibold">Acceso suspendido</h1>
          <p className="text-muted-foreground text-sm">
            El acceso de esta organización a Verbixa está suspendido. Sus reuniones no se han
            borrado. Para reactivarlo, comunícate con NexGovIA.
          </p>
          <p className="text-muted-foreground text-xs">Si perteneces a otra organización, puedes cambiar de organización:</p>
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/dashboard" />
          <SignOutButton>
            <Button variant="outline">Cerrar sesión</Button>
          </SignOutButton>
        </div>
      </div>
      <Footer variant="floating" />
    </div>
  );
}
