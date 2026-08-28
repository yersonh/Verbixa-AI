"use client";

import { useState } from "react";
import { Download, FileText, File as FileIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ExportTranscriptButton({
  meetingId,
  speaker = null,
}: {
  meetingId: string;
  /** Hablante seleccionado en el filtro de la transcripción, si hay alguno. */
  speaker?: string | null;
}) {
  // Cuando está activo, la descarga omite las marcas de tiempo y une las
  // líneas de cada hablante en un solo párrafo.
  const [plainText, setPlainText] = useState(false);

  const buildHref = (format: "pdf" | "docx") => {
    const params = new URLSearchParams();
    if (plainText) params.set("timestamps", "false");
    if (speaker) params.set("speaker", speaker);
    const query = params.toString();
    return `/api/meetings/${meetingId}/transcript/${format}${query ? `?${query}` : ""}`;
  };

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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuCheckboxItem
          checked={plainText}
          onCheckedChange={setPlainText}
          closeOnClick={false}
        >
          Sin marcas de tiempo (párrafos unidos)
        </DropdownMenuCheckboxItem>
        {speaker ? (
          <p className="px-1.5 py-1 text-xs text-muted-foreground">
            Solo intervenciones de {speaker}
          </p>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href={buildHref("pdf")} />}>
          <FileText />
          Descargar como PDF
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={buildHref("docx")} />}>
          <FileIcon />
          Descargar como Word
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
