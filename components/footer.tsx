import Image from "next/image";

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
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
          &copy; {CURRENT_YEAR} <span className="font-semibold">NexGovIA S.A.S.®</span> ·
          Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
