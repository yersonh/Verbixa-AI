# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Verbixa AI — a SaaS that auto-documents corporate meetings: a bot joins the call, the audio is transcribed, and AI generates meeting minutes (executive summary, key decisions, tasks).

Stack: Next.js 15 (App Router) + TypeScript, Tailwind CSS + shadcn/ui, Prisma + PostgreSQL, Redis + BullMQ for background jobs, Clerk for auth (with Organizations). External APIs: Recall.ai (meeting bot), Deepgram (transcription), Google Gemini (summarization).

Code comments and commit content in this repo are written in Spanish; match that convention when editing existing files.

## Commands

```bash
npm run dev                    # dev server (localhost:3000)
npm run build                  # production build
npm run lint                   # eslint

npx prisma generate            # regenerate Prisma client after schema changes
npx prisma migrate dev         # create/apply a migration in dev
npx prisma studio              # visual DB browser

npm run worker:transcription   # run only the transcription worker (tsx watch)
npm run worker:summary         # run only the summary worker (tsx watch)
npm run workers                # run both workers in one process (dev convenience)
```

There is no test suite configured in this repo.

Local dev requires a running PostgreSQL and Redis instance (see `.env.example` for `DATABASE_URL` / `REDIS_URL`). Background jobs are processed by the worker processes above, not by the Next.js server — both `npm run dev` and a worker process need to be running for the full pipeline (transcription → summary) to complete.

## Architecture

### Pipeline: Meeting → Recording → Transcript → Summary

1. **Meeting creation** (`app/api/meetings/route.ts`): creates a `Meeting` row, then calls `createBot` (`lib/recall.ts`) to have Recall.ai join the call (Google Meet or Microsoft Teams — platform is validated/detected via `lib/meeting-platform.ts`) at `scheduledAt`. Failure to create the bot marks the meeting `FAILED` but keeps the row.
2. **Bot status updates** (`app/api/webhooks/recall/route.ts`): Recall.ai webhook, HMAC-SHA256 verified (Standard Webhooks scheme). Maps bot lifecycle events to `MeetingStatus` (`JOINING` → `RECORDING` → `PROCESSING`). On `bot.done`, fetches the recording download URL and enqueues a transcription job (`addTranscriptionJob`) — the worker (not the webhook) decides the final status.
3. **Transcription worker** (`workers/transcription-worker.ts`, BullMQ): downloads/transcribes via Deepgram (`lib/deepgram.ts`), resolves numeric speaker labels ("Speaker 0") to real names using Recall's speaker timeline (`lib/speaker-names.ts` + `getSpeakerTimeline`), upserts the `Transcript`, sets `Meeting.status = COMPLETED`, then enqueues the summary job.
4. **Summary worker** (`workers/summary-worker.ts`, BullMQ): chunks the transcript (`lib/transcript-chunking.ts`), calls Gemini (`lib/gemini.ts`) to produce `executiveSummary`, `keyDecisions`, and `tasks`, then writes `Summary` + `Task` rows inside a single `$transaction` (delete-all + recreate tasks, so retries don't duplicate). Unlike the transcription worker, a final failure here does **not** mark the `Meeting` as `FAILED` — the transcript is still valuable even without an AI summary.

Both workers are meant to run as separate long-lived processes (`npm run worker:transcription` / `npm run worker:summary`), not inside the Next.js server. `workers/index.ts` is a dev convenience that imports both for a single-process run.

### Queues (`lib/queues/`)

Each queue module (`transcription.ts`, `summary.ts`) lazily constructs its BullMQ `Queue` on first use (module-level singleton via `globalThis`), specifically so `next build` — which statically evaluates route modules — doesn't try to open a Redis connection at build time. Follow this lazy-init pattern for any new queue.

### Multi-tenancy (Clerk Organizations)

- `Organization` and `User` Prisma rows are kept in sync with Clerk via `app/api/webhooks/clerk/route.ts` (`organization.created/updated`, `organizationMembership.created` → upsert).
- `middleware.ts` gates all `/dashboard(.*)` routes behind `auth.protect()` and requires an active `orgId`; users without one are redirected to `/onboarding`. `/onboarding(.*)` itself only requires authentication.
- API routes that mutate data resolve the Prisma `Organization`/`User` by `clerkOrgId`/`clerkUserId` from `auth()` — see `app/api/meetings/route.ts` for the pattern (404/409 if Clerk data hasn't synced yet via webhook).

### Data model (`prisma/schema.prisma`)

`Organization` → `User`/`Meeting` → `Transcript` (1:1) and `Summary` (1:1) → `Task` (1:many). `Meeting.status` (`MeetingStatus` enum: `SCHEDULED → JOINING → RECORDING → PROCESSING → COMPLETED`, or `FAILED`) is the single source of truth for pipeline progress and drives UI state (`components/dashboard/meeting-status-badge.tsx`, `meeting-processing-state.tsx`).

### External API wrappers (`lib/`)

- `lib/recall.ts` — Recall.ai REST client (bot creation/status, recording URLs, speaker timeline). Region-configurable via `RECALL_API_REGION`.
- `lib/deepgram.ts` — audio transcription/diarization.
- `lib/gemini.ts` — Gemini call that turns a transcript into structured minutes (summary/decisions/tasks).
- `lib/prisma.ts` — Prisma client singleton (standard Next.js `globalThis` pattern to survive HMR).

`next.config.ts` excludes `bullmq`, `ioredis`, and `pdfkit` from the server bundle via `serverExternalPackages` — `pdfkit` needs real `require()` for its on-disk `.afm` font files, and `bullmq`'s optional `@valkey/valkey-glide` dependency isn't used (ioredis is the Redis client).

### PDF export

`app/api/meetings/[id]/pdf/route.ts` uses `pdfkit` to render meeting minutes server-side; triggered from `components/dashboard/export-pdf-button.tsx`.

## UI conventions

- shadcn/ui primitives live in `components/ui/`; feature components in `components/dashboard/`.
- Dark theme by default (per README); Clerk components should be themed to match (`@clerk/themes`).
- Path alias `@/*` maps to the repo root (see `tsconfig.json`).
