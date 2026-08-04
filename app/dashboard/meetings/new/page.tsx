import { MeetingForm } from "@/components/dashboard/meeting-form";

export default function NewMeetingPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Agendar reunión
        </h1>
        <p className="text-sm text-muted-foreground">
          Programa una reunión de Google Meet o Microsoft Teams y deja que
          Verbixa AI se encargue de documentarla automáticamente.
        </p>
      </div>

      <MeetingForm />
    </div>
  );
}
