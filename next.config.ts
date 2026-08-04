import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // bullmq soporta opcionalmente @valkey/valkey-glide como cliente alterno;
  // no lo usamos (usamos ioredis), así que se ignora en el bundle del servidor.
  //
  // pdfkit carga fuentes .afm desde disco vía rutas relativas a su propio
  // paquete; si webpack lo empaqueta, esas rutas se rompen. Se excluye del
  // bundle para que se cargue vía require() nativo de Node.
  serverExternalPackages: ["bullmq", "ioredis", "pdfkit"],
};

export default nextConfig;
