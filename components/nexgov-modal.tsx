"use client";

import Image from "next/image";
import { Dialog } from "@base-ui/react/dialog";
import { Globe, Shield, X, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Globe,
    title: "Alcance",
    description: "Sistemas escalables a nivel nacional.",
    color: "text-sky-400",
    bg: "bg-sky-400/10 border-sky-400/20",
  },
  {
    icon: Shield,
    title: "Seguridad",
    description: "Protección de datos de alto nivel.",
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/20",
  },
  {
    icon: Zap,
    title: "IA",
    description: "Automatización inteligente de procesos.",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
  },
];

export function NexGovTrigger({ className }: { className?: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn(
          "font-semibold underline decoration-dotted underline-offset-2 transition-colors hover:text-amber-400",
          className
        )}
      >
        NexGovIA S.A.S.®
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-100 bg-black/65 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-0 z-100 flex items-center justify-center p-3 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 sm:p-4">
          <div
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-900/90 shadow-2xl backdrop-blur-2xl"
            style={{ maxHeight: "90vh" }}
          >
            {/* Header */}
            <div
              className="relative flex min-h-36 shrink-0 items-center overflow-hidden px-6 py-6 pr-14 sm:px-8"
              style={{
                background:
                  "linear-gradient(135deg, #0a0f1e 0%, #0f172a 50%, #1e1b4b 100%)",
              }}
            >
              <div
                className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full"
                style={{
                  background: "rgba(251,191,36,0.08)",
                  filter: "blur(40px)",
                }}
              />

              <Dialog.Close className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
                <X className="size-3.5" />
                <span className="sr-only">Cerrar</span>
              </Dialog.Close>

              <div className="relative z-10 flex w-full items-center gap-5">
                <div className="size-20 shrink-0 overflow-hidden rounded-full bg-white shadow-xl outline outline-3 outline-white/25 transition-transform duration-300 hover:scale-110 sm:size-24">
                  <Image
                    src="/LogoEmpresa.png"
                    alt="NexGovIA"
                    width={500}
                    height={500}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <Dialog.Title className="text-xs leading-relaxed font-semibold text-white sm:text-sm">
                    Plataforma desarrollada por{" "}
                    <span className="text-amber-400">NexGovIA S.A.S.®</span>
                  </Dialog.Title>
                  <p className="mt-0.5 text-xs leading-relaxed text-indigo-300">
                    Asesores{" "}
                    <span className="font-semibold text-indigo-200">
                      e-Governance Solutions
                    </span>{" "}
                    para Entidades Públicas.
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <p className="mb-4 text-sm leading-relaxed text-slate-300">
                NexGovIA es una firma líder en consultoría y desarrollo
                tecnológico, especializada en la implementación de
                soluciones de Inteligencia Artificial para la administración
                pública, mediante la automatización de procesos de sus
                actividades administrativas incursas en cumplimientos
                normativos.
              </p>
              <p className="mb-6 text-sm leading-relaxed text-slate-300">
                Diseñamos ecosistemas digitales que permiten a las
                organizaciones gubernamentales operar con mayor
                transparencia, agilidad y eficiencia, conectando mejor con
                las necesidades del ciudadano moderno.
              </p>

              <div className="mb-6 grid grid-cols-3 gap-3">
                {FEATURES.map((feature) => (
                  <div
                    key={feature.title}
                    className={cn("rounded-2xl border p-4", feature.bg)}
                  >
                    <feature.icon
                      className={cn("mb-2 size-5", feature.color)}
                    />
                    <h4
                      className={cn(
                        "mb-1 text-xs font-bold tracking-wider uppercase",
                        feature.color
                      )}
                    >
                      {feature.title}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
                <p className="text-sm font-medium text-slate-400">
                  Conoce más sobre nosotros en:
                </p>
                <a
                  href="https://nexgovia.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-400/20"
                >
                  <Globe className="size-3.5" />
                  nexgovia.com
                </a>
              </div>

              <Dialog.Close
                className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-colors"
                style={{
                  background: "linear-gradient(135deg, #2563eb, #1e3a8a)",
                }}
              >
                Entendido
              </Dialog.Close>

              <p className="mt-4 text-center text-[10px] text-slate-500">
                © 2026 NexGovIA · Transformando el futuro de la gestión
                pública
              </p>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
