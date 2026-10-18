import { prisma } from "@/lib/prisma";
import {
  consolaConfigurada,
  consultarCuenta,
  cuentaEnCache,
} from "@/lib/consola";

/**
 * Quién puede usar Verbixa (2026-10-18). Lo decide la Consola SGP:
 *
 *  · Crear una organización: solo una cuenta de Gmail autorizada y activa
 *    en la consola (los clientes). Si la consola no responde, NO se crea.
 *  · Entrar al panel: la organización tiene que tener dueño (`ownerEmail`)
 *    y que la consola lo tenga activo. Sus miembros invitados entran sin
 *    estar en la lista. Si la consola no responde, vale la última respuesta;
 *    si nunca la hubo, se deja pasar (una caída de la consola no tumba
 *    Verbixa) y queda en el log.
 *
 * Sin CONSOLA_URL / CONSOLA_SECRETO todo esto está apagado.
 */

export type AccesoOrganizacion = "activa" | "bloqueada";

export async function puedeCrearOrganizacion(email: string | null | undefined): Promise<boolean> {
  if (!consolaConfigurada()) return true;
  if (!email) return false;

  const cuenta = await consultarCuenta(email);
  return cuenta?.autorizada === true;
}

export async function accesoOrganizacion(clerkOrgId: string): Promise<AccesoOrganizacion> {
  if (!consolaConfigurada()) return "activa";

  const organizacion = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true, name: true, ownerEmail: true },
  });

  // Recién creada en Clerk y aún sin sincronizar por el webhook: se deja pasar.
  if (!organizacion) return "activa";
  // Creada sin pasar por una cuenta autorizada.
  if (!organizacion.ownerEmail) return "bloqueada";

  let cuenta = cuentaEnCache(organizacion.ownerEmail);
  if (!cuenta) {
    const [miembros, reuniones] = await Promise.all([
      prisma.user.count({ where: { organizationId: organizacion.id } }),
      prisma.meeting.count({ where: { organizationId: organizacion.id } }),
    ]);
    cuenta = await consultarCuenta(organizacion.ownerEmail, {
      nombre: organizacion.name,
      miembros,
      reuniones,
    });
  }

  if (!cuenta) {
    console.warn("Consola SGP sin respuesta: se deja pasar a la organización", clerkOrgId);
    return "activa";
  }

  return cuenta.autorizada ? "activa" : "bloqueada";
}
