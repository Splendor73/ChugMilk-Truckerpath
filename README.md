# Co-Dispach

I built Co-Dispach as a dispatcher workstation demo for the Trucker Path + ElevenLabs hackathon, and I kept the scope pretty tight so the app would feel real in a live demo without turning into a giant half-finished TMS. The whole project is centered around four flows that dispatchers actually care about, which are morning triage, explainable load assignment, backhaul pairing, and proactive monitoring with a voice escalation path.

The repo is a single Next.js 14 app with both the UI and the API routes inside it. Prisma is the database layer, Supabase is the production Postgres target, Mapbox handles the map, and the carrier side runs in synthetic NavPro mode by default so the demo still works even before live credentials are ready.

## What it does

1. Morning triage will show who is ready to run, who is low on hours, and which drivers already have an issue that dispatch should notice first.
2. Load assignment will score the candidate drivers and explain why the top driver won instead of just dumping a ranking with no reasoning.
3. Backhaul pairing will take the outbound choice and look for a return load so the round-trip margin story is obvious in the UI.
4. Proactive monitoring will watch active trips, draft interventions, and support the ElevenLabs voice approval loop when I want the emotional demo moment.

## Local setup

1. Install dependencies and create a local env file.

```bash
npm install
cp .env.example .env.local
```

2. Create a Supabase project for development, then replace the placeholder values in `.env.local` with real database URLs plus the map token you want to use.

3. Apply the checked-in Prisma migration, generate the client, and clear old seed rows.

```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

4. Start the app.

```bash
npm run dev
```

5. Open the workstation and the demo routes.

```text
/
/morning-triage
/load-assignment
/backhaul-pairing
/proactive-monitoring
```

## Env

I split the database contract into three variables because it is safer once the app is hosted. `DATABASE_URL` is the runtime connection that Next.js will use, `DIRECT_URL` is the direct Postgres connection Prisma will use for migrations, and `TEST_DATABASE_URL` is only for the database-backed test suite. That last one must not point at the same database as runtime, because the test helper will stop immediately if it does.

`USE_SYNTHETIC_NAVPRO=true` is the right default for the first production deploy, since it keeps the demo stable while the live integration is still optional. `NEXT_PUBLIC_MAPBOX_TOKEN` is required for the map, while `GROQ_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_AGENT_ID`, `NAVPRO_CLIENT_ID`, and `NAVPRO_JWT` can stay empty until I actually want those paths to go live.

## Tests

I removed the old SQLite bootstrap flow, so the database-backed tests now expect a migrated Postgres test database instead of rebuilding `prisma/dev.db`. That makes the setup a bit stricter, but it also means the test suite will stop doing dangerous things once the app has a real hosted database behind it.

Run the checks with:

```bash
npm test
npm run build
```

If the database-backed tests fail right away, the first thing I would check is `TEST_DATABASE_URL`, then I would make sure the Prisma migration has already been applied to that non-production database.

## Deploy

The intended production branch is `main`, the Vercel project slug is `co-dispach`, and the Supabase project name is `chugmilk`. I kept the infra names short, while the UI can still use the product-facing label.

1. Push the cleaned branch state to `main`.
2. Create the Supabase project and copy the runtime plus direct Postgres URLs.
3. Create or link the Vercel project as `co-dispach`.
4. Add the required environment variables in Vercel.
5. Run the Prisma migration against Supabase before the first production rollout.

```bash
npm run prisma:deploy
```

6. Deploy a preview first, check the app shell and API routes, then promote production from `main`.

The first pages I check after deploy are `/`, `/morning-triage`, `/load-assignment`, `/backhaul-pairing`, and `/proactive-monitoring`. The first API routes I check are `/api/fleet/snapshot`, `/api/routes`, `/api/monitor/feed`, and `/api/voice/speak`, because if those are healthy the rest of the demo is usually in decent shape too.

## Notes

I removed the old planning docs on purpose because they were useful while I was building the prototype, but after the app became real code they were mostly just stale context. `AGENTS.md` stays in the repo because it is instruction metadata, while this README is now the single handoff doc for setup and deployment.
