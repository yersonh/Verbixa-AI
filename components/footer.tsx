import Image from "next/image";

import { NexGovTrigger } from "@/components/nexgov-modal";

const CURRENT_YEAR = new Date().getFullYear();

export function Footer({
  variant = "bar",
}: {
  /** "bar": franja de ancho completo (dashboard). "floating": tarjeta
   * flotante sobre el fondo con ondas (landing, auth, onboarding). */
  variant?: "bar" | "floating";
}) {
  if (variant === "floating") {
    return (
      <footer className="flex justify-center px-6 py-4">
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-background/70 px-8 py-3 text-center shadow-lg shadow-black/10 backdrop-blur-xl">
          <Image
            src="/NexGovIA.png"
            alt="NexGovIA"
            width={824}
            height={221}
            className="h-10 w-auto"
          />
          <p className="text-xs text-muted-foreground">
            &copy; {CURRENT_YEAR} <NexGovTrigger /> · Todos los derechos
            reservados.
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border/50 bg-background/70 py-6 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <Image
          src="/NexGovIA.png"
          alt="NexGovIA"
          width={824}
          height={221}
          className="h-14 w-auto"
        />
        <p className="text-xs text-muted-foreground">
          &copy; {CURRENT_YEAR} <NexGovTrigger /> · Todos los derechos
          reservados.
        </p>
      </div>
    </footer>
  );
}
