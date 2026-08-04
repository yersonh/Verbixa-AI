import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExportPdfButton({ meetingId }: { meetingId: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="border-border/80 bg-card dark:bg-card dark:hover:bg-card/70"
      nativeButton={false}
      render={<a href={`/api/meetings/${meetingId}/pdf`} />}
    >
      <Download />
      Exportar a PDF
    </Button>
  );
}
