# Free API Keys — Checklist & Links

> Collect all of these before Phase 0 ends. Every key below is genuinely free at our usage level.
> **Every phase gate will ask you "are the keys for the next phase in `.env.local`?"**

Copy `.env.example` to `.env.local` and fill in as you go.

---

## 1. NavPro (the long-pole blocker — Agent A, Phase 0)

**What it is:** Trucker Path's fleet API. Drivers, GPS trails, trips, POIs, documents. The whole integration target.

**How to get it — Option A (self-serve, faster):**
1. Go to https://navpro.qa-websit.truckerpath.com/setting/api-docs
2. Sign in / create account
3. "API Docs" module → generate credentials
4. Copy JWT and Client Identifier

**Option B (email):**
- Email `integrations@truckerpath.com` with First/Last Name, Email, Company Name
- Response time varies — start Option A first

**Paste into `.env.local`:**
```bash
NAVPRO_BASE_URL=https://api.truckerpath.com/navpro
NAVPRO_JWT=<long JWT string starting with eyJ...>
NAVPRO_CLIENT_ID=<client identifier>
```

**Smoke test:**
```bash
curl -H "Authorization: Bearer $NAVPRO_JWT" \
     -X POST "$NAVPRO_BASE_URL/api/driver/query" \
     -H "Content-Type: application/json" \
     -d '{}'
```
Expect `200 OK` with JSON body.

---

## 2. Groq — primary LLM (Agent B, Phase 0)

**What it is:** Ultra-fast inference for Llama 3.3 70B. Free tier is generous. Our default model.

**Get it:** https://console.groq.com → sign up → "API Keys" → create new key.

**Paste into `.env.local`:**
```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

**Smoke test:**
```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"ping"}]}'
```

---

## 3. Gemini — fallback LLM (Agent B, Phase 0)

**What it is:** Google's free-tier LLM. Used when Groq rate-limits or errors. Also serves the "LLM-agnostic" pitch.

**Get it:** https://aistudio.google.com/app/apikey → "Create API key" → copy.

**Paste into `.env.local`:**
```bash
GEMINI_API_KEY=AIzaSy...
```

**Smoke test:**
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"ping"}]}]}'
```

---

## 4. ElevenLabs — voice (Agent B, Phase 0 — TIME-SENSITIVE)

**What it is:** Generative voice AI. Powers Act 3 ("Maria, truck 14 has been stopped…"). Winning this side track requires ElevenLabs integration.

**Get it (hackathon special):**
1. Join ElevenLabs Discord: https://discord.gg/elevenlabs
2. Go to `#coupon-codes` channel
3. Click **"Start Redemption"**
4. Fill the form with your **hackathon registration email** (emails are pre-loaded 72h before event)
5. You'll receive a DM with your API code — claim activates 1 month free Creator tier ($22/mo value)

**Paste into `.env.local`:**
```bash
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # "Rachel" — professional American female, good default
```

**Smoke test (TTS):**
```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/$ELEVENLABS_VOICE_ID" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test","model_id":"eleven_turbo_v2_5"}' \
  --output test.mp3
```
Expect `test.mp3` with audible speech.

## 5. Mapbox — the fleet map (Agent C, Phase 0)

**What it is:** Real interactive map. Free tier = 50K map loads/month, plenty for a demo.

**Get it:** https://account.mapbox.com → sign up → Tokens page → copy default public token (starts `pk.`).

**Paste into `.env.local`:**
```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
```

(The `NEXT_PUBLIC_` prefix is required — it's used client-side.)

**Smoke test:** Render a blank `<Map />` component in the browser and verify tiles load.

---

## 6. Database — local SQLite (Agent A, Phase 0)

**What it is:** File-based DB via Prisma. No account, no key — but needs an env line.

```bash
DATABASE_URL=file:./dev.db
```

Run `npx prisma migrate dev --name init` in Phase 1 and the file appears. `.gitignore` the `.db` file.

---

## 7. Vercel — hosting (all agents, Phase 6)

**What it is:** Where the deployed URL lives. Free tier more than enough.

**Get it:** https://vercel.com → sign up with GitHub → import the repo → it auto-deploys on every push to `main`.

**Env vars in Vercel dashboard:** Paste every key from `.env.local` into Vercel's Environment Variables (Production + Preview). **Don't forget `NEXT_PUBLIC_MAPBOX_TOKEN` — without it the map breaks in production.**

---

## Full `.env.example` (copy to `.env.local`)

```bash
# NavPro (Agent A)
NAVPRO_BASE_URL=https://api.truckerpath.com/navpro
NAVPRO_JWT=
NAVPRO_CLIENT_ID=

# LLMs (Agent B)
GROQ_API_KEY=
GEMINI_API_KEY=

# Voice (Agent B)
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Map (Agent C)
NEXT_PUBLIC_MAPBOX_TOKEN=

# DB (Agent A)
DATABASE_URL=file:./dev.db

# Optional — for emergency NavPro-down fallback
USE_NAVPRO_MOCK=false
```

---

## Which phase needs what

| Phase | Must already be set | First used by |
|---|---|---|
| 0 | — (you're collecting) | — |
| 1 | `NAVPRO_*`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `DATABASE_URL` | A's snapshot endpoint, C's map |
| 2 | `GROQ_API_KEY`, `GEMINI_API_KEY` | B's agent loop |
| 3 | (same as 2) | — |
| 4 | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | B's voice routes |
| 5 | all | full dry-run |
| 6 | all (in Vercel dashboard too) | production deploy |

---

## When a key is missing

- The phase does not start.
- The phase's acceptance tests will fail.
- The agent owning that key is responsible for getting it, not guessing around its absence.
- If a key genuinely cannot be obtained in time (e.g. NavPro delay), the human sets `USE_NAVPRO_MOCK=true` and we degrade gracefully — but only the human decides that.
