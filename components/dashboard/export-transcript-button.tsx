import { Download, FileText, File as FileIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ExportTranscriptButton({ meetingId }: { meetingId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="border-border/80 bg-card dark:bg-card dark:hover:bg-card/70"
          >
            <Download />
            Descargar transcripción
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          render={<a href={`/api/meetings/${meetingId}/transcript/pdf`} />}
        >
          <FileText />
          Descargar como PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<a href={`/api/meetings/${meetingId}/transcript/docx`} />}
        >
          <FileIcon />
          Descargar como Word
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
