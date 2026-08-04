"use client";

import type { MeetingStatus } from "@prisma/client";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

const STATUS_MESSAGES: Partial<Record<MeetingStatus, string>> = {
  JOINING: "El bot se está uniendo a la reunión…",
  RECORDING: "Grabando la reunión…",
  PROCESSING: "Procesando la grabación…",
};

export function MeetingProcessingState({
  status,
}: {
  status: MeetingStatus;
}) {
  const message = STATUS_MESSAGES[status];

  if (!message) {
    return null;
  }

  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-4">
      <motion.div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <Loader2 className="size-4 animate-spin" />
        <span>{message}</span>
      </motion.div>

      <div className="flex w-full flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
