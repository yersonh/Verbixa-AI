# Verbixa AI

Verbixa AI es un SaaS que documenta reuniones corporativas de forma automática: se une a la llamada, transcribe el audio y genera un acta con resumen ejecutivo, decisiones clave y tareas mediante IA.

## Stack

- **Next.js 15** + **TypeScript** (App Router)
- **Tailwind CSS** + **shadcn/ui** (tema oscuro por defecto)
- **Prisma** + **PostgreSQL**
- **Redis** + **BullMQ** (procesamiento de trabajos en segundo plano)
- **Clerk** (autenticación, con soporte de Organizations)
- Integraciones externas: **Recall.ai** (bot de reuniones), **Deepgram** (transcripción), **Google Gemini** (resumen con IA)

## Prerrequisitos

- Node.js 20+
- npm
- Una instancia de **PostgreSQL** corriendo
- Una instancia de **Redis** corriendo

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `REDIS_URL` | Cadena de conexión a Redis (usada por BullMQ) |
| `CLERK_SECRET_KEY` | Clave secreta de Clerk |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clave pública de Clerk |
| `RECALL_API_KEY` | API key de Recall.ai (bot de grabación) |
| `DEEPGRAM_API_KEY` | API key de Deepgram (transcripción) |
| `GEMINI_API_KEY` | API key de Google Gemini (resumen con IA) |

## Instalación

```bash
npm install
```

## Base de datos (Prisma)

El schema vive en `prisma/schema.prisma`.

```bash
npx prisma generate      # genera el cliente de Prisma
npx prisma migrate dev   # aplica migraciones en desarrollo y crea el schema en la DB
npx prisma studio        # (opcional) explorador visual de la base de datos
```

## Desarrollo

```bash
npm run dev
```

La app queda disponible en [http://localhost:3000](http://localhost:3000).

## Estructura de carpetas

```
/app          # Rutas de la aplicación (App Router)
/components   # Componentes de UI (incluye /components/ui para primitivas de shadcn)
/lib          # Utilidades (p. ej. singleton del cliente de Prisma)
/prisma       # Schema de la base de datos (schema.prisma)
```

## Scripts disponibles

```bash
npm run dev     # levanta el servidor de desarrollo
npm run build   # compila la app para producción
npm run start   # sirve la build de producción
npm run lint    # corre el linter
```
