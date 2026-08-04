import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandMark({
  size = 64,
  titleClassName,
}: {
  size?: number;
  titleClassName?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative overflow-hidden rounded-2xl shadow-lg shadow-black/10"
        style={{ width: size, height: size }}
      >
        <Image src="/logo.png" alt="Verbixa AI" fill sizes={`${size}px`} priority />
      </div>
      <span
        className={cn(
          "brand-gradient-text text-2xl font-semibold tracking-tight",
          titleClassName,
        )}
      >
        Verbixa AI
      </span>
    </div>
  );
}
