import { MeetingStatus } from "@prisma/client"

import { Badge, badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

const STATUS_CONFIG: Record<
  MeetingStatus,
  { label: string; variant: BadgeVariant; className?: string; dotClassName?: string }
> = {
  SCHEDULED: {
    label: "Programada",
    variant: "outline",
    dotClassName: "bg-muted-foreground",
  },
  JOINING: {
    label: "Uniéndose",
    variant: "secondary",
    dotClassName: "bg-amber-500",
  },
  RECORDING: {
    label: "Grabando",
    variant: "default",
    className: "bg-red-600 text-white [a]:hover:bg-red-600/80",
    dotClassName: "bg-white animate-pulse",
  },
  PROCESSING: {
    label: "Procesando",
    variant: "secondary",
    dotClassName: "bg-blue-500 animate-pulse",
  },
  COMPLETED: {
    label: "Completada",
    variant: "default",
    className: "bg-emerald-600 text-white [a]:hover:bg-emerald-600/80",
    dotClassName: "bg-white",
  },
  FAILED: {
    label: "Fallida",
    variant: "destructive",
    dotClassName: "bg-destructive",
  },
}

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const config = STATUS_CONFIG[status]

  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      <span
        className={cn("size-1.5 rounded-full", config.dotClassName)}
        aria-hidden="true"
      />
      {config.label}
    </Badge>
  )
}
