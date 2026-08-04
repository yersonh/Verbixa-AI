import { CreateOrganization } from "@clerk/nextjs";

export default function OnboardingPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Crea tu organización</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Necesitas una organización para empezar a documentar tus reuniones.
        </p>
      </div>
      <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
    </div>
  );
}
