"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { crearOrganizacion } from "@/app/onboarding/actions";

/** Crea la organización (en el servidor) y la deja activa en la sesión. */
export function CrearOrganizacionForm() {
  const router = useRouter();
  const { setActive } = useClerk();
  const [nombre, setNombre] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setError(null);

    const resultado = await crearOrganizacion(nombre);
    if (!resultado.ok) {
      setError(resultado.error);
      setEnviando(false);
      return;
    }

    await setActive({ organization: resultado.orgId });
    router.push("/dashboard");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border/50 bg-background/70 p-6 shadow-lg shadow-black/10 backdrop-blur-xl"
    >
      <label htmlFor="nombre-organizacion" className="text-sm font-medium">
        Nombre de la organización
      </label>
      <Input
        id="nombre-organizacion"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Campaña, empresa o equipo"
        maxLength={80}
        required
        autoFocus
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={enviando || nombre.trim().length < 2}>
        {enviando ? "Creando…" : "Crear organización"}
      </Button>
    </form>
  );
}
