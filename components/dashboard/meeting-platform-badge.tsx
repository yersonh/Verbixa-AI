import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MEETING_PLATFORM_LABELS,
  type MeetingPlatform,
} from "@/lib/meeting-platform";

const DOT_CLASS: Record<MeetingPlatform, string> = {
  google_meet: "bg-emerald-500",
  microsoft_teams: "bg-indigo-500",
};

export function MeetingPlatformBadge({
  platform,
}: {
  platform: MeetingPlatform;
}) {
  return (
    <Badge variant="outline">
      <span
        className={cn("size-1.5 rounded-full", DOT_CLASS[platform])}
        aria-hidden="true"
      />
      {MEETING_PLATFORM_LABELS[platform]}
    </Badge>
  );
}
