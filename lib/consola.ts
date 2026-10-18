import { createHmac } from "node:crypto";

/**
 * Cliente de la Consola SGP (panel del proveedor): la lista de cuentas de
 * Gmail autorizadas para crear una organización en Verbixa.
 *
 * POST {CONSOLA_URL}/api/verbixa/cuenta, firmado con CONSOLA_SECRETO (el
 * mismo valor que VERBIXA_SECRETO en la consola):
 *   X-Consola-Fecha  hora unix
 *   X-Consola-Firma  hex(hmac_sha256("{fecha}.{cuerpo}", secreto))
 *
 * Solo para el servidor (usa node:crypto). Sin CONSOLA_URL / CONSOLA_SECRETO
 * el control está apagado y Verbixa funciona como antes.
 */

export type EstadoCuenta = {
  autorizada: boolean;
  estado: "activa" | "suspendida" | null;
  cliente: string | null;
};

export type DatosOrganizacion = {
  nombre: string;
  miembros: number;
  reuniones: number;
};

/** Cuánto vale una respuesta de la consola antes de volver a preguntar. */
const VIGENCIA_MS = 2 * 60 * 1000;

type Entrada = { datos: EstadoCuenta; vence: number };

const globalConsola = globalThis as unknown as {
  cacheConsola: Map<string, Entrada> | undefined;
};
const cache = (globalConsola.cacheConsola ??= new Map<string, Entrada>());

export function consolaConfigurada(): boolean {
  return Boolean(process.env.CONSOLA_URL && process.env.CONSOLA_SECRETO);
}

function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

/** Respuesta en caché aún vigente, sin preguntar a la consola. */
export function cuentaEnCache(email: string): EstadoCuenta | null {
  const entrada = cache.get(normalizar(email));
  return entrada && entrada.vence > Date.now() ? entrada.datos : null;
}

/**
 * Pregunta a la consola por la cuenta. Si la consola no responde, devuelve
 * la última respuesta conocida (aunque haya vencido) o null si nunca la hubo.
 */
export async function consultarCuenta(
  email: string,
  organizacion?: DatosOrganizacion,
): Promise<EstadoCuenta | null> {
  const clave = normalizar(email);
  const url = `${(process.env.CONSOLA_URL ?? "").replace(/\/+$/, "")}/api/verbixa/cuenta`;
  const cuerpo = JSON.stringify({ email: clave, organizacion });
  const fecha = String(Math.floor(Date.now() / 1000));
  const firma = createHmac("sha256", process.env.CONSOLA_SECRETO ?? "")
    .update(`${fecha}.${cuerpo}`)
    .digest("hex");

  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Consola-Fecha": fecha,
        "X-Consola-Firma": firma,
      },
      body: cuerpo,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) {
      throw new Error(`La consola respondió ${respuesta.status}`);
    }

    const json = (await respuesta.json()) as Partial<EstadoCuenta> & { ok?: boolean };
    const datos: EstadoCuenta = {
      autorizada: json.autorizada === true,
      estado: json.estado === "activa" || json.estado === "suspendida" ? json.estado : null,
      cliente: typeof json.cliente === "string" ? json.cliente : null,
    };
    cache.set(clave, { datos, vence: Date.now() + VIGENCIA_MS });
    return datos;
  } catch (err) {
    console.error("Consola SGP: no se pudo consultar la cuenta", clave, err);
    return cache.get(clave)?.datos ?? null;
  }
}
