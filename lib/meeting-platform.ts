export type MeetingPlatform = "google_meet" | "microsoft_teams";

interface PlatformMatcher {
  platform: MeetingPlatform;
  hostnames: string[];
}

const PLATFORM_MATCHERS: PlatformMatcher[] = [
  { platform: "google_meet", hostnames: ["meet.google.com"] },
  {
    platform: "microsoft_teams",
    hostnames: ["teams.microsoft.com", "teams.live.com"],
  },
];

export const MEETING_PLATFORM_LABELS: Record<MeetingPlatform, string> = {
  google_meet: "Google Meet",
  microsoft_teams: "Microsoft Teams",
};

/**
 * Detecta la plataforma de videollamada a partir del hostname de la URL.
 * Devuelve null si la URL es inválida o no pertenece a ninguna de las
 * plataformas que Recall.ai soporta a través de esta app (Google Meet o
 * Microsoft Teams). Recall.ai en sí soporta más plataformas (Zoom, Webex),
 * pero Verbixa AI solo expone estas dos por ahora.
 */
export function detectMeetingPlatform(url: string): MeetingPlatform | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const match = PLATFORM_MATCHERS.find((m) => m.hostnames.includes(hostname));
  return match?.platform ?? null;
}
