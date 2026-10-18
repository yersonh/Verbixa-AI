"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { puedeCrearOrganizacion } from "@/lib/acceso";

export type ResultadoCrear = { ok: true; orgId: string } | { ok: false; error: string };

/**
 * Crea la organización desde el servidor, solo si la cuenta está autorizada
 * en la Consola SGP (la creación desde el cliente de Clerk queda apagada en
 * su panel). Quien la crea queda como administrador y como dueño.
 */
export async function crearOrganizacion(nombre: string): Promise<ResultadoCrear> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo." };

  const limpio = nombre.trim().replace(/\s+/g, " ");
  if (limpio.length < 2 || limpio.length > 80) {
    return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;

  if (!(await puedeCrearOrganizacion(email))) {
    return { ok: false, error: "Tu cuenta no está autorizada para crear una organización en Verbixa." };
  }

  try {
    const clerk = await clerkClient();
    const org = await clerk.organizations.createOrganization({ name: limpio, createdBy: userId });

    // El webhook de Clerk también la sincroniza; aquí se guarda además el dueño.
    await prisma.organization.upsert({
      where: { clerkOrgId: org.id },
      update: { name: org.name, ownerEmail: email },
      create: { clerkOrgId: org.id, name: org.name, ownerEmail: email },
    });

    return { ok: true, orgId: org.id };
  } catch (err) {
    console.error("No se pudo crear la organización:", err);
    return { ok: false, error: "No se pudo crear la organización. Inténtalo de nuevo." };
  }
}
