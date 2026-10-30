import { RecordMeetingForm } from "@/components/dashboard/record-meeting-form";

export default function RecordMeetingPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Grabar reunión
        </h1>
        <p className="text-sm text-muted-foreground">
          Graba una reunión en tiempo real desde el navegador. Al terminar, se
          transcribe y se genera el acta automáticamente.
        </p>
      </div>

      <RecordMeetingForm />
    </div>
  );
}
