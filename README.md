# Co-Dispach

I built Co-Dispach as a dispatcher workstation demo for the Trucker Path + ElevenLabs hackathon, and the main idea was to keep it focused on the four moments that actually look good in a live demo rather than turning it into a giant general-purpose TMS. The app runs on Next.js 14 with Prisma, Mapbox, and a synthetic NavPro mode by default, so it will still work even before live carrier credentials are ready.

The product flow is pretty simple once it is running. Morning triage will show who is ready to drive, load assignment will rank drivers and explain the choice, backhaul pairing will show the round-trip margin story, and proactive monitoring will draft interventions plus the voice escalation path. That kept the demo small enough to finish while still looking like a real dispatch tool.

## Stack

I kept the stack narrow on purpose, so there would be less setup noise and fewer moving parts during deployment. The frontend and API both live in the same Next.js app, Prisma handles the database layer, Supabase is the production Postgres target, Mapbox renders the live map, and the AI and voice integrations stay optional behind environment variables.

## Local setup

1. Install dependencies and create a local env file.

```bash
npm install
cp .env.example .env.local
```

2. Create a Supabase project for development, then put real values into `DATABASE_URL`, `DIRECT_URL`, and `TEST_DATABASE_URL` in `.env.local`.

3. Apply the checked-in Prisma migration, generate the client, and clear any old seeded rows.

```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

4. Start the app.

```bash
npm run dev
```

5. Open the main workstation and the demo routes.

```text
/
/morning-triage
/load-assignment
/backhaul-pairing
/proactive-monitoring
```

## Env

There are three database variables now, and I split them on purpose so deployment is safer. `DATABASE_URL` is the runtime connection the app will use in Next.js, `DIRECT_URL` is the direct Postgres connection Prisma will use for migrations, and `TEST_DATABASE_URL` is only for the database-backed test suite. That test database should not point at the same database as runtime, otherwise the test helper will stop immediately.

The first production deploy should keep `USE_SYNTHETIC_NAVPRO=true`, because that gives a stable demo even if live NavPro credentials are still incomplete. `NEXT_PUBLIC_MAPBOX_TOKEN` is required for the map to render correctly, while `GROQ_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_AGENT_ID`, `NAVPRO_CLIENT_ID`, and `NAVPRO_JWT` are optional until I want to switch specific flows from fallback mode to live services.

## Tests

I changed the repo so tests no longer rebuild a local SQLite file. Database-backed tests will now use `TEST_DATABASE_URL`, and they will refuse to run if that URL is missing or if it matches `DATABASE_URL`. That makes the failure mode more annoying at first, but it is a lot safer once the app is pointed at a real hosted database.

Run the checks with:

```bash
npm test
npm run build
```

If the database-backed tests fail right away, the first thing I would check is whether `TEST_DATABASE_URL` points at a migrated non-production Postgres database.

## Deploy

The intended production branch is `main`, and the intended Vercel slug is `co-dispach`. I named the Supabase project `chugmilk`, which keeps the infra label short while the public app can still use the product-facing name.

1. Push the cleaned branch state to `main`.

2. Create the Supabase project and capture the direct Postgres connection string plus the runtime connection string.

3. Create or link the Vercel project as `co-dispach`, then add the required env vars in Vercel.

4. Run the Prisma migration against Supabase before the first production rollout.

```bash
npm run prisma:deploy
```

5. Deploy a preview first, verify the workstation pages plus the API routes, and only then promote production from `main`.

The main pages I check after deployment are `/`, `/morning-triage`, `/load-assignment`, `/backhaul-pairing`, and `/proactive-monitoring`. The API endpoints I check first are `/api/fleet/snapshot`, `/api/routes`, `/api/monitor/feed`, and `/api/voice/speak`, because if those are healthy the rest of the demo is usually in decent shape too.

## Notes

I removed the old planning docs from the repo on purpose, because they were useful while I was building the prototype but they were starting to get in the way once the codebase became the source of truth. `AGENTS.md` is still here because it carries repo instructions, while this README is now the single handoff doc for setup and deployment.
