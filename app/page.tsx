import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { PageTransition } from "@/components/page-transition";

export default function Home() {
  return (
    <PageTransition>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-16 text-center">
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-border/50 bg-background/70 p-10 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <BrandMark titleClassName="text-4xl" />
          <p className="max-w-md text-foreground/80">
            Documentación automática de reuniones corporativas: transcripción
            y acta generadas con IA.
          </p>
          <Button nativeButton={false} render={<Link href="/sign-in" />}>
            Comenzar
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
