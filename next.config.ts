import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // bullmq soporta opcionalmente @valkey/valkey-glide como cliente alterno;
  // no lo usamos (usamos ioredis), así que se ignora en el bundle del servidor.
  //
  // pdfkit carga fuentes .afm desde disco vía rutas relativas a su propio
  // paquete; si webpack lo empaqueta, esas rutas se rompen. Se excluye del
  // bundle para que se cargue vía require() nativo de Node.
  serverExternalPackages: ["bullmq", "ioredis", "pdfkit"],

  experimental: {
    // El middleware de Clerk corre sobre todas las rutas /api (ver
    // middleware.ts), y Next.js clona/bufferea el body de esas requests en
    // memoria hasta este límite (10 MB por defecto). Sin esto, la subida de
    // grabaciones en app/api/meetings/upload/route.ts fallaba con archivos
    // de más de 10 MB aunque su propio límite (MAX_UPLOAD_SIZE_BYTES) sea de
    // 500 MB.
    middlewareClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
