import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { accesoOrganizacion } from "@/lib/acceso";

const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
// Los webhooks (Clerk, Recall.ai) los firma su emisor: no llevan sesión.
const isWebhookRoute = createRouteMatcher(["/api/webhooks(.*)"]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isOnboardingRoute(req)) {
    await auth.protect();
    return;
  }

  // API: si la organización activa está suspendida en la Consola SGP, nada.
  if (isApiRoute(req) && !isWebhookRoute(req)) {
    const { orgId } = await auth();
    if (orgId && (await accesoOrganizacion(orgId)) === "bloqueada") {
      return NextResponse.json(
        { error: "El acceso de tu organización a Verbixa está suspendido" },
        { status: 403 },
      );
    }
    return;
  }

  if (!isDashboardRoute(req)) return;

  const { orgId } = await auth.protect();

  if (!orgId) {
    const onboardingUrl = new URL("/onboarding", req.url);
    return NextResponse.redirect(onboardingUrl);
  }

  if ((await accesoOrganizacion(orgId)) === "bloqueada") {
    return NextResponse.redirect(new URL("/acceso-suspendido", req.url));
  }
});

export const config = {
  // Node.js (no Edge): el control de acceso usa Prisma y node:crypto.
  runtime: "nodejs",
  // /api/meetings/upload queda fuera: con el middleware en runtime nodejs,
  // Next.js 15.5 clona el body de la request para el middleware y no espera
  // a terminar de leerlo (`finalize()` sin await en next-server.js), así que
  // en subidas que tardan unos segundos la ruta encuentra el body ya
  // consumido ("Response body object should not be disturbed or locked").
  // Esa ruta hace su propia autenticación y control de acceso.
  matcher: [
    "/((?!_next|api/meetings/upload|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/((?!api/meetings/upload)(?:api|trpc).*)",
  ],
};
