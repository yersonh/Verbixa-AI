import { UploadRecordingForm } from "@/components/dashboard/upload-recording-form";

export default function UploadRecordingPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Subir grabación
        </h1>
        <p className="text-sm text-muted-foreground">
          Sube una grabación de audio o video ya existente para generar su
          transcripción y acta automáticamente.
        </p>
      </div>

      <UploadRecordingForm />
    </div>
  );
}
