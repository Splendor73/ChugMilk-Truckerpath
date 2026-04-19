# Co-Dispatch — Master Build Plan (for 3 parallel CLI agents)

> One human orchestrator. Three CLI coding agents running in parallel. 48 hours. One deployed URL that wins the Trucker Path + ElevenLabs tracks at GlobeHack Season 1.
>
> **This is the only document your agents need.** It carries the full project context, the file-ownership rules that keep three agents from overwriting each other, the frozen interface contracts, and the phase-by-phase build with tests and a human-approval gate after every phase.

---

## Table of contents

1. [How to use this document](#1-how-to-use-this-document)
2. [What we're building — Co-Dispatch](#2-what-were-building--co-dispatch)
3. [Stack & architecture](#3-stack--architecture)
4. [Three parallel agents — lane discipline](#4-three-parallel-agents--lane-discipline)
5. [Frozen interface contracts (do not edit after Phase 1)](#5-frozen-interface-contracts)
6. [All free API keys — collect before Phase 0 ends](#6-all-free-api-keys)
7. [The phases](#7-the-phases) — each with tasks, tests, report-update, human gate
   - [Phase 0 — Setup & keys](#phase-0--setup--keys-hours-02)
   - [Phase 1 — Foundation & contracts](#phase-1--foundation--contracts-hours-26)
   - [Phase 2 — Workflow 1 + 2 end-to-end](#phase-2--workflow-1--2-end-to-end-hours-612)
   - [Phase 3 — Workflow 3 backhaul (the money shot)](#phase-3--workflow-3-backhaul-hours-1216)
   - [Sleep](#sleep-4-6-hours-non-negotiable)
   - [Phase 4 — Workflow 4 voice + monitoring](#phase-4--workflow-4-voice--monitoring-day-2-hours-06)
   - [Phase 5 — Polish & rehearse](#phase-5--polish--rehearse-day-2-hours-610)
   - [Phase 6 — Deck, GTM & submit](#phase-6--deck-gtm--submit-day-2-hours-1012)
8. [Progress report template](#8-progress-report-template)
9. [Demo script (3 acts + closer)](#9-demo-script)
10. [Risk register](#10-risk-register)
11. [What we deliberately do NOT build](#11-what-we-deliberately-do-not-build)

---

## 1. How to use this document

**You (human) are the orchestrator.** You run three CLI coding agents (Cursor, Cline, Aider, Continue, Claude Code — any of them) in three different terminal windows, each working in the same repo checkout.

**Each agent has a lane — a fixed set of files it is allowed to touch.** An agent that strays out of its lane breaks the other two agents' work. The lane map is in [Section 4](#4-three-parallel-agents--lane-discipline). Paste it into every agent's system prompt.

**Work is broken into phases.** Each phase has:

- 🎯 **Goal** — one sentence
- ⏱️ **Time budget** — how long it should take
- 🔑 **Keys needed** — what env vars must exist before starting
- 👤 **A / B / C tasks** — exact ordered task list per agent
- ✅ **Acceptance tests** — concrete curl commands or manual steps that must pass
- 📝 **Report update** — what each agent appends to `PROGRESS_REPORT.md`
- 🚦 **Human gate** — you review, optionally say "change X before Phase N+1", then release the next phase

**The human gate is non-negotiable.** After every phase, all three agents stop. You read the report. You confirm keys for the next phase are in `.env`. You answer the gate question *"anything you'd like to do differently in the next phase?"* If yes, you rewrite the next phase's tasks before releasing it. If no, you paste "Phase N+1 release — proceed as written" into each terminal.

**Shared files are frozen.** `shared/contracts.ts`, `package.json`, `prisma/schema.prisma`, `.env.example`, and this `README.md` may only be edited with explicit human approval *in the chat*. If an agent wants to change one, it must stop and ask.

---

## 2. What we're building — Co-Dispatch

### The one-line pitch
Trucker Path already has the inputs. We're the layer that turns them into decisions.

### The problem (in Trucker Path's own words from their deck)
Small fleets (5–50 trucks) run on spreadsheets and phone calls. Dispatcher Maria spends her morning texting 20 drivers to figure out who's ready, picks loads from memory and often picks wrong, finds out about breakdowns from the *customer* not the system, and chases paper for every invoice. Their own slide calls this "**two good halves, glued together with phone calls**" — the driver side (NavPro mobile) works, the dispatcher side (Command portal) works, but there's no intelligence layer between them.

### The product
Co-Dispatch is a web app that sits next to NavPro as a co-pilot for dispatchers. It runs exactly **four workflows** end-to-end — no kitchen-sink chatbot, no auth, no settings, no light mode. Every pixel is a decision being made.

| # | Workflow | Kills this moment in Maria's day | Demo weight |
|---|---|---|---|
| 1 | **Morning triage** | 7am, "she still texts 20 drivers" | Act 1 (30s) |
| 2 | **Explainable load assignment** | 9am, "she picks from memory — and often picks wrong" | Act 2 part A (60s) |
| 3 | **Backhaul pairing** | same dispatch moment — round-trip instead of one-way | Act 2 part B, centerpiece (30s) |
| 4 | **Proactive monitoring with voice** | 11am, "loads in transit go dark until something breaks" | Act 3 emotional peak (60s) |

We hit two of the Trucker Path track's five key areas explicitly (**Smart Dispatch** via #1 #2, **Proactive Alerts** via #4) and implicitly claim a third (**Cost Intelligence**) via the decision log — satisfying the brief's "must address at least TWO" requirement.

Workflow 4 also satisfies the **ElevenLabs side track** — Maria gets a real-voice phone call with "say 'execute' to approve" — which wins us the bonus prize automatically.

### Why this wins (four layers)
1. Directly attacks the stated judging criterion — "reducing cost per mile and driver downtime." Deadhead miles are literally cost per mile; backhaul fills the empty return.
2. Genuinely novel in a live-API, real-time context. No other team will think of backhaul pairing at the moment of dispatch.
3. Upsells Trucker Path's own TruckLoads marketplace (150K loads/day product they already own) — judges see revenue alignment for their own business.
4. It's the most visual demo moment — a before/after round-trip profit comparison that judges photograph.

---

## 3. Stack & architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 (App Router) + TypeScript** | One language, one deploy, three agents share mental model |
| UI | Tailwind + shadcn/ui, **dark theme only** | Ops-terminal aesthetic, one-command install |
| Map | Mapbox GL JS | Real map is non-negotiable for credibility — 50K loads/month free |
| Database | SQLite via Prisma | Zero config, file-based, free |
| Fleet data | **NavPro API** (`api.truckerpath.com/navpro`) | The real integration target |
| Load marketplace | Mock `loadBroker.ts` seeded with 500 US loads | Zero external dependencies |
| LLM | **Groq Llama 3.3 70B** primary, **Gemini 2.0 Flash** fallback | Free, fast, swappable — supports the "LLM-agnostic" pitch |
| Voice | **ElevenLabs** TTS + Conversational Agent | Wins the side track, emotional peak of demo |
| Hosting | Vercel free tier | `git push` deploys |

### Architecture diagram (for slide 3 of the deck)

```
 NavPro API               Agent layer (Groq/Gemini)             UI + Voice
 ┌──────────┐              ┌─────────────────────┐             ┌──────────────┐
 │ drivers  │──┐           │ 5 tools:            │             │ LoadInbox    │
 │ tracking │  │           │ - get_fleet_snap    │             │ FleetMap     │
 │ trips    │──┼─► lib/    │ - score_assign      │──► stream ──│ DriverRank   │
 │ POIs     │  │ navpro.ts │ - find_backhauls    │             │ BackhaulModal│
 └──────────┘  │           │ - monitor_trips     │             │ VoiceAlert   │
 ┌──────────┐  │           │ - draft_intervention│             │ DecisionLog  │
 │loadBroker│──┘           └──────────┬──────────┘             └──────┬───────┘
 │  (mock)  │                         │                               │
 └──────────┘                         ▼                               ▼
                               ┌──────────┐                   ┌────────────┐
                               │ scoring  │                   │ ElevenLabs │
                               │ backhaul │                   │ TTS + Conv │
                               │ (pure)   │                   └────────────┘
                               └────┬─────┘
                                    ▼
                          ┌────────────────────┐
                          │ Prisma / SQLite    │
                          │ DecisionLog        │
                          │ LoadAssignment     │
                          │ ActiveTrip         │
                          │ InterventionDraft  │
                          └────────────────────┘
```

### Folder layout (locked)

```
/
├── app/
│   ├── page.tsx                       [C owns]
│   ├── layout.tsx                     [C owns]
│   ├── globals.css                    [C owns]
│   └── api/
│       ├── fleet/snapshot/route.ts    [A owns]
│       ├── fleet/assignments/route.ts [A owns]
│       ├── dev/simulate/route.ts      [A owns]
│       ├── agent/route.ts             [B owns]
│       ├── monitor/route.ts           [B owns]
│       └── voice/
│           ├── speak/route.ts         [B owns]
│           └── listen/route.ts        [B owns]
├── components/                        [C owns entire folder]
├── lib/
│   ├── navpro.ts                      [A owns]
│   ├── loadBroker.ts                  [A owns]
│   ├── llm.ts                         [B owns]
│   ├── scoring.ts                     [B owns]
│   ├── backhaul.ts                    [B owns]
│   ├── agent.ts                       [B owns]
│   └── voice.ts                       [B owns]
├── prisma/
│   ├── schema.prisma                  [A owns, B+C read only]
│   └── seed.ts                        [A owns]
├── data/
│   └── loads.seed.json                [A owns]
├── shared/
│   └── contracts.ts                   [FROZEN — human approval to edit]
├── .env.example                       [FROZEN]
├── .env.local                         [human creates, gitignored]
├── package.json                       [FROZEN]
├── PROGRESS_REPORT.md                 [all three append]
├── DEMO_SCRIPT.md                     [C owns in Phase 5]
└── README.md                          [this file — FROZEN]
```

---

## 4. Three parallel agents — lane discipline

> **Copy the whole of this section into every agent's system prompt before starting.**

### Person A — The Data Spine
Owns all data in and out. Nobody else touches the data layer. If B or C needs drivers or loads, they call A's HTTP endpoints. A is also the human whose **first real-world task** is getting NavPro demo credentials — that's the long pole that blocks everybody.

**A's lane (may edit):**
- `lib/navpro.ts`
- `lib/loadBroker.ts`
- `prisma/schema.prisma`, `prisma/seed.ts`
- `data/loads.seed.json`
- `app/api/fleet/**`
- `app/api/dev/**`

**A may NOT edit anything under `components/`, `lib/{llm,scoring,backhaul,agent,voice}.ts`, `app/api/{agent,monitor,voice}/**`, or `app/page.tsx`.**

### Person B — The Brain
Owns the AI layer, scoring math, agent tool loop, and voice. Zero UI code. All business logic is testable with `curl` before C wires it to the UI.

**B's lane (may edit):**
- `lib/llm.ts`
- `lib/scoring.ts`
- `lib/backhaul.ts`
- `lib/agent.ts`
- `lib/voice.ts`
- `app/api/agent/**`
- `app/api/monitor/**`
- `app/api/voice/**`

**B may NOT edit anything under `components/`, `lib/{navpro,loadBroker}.ts`, `app/api/{fleet,dev}/**`, or `app/page.tsx`, `prisma/**`.**

### Person C — The Face
Owns everything the judges see. No backend code. No direct calls to NavPro, Groq, or ElevenLabs — only calls to A's and B's endpoints. C is also the primary demo presenter because they'll know the UI cold.

**C's lane (may edit):**
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`
- `components/**` (entire folder)
- `tailwind.config.ts`

**C may NOT edit anything under `lib/**`, `app/api/**`, or `prisma/**`.**

### Conflict rules
- If an agent realises it needs a file outside its lane, it **stops and asks the human** — it does not silently edit.
- `shared/contracts.ts` can only change through a human-announced "contract change" that all three agents acknowledge before resuming.
- Agents commit only to their own branch (`track/a-data`, `track/b-brain`, `track/c-face`). Human merges to `main` at the end of each phase gate.

---

## 5. Frozen interface contracts

> **This section is the single source of truth between the three lanes.** A produces these types, B consumes and produces, C consumes only. File: `shared/contracts.ts`. Frozen at end of Phase 1 — any change requires human approval.

```ts
// ============ Core domain types ============

export type HOSStatus = "fresh" | "low" | "must_rest";

export interface Driver {
  driverId: number;          // from NavPro /api/driver/query
  name: string;
  phone: string;
  homeBase: { lat: number; lng: number; city: string };
  currentLocation: { lat: number; lng: number; updatedAtMs: number };
  hosRemainingMin: number;   // drive-time minutes left in 11/14/70-hr clocks (min of three)
  hosStatus: HOSStatus;      // fresh >= 360 min, low < 360 & >= 120, must_rest < 120
  complianceFlags: ComplianceFlag[];
  activeTripId: string | null;
}

export interface ComplianceFlag {
  kind: "inspection_expiring" | "fatigue_pattern" | "missed_inspection";
  severity: "info" | "warn" | "critical";
  message: string;            // one human-readable line
}

export interface Load {
  loadId: string;             // "TL-00042" for mock, NavPro load_id for real
  source: "paste" | "pdf" | "broker_mock" | "navpro";
  origin: { lat: number; lng: number; city: string; state: string };
  destination: { lat: number; lng: number; city: string; state: string };
  pickupStartMs: number;
  pickupEndMs: number;
  rateUsd: number;
  weightLbs?: number;
  commodity?: string;
  customer?: string;
}

// ============ Fleet snapshot (A's output, B + C consume) ============

export interface FleetSnapshot {
  fetchedAtMs: number;
  drivers: Driver[];
  activeTrips: ActiveTrip[];
  pendingLoads: Load[];
  morningBrief: {
    readyCount: number;
    restSoonCount: number;
    complianceFlagCount: number;
    inMaintenanceCount: number;
    headline: string;          // one-liner the UI renders verbatim
  };
}

export interface ActiveTrip {
  tripId: string;              // NavPro trip_id
  driverId: number;
  loadId: string;
  currentLoc: { lat: number; lng: number };
  etaMs: number;
  status: "on_track" | "route_deviation" | "long_idle" | "hos_risk" | "eta_slip";
  plannedRoute: Array<{ lat: number; lng: number }>;
}

// ============ Scoring (B's output) ============

export interface DriverScore {
  driverId: number;
  driverName: string;
  score: number;                 // 0..100, higher is better
  deadheadMiles: number;
  hosCheck: { requiredMin: number; availableMin: number; pass: boolean };
  fuelCostUsd: number;
  etaConfidence: number;         // 0..1
  rippleImpact: { affectedLoads: number; deltaUsd: number };
  rationale: string;             // one paragraph, LLM-formatted, math already computed
  eliminated: boolean;           // true if HOS/compliance hard-fails
  eliminationReason?: string;
}

// ============ Backhaul (B's output) ============

export interface BackhaulOption {
  outbound: Load;
  returnLoad: Load;
  totalRevenueUsd: number;
  totalDeadheadMiles: number;
  roundTripProfitUsd: number;
  oneWayProfitUsd: number;       // for the comparison bar
  hosFeasible: boolean;
  narrative: string;             // "SFO → Vegas → Phoenix, 85 total deadhead miles"
}

// ============ Intervention (B's output for Act 3) ============

export interface InterventionDraft {
  tripId: string;
  trigger: "route_deviation" | "long_idle" | "hos_risk" | "eta_slip";
  customerSms: string;
  relayDriverId: number | null;
  relayDriverName: string | null;
  relayDistanceMi: number | null;
  rerouteNeeded: boolean;
  voiceScript: string;           // verbatim ElevenLabs script
  createdAtMs: number;
}

// ============ Agent tool schemas (B owns, UI reads) ============

export type AgentTool =
  | "get_fleet_snapshot"
  | "score_assignment"
  | "find_backhauls"
  | "monitor_trips"
  | "draft_intervention";

export interface AgentStreamEvent {
  type: "token" | "tool_call" | "tool_result" | "final" | "error";
  payload: unknown;
}
```

### HTTP contract between A/B and the UI (C)

| Method | Path | Owner | Request | Response |
|---|---|---|---|---|
| GET | `/api/fleet/snapshot` | A | — | `FleetSnapshot` |
| POST | `/api/fleet/assignments` | A | `{driverId, loadId, returnLoadId?}` | `{tripId, returnTripId?}` |
| POST | `/api/dev/simulate` | A | `{tripId, scenario: "breakdown"\|"route_deviation"\|"eta_slip"}` | `{ok: true}` |
| POST | `/api/agent` | B | `{userMessage: string, context?: object}` | SSE stream of `AgentStreamEvent` |
| POST | `/api/agent/score` | B | `{load: Load}` | `DriverScore[]` sorted desc |
| POST | `/api/agent/backhaul` | B | `{outboundLoadId, driverId}` | `BackhaulOption[]` |
| POST | `/api/monitor/tick` | B | — | `{interventionsCreated: number}` |
| POST | `/api/voice/speak` | B | `{text: string, voiceId?: string}` | `audio/mpeg` stream |
| POST | `/api/voice/listen` | B | `{audioBase64: string}` | `{transcript: string, matchedCommand: string \| null}` |

---

## 6. All free API keys

**Collect all of these before Phase 0 ends.** All are genuinely free for our usage level.

### `.env.local` template

```bash
# ---- NavPro (Person A gets these — LONG POLE) ----
# Self-service: log in at https://navpro.qa-websit.truckerpath.com/setting/api-docs
# Or email integrations@truckerpath.com with name/company
NAVPRO_BASE_URL=https://api.truckerpath.com/navpro
NAVPRO_JWT=<paste JWT bearer token>
NAVPRO_CLIENT_ID=<paste client identifier>

# ---- Groq (primary LLM) ----
# Sign up at https://console.groq.com — free tier includes Llama 3.3 70B
GROQ_API_KEY=gsk_...

# ---- Gemini (fallback LLM) ----
# https://aistudio.google.com/app/apikey — free tier
GEMINI_API_KEY=...

# ---- ElevenLabs (voice — SIDE TRACK PREREQUISITE) ----
# Claim 1 month free Creator tier via Discord #coupon-codes channel
# (emails pre-loaded 72h before event — do this NOW if not done)
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # "Rachel" default, professional American female

# ---- Mapbox ----
# https://account.mapbox.com — free tier 50K loads/month
NEXT_PUBLIC_MAPBOX_TOKEN=pk....

# ---- Database ----
DATABASE_URL=file:./dev.db
```

### Where each phase needs what

| Phase | Needs | Checked by |
|---|---|---|
| 0 | — | — |
| 1 | `NAVPRO_*`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `DATABASE_URL` | A hits NavPro, C renders Mapbox |
| 2 | `GROQ_API_KEY`, `GEMINI_API_KEY` added | B's agent loop runs |
| 3 | (same) | — |
| 4 | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | B's voice route streams audio |
| 5 | (all) | full demo dry-run |
| 6 | Vercel account | `vercel deploy --prod` |

**Every phase gate will ask you: "Are the keys for the next phase in `.env.local`?"** If no, the phase does not start.

---

## 7. The phases

Each phase follows the same rhythm:

1. Human pastes the phase header into each agent's terminal.
2. Agents do their tasks on their own branches.
3. Agents run acceptance tests.
4. Agents append to `PROGRESS_REPORT.md` using the template in [Section 8](#8-progress-report-template).
5. Human merges to `main`, reviews the report, and answers the gate question.
6. Human either releases next phase or pushes back with "change X before proceeding."

---

### Phase 0 — Setup & keys (hours 0–2)

🎯 **Goal** — Repo scaffolded, dependencies installed, `.env.local` fully populated, "hello world" deployed to Vercel. Zero features. Everyone proves their toolchain works before writing real code.

🔑 **Keys needed to enter this phase** — None.

🔑 **Keys this phase must collect** — All keys in [Section 6](#6-all-free-api-keys). Phase 1 cannot start until they are all in `.env.local`.

#### Human does first (before agents start)
1. `npx create-next-app@14 co-dispatch --typescript --tailwind --app --src-dir=false --eslint --import-alias="@/*"`
2. `cd co-dispatch && git init && git checkout -b main`
3. Copy this whole README + `PROGRESS_REPORT.md` template (Section 8) + `shared/contracts.ts` (Section 5) into the repo root.
4. Create three branches: `git branch track/a-data && git branch track/b-brain && git branch track/c-face`
5. Push to GitHub, connect Vercel project, verify auto-deploy on push to `main`.

#### 👤 A's tasks
1. Go to https://navpro.qa-websit.truckerpath.com/setting/api-docs and self-serve credentials, OR email `integrations@truckerpath.com`. **Do this first — it is the only blocker for everyone.**
2. Once logged in: invite 15–20 seed drivers spread across AZ / CA / NV with realistic names and phone numbers. Corridor suggestions: Phoenix, Tempe, Mesa, Flagstaff, LA, San Bernardino, Barstow, Las Vegas, Henderson, Bakersfield, Fresno, Oakland, SFO.
3. Paste `NAVPRO_JWT` and `NAVPRO_CLIENT_ID` into `.env.local`.
4. Run: `curl -H "Authorization: Bearer $NAVPRO_JWT" -X POST $NAVPRO_BASE_URL/api/driver/query -H "Content-Type: application/json" -d '{}'` — confirm 200 and non-empty driver list.

#### 👤 B's tasks
1. Sign up at https://console.groq.com → create API key → paste into `.env.local`.
2. Get Gemini key at https://aistudio.google.com/app/apikey → paste.
3. Claim ElevenLabs via their Discord `#coupon-codes` channel ("Start Redemption" using hackathon registration email) → paste API key.
4. Smoke test each: Groq `curl https://api.groq.com/openai/v1/chat/completions -H "Authorization: Bearer $GROQ_API_KEY" -H "Content-Type: application/json" -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"ping"}]}'` → 200 OK.

#### 👤 C's tasks
1. Install shadcn: `npx shadcn@latest init` → pick dark theme, slate base, CSS variables yes.
2. Install shadcn components we'll use: `npx shadcn@latest add button card dialog badge separator scroll-area tabs skeleton`
3. Install Mapbox: `npm i mapbox-gl` and `npm i -D @types/mapbox-gl`
4. Get Mapbox token at https://account.mapbox.com → paste into `.env.local`.
5. Replace `app/page.tsx` with a placeholder that renders a single centered `<h1>Co-Dispatch</h1>` in a dark-slate background. Commit and confirm Vercel auto-deploys it.

#### ✅ Acceptance tests (all must pass)
- [ ] `npm run dev` starts without errors.
- [ ] `git status` is clean on all three branches, `main` has the Vercel-deployed placeholder.
- [ ] `.env.local` has all six key groups filled.
- [ ] A's NavPro curl returns non-empty driver list.
- [ ] B's Groq curl returns a completion.
- [ ] Vercel preview URL loads the placeholder.

#### 📝 Report update
All three agents append their section under `## Phase 0` in `PROGRESS_REPORT.md` (template in Section 8). Include the deployed Vercel URL at the top.

#### 🚦 Human gate
Ask yourself and the team:
- Is every key in `.env.local`? If no → do not proceed.
- Did A actually hit NavPro and get real driver data back? If no → this is the only blocker — fix it before Phase 1.
- **Anything you want to do differently in Phase 1?** (Stack change? Different LLM? Skip backhaul? Now is the moment.) If yes, rewrite Phase 1's tasks before releasing.

Release command to paste into all three terminals: `Phase 1 release — proceed as written`.

---

### Phase 1 — Foundation & contracts (hours 2–6)

🎯 **Goal** — Freeze `shared/contracts.ts`. Each agent builds the skeleton of their own lane with mocked internals. By hour 6 there's a deployed URL that *looks like* the product but nothing is wired yet.

🔑 **Keys** — NavPro, Mapbox, Database already populated. Groq/Gemini will be first used in Phase 2 but paste them now anyway.

#### 👤 A's tasks (in order)
1. Copy Section 5's contracts into `shared/contracts.ts`. Commit. This file is now frozen.
2. Create `lib/navpro.ts` with typed wrappers — one function per endpoint below. Each wrapper reads `NAVPRO_BASE_URL` + `NAVPRO_JWT` from env and returns the response typed against the JSON schemas in `api-1.json`:
   - `queryDrivers()` → POST `/api/driver/query`
   - `queryDriverPerformance(driverId)` → POST `/api/driver/performance/query`
   - `getDriverDispatch(driverId, timeRange)` → POST `/api/tracking/get/driver-dispatch` (returns the GPS trail)
   - `createTrip(tripInfo)` → POST `/api/trip/create`
   - `queryTrips()` → (use the same pattern)
   - `queryPOI(params)` → POST `/api/poi/query`
   - `getRoutingProfiles()` → GET `/api/routing-profile/list`
3. Create `data/loads.seed.json` with 500 realistic loads — use real US city lat/lng, bias 60% of loads to the PHX/LA/SFO/Vegas corridor (for the backhaul demo), remaining 40% spread across the country. Rates $800–$4,500. Pickup windows within the next 14 days.
4. Create `lib/loadBroker.ts` exporting:
   - `listLoads(): Load[]` — reads the seed
   - `searchLoadsNearRoute(origin, destination, pickupWindow): Load[]` — haversine corridor filter, 50-mile tolerance from the straight line
5. Create `prisma/schema.prisma` with models: `DecisionLog`, `LoadAssignment`, `ActiveTripMirror` (for local monitoring state), `InterventionDraft`. Run `npx prisma migrate dev --name init`.
6. Create `app/api/fleet/snapshot/route.ts`: calls `queryDrivers`, then parallel `queryDriverPerformance` for each, synthesises `FleetSnapshot` per the contract, returns JSON. Compute HOS status per the rule in the contract (fresh ≥ 360 min, low < 360 & ≥ 120, must_rest < 120). Compute `morningBrief.headline` as: `"{readyCount} drivers ready to run, {restSoonCount} need rest within 2 hours, {complianceFlagCount} have compliance flags, {inMaintenanceCount} truck(s) in maintenance."`

#### 👤 B's tasks (in order)
1. Create `lib/llm.ts` exporting `callLLM(messages: LLMMessage[], tools?: LLMTool[]): Promise<LLMResponse>`. Internal structure: try Groq first (`llama-3.3-70b-versatile`), on 429/5xx fall back to Gemini 2.0 Flash. Tool-use support via OpenAI-style tool schemas — both Groq and Gemini accept this.
2. Create `lib/scoring.ts` exporting the pure function `scoreDriverForLoad(driver: Driver, load: Load, fleetState: FleetSnapshot): DriverScore`. **All math is pure — no LLM call here.** Formulas:
   - deadhead miles = haversine(driver.currentLocation, load.origin)
   - required min = (haversine(load.origin, load.destination) / 50 mph) * 60  + (deadhead / 50) * 60
   - hos pass = driver.hosRemainingMin >= requiredMin
   - fuel cost = totalMiles * $0.65 / mpg-equivalent factor (use $0.65/mile as the simple proxy — this is intentionally tunable)
   - ripple impact: count of pending loads within 100 miles of driver's home base that would now be unreachable — delta is negative
   - score = 100 - (deadhead * 0.3) - (hosPass ? 0 : 50) - (rippleImpact.affectedLoads * 5), clamped 0..100
   - rationale: format with LLM ONLY for prose polish — pass the computed numbers in, get a 2-sentence paragraph out
3. Create `lib/agent.ts` with the Groq tool-use loop. System prompt (use verbatim):
   ```
   You are Co-Dispatch, an AI assistant for small-fleet dispatchers. You have exactly five tools:
   get_fleet_snapshot, score_assignment, find_backhauls, monitor_trips, draft_intervention.
   Rules: (1) You refuse any question not about dispatching. (2) You always show the math —
   every ranking or recommendation must cite deadhead miles, HOS remaining, and dollar impact.
   (3) You never invent data — if a tool returns empty, say so. (4) Your replies are tight —
   max 4 sentences unless the user asks "explain". (5) When proposing an assignment, you ALWAYS
   run find_backhauls before your final recommendation.
   ```
4. Create `app/api/agent/route.ts`: POST handler, reads `{userMessage, context}`, runs the agent loop, streams `AgentStreamEvent` as SSE.
5. For Phase 1, `find_backhauls`, `monitor_trips`, `draft_intervention` can return hardcoded mocks — they get real implementations in Phases 3 and 4. But the tool schemas must already match the contract.

#### 👤 C's tasks (in order)
1. Lock the dark-theme design tokens in `app/globals.css`:
   ```css
   :root {
     --background: 222 47% 4%;      /* near-black slate */
     --foreground: 210 40% 98%;
     --card: 222 47% 7%;
     --border: 217 32% 17%;
     --accent: 142 76% 36%;          /* truck-green, matches NavPro brand */
     --warn: 38 92% 50%;
     --critical: 0 84% 60%;
     --mono: "JetBrains Mono", ui-monospace;
   }
   ```
2. Build the three-panel layout in `app/page.tsx`:
   - Left 25%: `<LoadInbox />`
   - Center 50%: `<FleetMap />`
   - Right 25%: `<AICopilot />`
   - Top bar: product name, live clock, "Decision Log" tab toggle
3. Build `components/LoadInbox.tsx`: paste zone (textarea) + file drop zone + a scrollable list of queued loads underneath. Use placeholder data until Phase 2.
4. Build `components/FleetMap.tsx`: Mapbox GL component centered on Phoenix, with 15 fake pins placed using mocked driver data. Pin colours by HOS status per contract. Active trip polylines drawn in `--accent`.
5. Build `components/DriverRankCard.tsx`: Bloomberg-terminal-style card. Monospace numbers. One score on the left big and bold. Right side: deadhead, HOS, fuel, ETA, ripple — each a label + value row. Expandable "why" section that reveals the `rationale` string. **This is where C spends extra polish hours — judges zoom in on this card.**
6. Build `components/BackhaulModal.tsx`: full-screen dialog. Left half: outbound route on a small map. Right half: return route on a small map. Bottom: a horizontal bar chart comparing one-way profit vs round-trip profit. Big green "Dispatch full round trip" button. Placeholder data fine.
7. Build `components/AICopilot.tsx`: chat-like pane. Messages render with the streamed tokens from `/api/agent`. Tool-call events render as small inline chips ("running: score_assignment").
8. Build `components/DecisionLog.tsx`: vertical timeline. Each entry: timestamp, action, math summary, outcome. Empty state for now.

#### ✅ Acceptance tests
- [ ] `curl http://localhost:3000/api/fleet/snapshot` returns a valid `FleetSnapshot` with ≥ 15 drivers from real NavPro.
- [ ] `tsc --noEmit` passes — no type errors against `shared/contracts.ts`.
- [ ] `curl -N -X POST http://localhost:3000/api/agent -H "Content-Type: application/json" -d '{"userMessage":"say hi"}'` streams at least one `token` event.
- [ ] Deployed Vercel URL shows three panels, a real Mapbox map with 15 pins, and the copilot pane renders placeholder chat.
- [ ] B can `curl` the agent endpoint with `{userMessage:"show fleet"}` and see `tool_call` events for `get_fleet_snapshot` even if the tool returns mock data.

#### 📝 Report update
All three agents append their Phase 1 section. A includes the exact driver IDs seeded. B includes the Groq model version and any fallback toggles. C includes a screenshot (or link to Vercel preview) of the three-panel layout.

#### 🚦 Human gate
- Is `shared/contracts.ts` frozen and committed? If C's or B's tsc fails, that means someone's using a different shape — fix now.
- Is the deployed URL showing real driver pins from real NavPro data? If not, A's snapshot endpoint is bluffing — fix now.
- **Anything you'd like to do differently in Phase 2?** Examples: change scoring weights, swap Mapbox for Google Maps, strip the DecisionLog tab. Now is the time.

Release: `Phase 2 release — proceed as written`.

---

### Phase 2 — Workflow 1 + 2 end-to-end (hours 6–12)

🎯 **Goal** — Minimum viable demo. Paste a broker email → AI parses it → ranked driver list renders with real math → click "dispatch" creates a real NavPro trip. Workflow 1 (morning triage) just works on page load. If everything collapses after this, we still have something to show.

🔑 **Keys** — GROQ, GEMINI confirmed working.

#### 👤 A's tasks
1. Add `POST /api/fleet/assignments`: accepts `{driverId, loadId}`, calls NavPro `/api/trip/create` with the right `stop_points` and `routing_profile_id` (pick the first profile from `getRoutingProfiles()`), logs to `LoadAssignment` table, returns `{tripId}`.
2. Extend `/api/fleet/snapshot` to mirror NavPro active trips into the local `ActiveTripMirror` table each call — B needs this for Phase 4 monitoring.
3. Seed a fresh load in the broker mock that matches the demo script: **Phoenix, AZ → San Francisco, CA, $3,200, pickup in 4 hours, 38,000 lbs dry van.** Hard-code its ID as `TL-DEMO-01` so C and B know exactly what to paste.
4. Add one seeded driver named **"Mike Chen"** at lat 33.4152, lng -111.8315 (Tempe, AZ), fresh HOS — this is the driver who will win Act 2's ranking. Add driver **"Jake Morrison"** in Flagstaff with only 4 hours HOS left — the "why not Jake" counter-example.

#### 👤 B's tasks
1. Implement the real `get_fleet_snapshot` tool: `fetch('/api/fleet/snapshot')`.
2. Implement the real `score_assignment` tool: parses the user's load, loops every driver, calls `scoreDriverForLoad`, returns sorted `DriverScore[]`. Exclude drivers where HOS fails — set `eliminated: true` with reason.
3. Add load parsing to the agent: when the user pastes a broker email, the first agent turn is a JSON-schema-constrained extract into the `Load` shape. Use Groq's structured-output mode or a simple prompt + JSON parse + zod validate.
4. Implement `POST /api/agent/score` as a non-streaming shortcut the UI can call directly for the ranking grid (streaming is for the chat pane; the grid wants one JSON response).
5. Tune the system prompt so it always ends its recommendation with "shall I dispatch {top driver}? I'm also pulling backhaul options" — this sets up Phase 3's moment.

#### 👤 C's tasks
1. Wire `LoadInbox` to `/api/agent`: paste → stream → on `final` event, `POST /api/agent/score` with the parsed load → render grid of `DriverRankCard` for every driver sorted by score.
2. Add a "Dispatch {driverName}" button on the top card — calls `POST /api/fleet/assignments`, shows a toast on success, then opens the `BackhaulModal` (with mocked data for now — Phase 3 replaces the data with real).
3. Implement the **morning brief** strip at the top of the LoadInbox panel: on mount, `GET /api/fleet/snapshot` and render `morningBrief.headline` verbatim. Add one small icon-per-flag row underneath.
4. Polish the `DriverRankCard` "why" section. The math display needs to look like:
   ```
   score = 100 − 0.3·deadhead(42) − hosPenalty(0) − ripple(5·1) = 82
   ```
   Use a mono font. Make it clickable — click deadhead → highlight the route on the map. This is the "shows the intelligence, not just the data" moment.

#### ✅ Acceptance tests
- [ ] Paste this email into the UI:
  ```
  Load offer: PHX to SFO, pickup tomorrow 9am, drop Saturday by 5pm,
  38,000 lbs dry van, rate $3,200 all in. Confirm?
  ```
  → within 5 seconds the driver grid renders with Mike Chen in position #1, Jake Morrison eliminated with reason "HOS: needs 11.5 hours, has 4 hours".
- [ ] Click "Dispatch Mike Chen" → toast confirms trip created → verify with `curl -H "Authorization: Bearer $NAVPRO_JWT" $NAVPRO_BASE_URL/api/trip/... ` that the NavPro trip exists.
- [ ] Morning brief on page load reads something like "14 drivers ready to run, 3 need rest within 2 hours, 2 have compliance flags."
- [ ] `/api/agent` streaming works end-to-end — chat pane shows tokens arriving.

#### 📝 Report update
Include a screen recording link (Loom, or just commit an `.mp4` to `/docs/`). This is the MVP — if Phase 3 or 4 breaks you want proof the core works.

#### 🚦 Human gate
- Run the Act 2 script end-to-end. Does Mike win? Does Jake get eliminated with the right reason? Does the dispatch button actually create a trip? If any of these is "sort of" — fix before Phase 3.
- **Anything you'd like to do differently for Workflow 3 (backhaul)?** Possible changes: different corridor, different rate comparison, skip the profit bar, etc.

Release: `Phase 3 release — proceed as written`.

---

### Phase 3 — Workflow 3 backhaul (hours 12–16)

🎯 **Goal** — The centerpiece. After the ranking shows and before Maria confirms dispatch, a modal slides in showing 3 backhaul options along the corridor, with round-trip profit replacing one-way profit. One click dispatches both legs through NavPro.

🔑 **Keys** — Same as Phase 2.

> **This is the single most important phase of the hackathon.** If this works, we win. If it's janky, we're top-5 but not top-1. Budget every extra polish hour here.

#### 👤 A's tasks
1. Extend `lib/loadBroker.ts` with `searchLoadsNearRoute(origin, destination, pickupWindow, opts?)`:
   - corridor = line from `origin` to `destination`, padded 50 mi
   - filter loads whose `origin` is within the padded corridor AND whose `destination` is within 100 mi of the original `origin` (so the driver actually gets home)
   - pickup window must be within 48h after the outbound drop
   - return at most 10 candidates sorted by proximity to corridor
2. Extend `POST /api/fleet/assignments` to optionally accept `returnLoadId` — if present, create a second NavPro trip for the return leg with the correct `scheduled_start_time` (right after outbound delivery).
3. Seed three loads **explicitly designed for the demo corridor**: SFO→Vegas ($1,800), SFO→LA→PHX ($2,400), SFO→Reno ($1,200). Hard-code IDs `TL-BH-01/02/03`.

#### 👤 B's tasks
1. Implement `lib/backhaul.ts`:
   ```ts
   export async function findBackhauls(
     outbound: Load,
     driverHomeBase: {lat:number,lng:number},
     returnWindowHours: number,
   ): Promise<BackhaulOption[]>
   ```
   - calls `loadBroker.searchLoadsNearRoute(outbound.destination, driverHomeBase, ...)`
   - for each candidate computes `totalDeadhead`, `totalRevenue`, `oneWayProfit` (outbound only, minus deadhead cost at $0.65/mi), `roundTripProfit`, and HOS feasibility for the combined legs
   - sorts by `roundTripProfit` desc, returns top 3
2. Implement the real `find_backhauls` tool → the agent now **always** calls it after `score_assignment` per the system prompt.
3. Implement `POST /api/agent/backhaul` — UI shortcut that takes `{outboundLoadId, driverId}` and returns `BackhaulOption[]`.
4. Update `rationale` generation so when backhaul options exist, the agent's final message explicitly says "round-trip profit jumps from $X to $Y" — that line has to appear in the chat pane, it's what the presenter will quote on stage.

#### 👤 C's tasks
1. This is the component that wins the hackathon — give it disproportionate polish time.
2. Wire `BackhaulModal` to real data:
   - after dispatch button click → `POST /api/agent/backhaul` → modal opens
   - outbound route on left map (origin to destination, solid line)
   - return route on right map (destination to home base, dashed line if no backhaul, solid green if filled)
   - profit comparison bar: full width. One-way in red/muted. Round-trip in green, animated-grow on mount. Delta shown in huge mono type.
   - List of 3 backhaul options underneath, clickable — selecting one updates the right map and the bar.
   - Primary CTA: "Dispatch full round trip" → `POST /api/fleet/assignments` with `returnLoadId` → success toast → modal closes → two trip pins appear on main map.
3. Add a subtle "Skip backhaul" secondary button (lighter/muted). In the demo Maria won't click it but judges need to see she *could*.

#### ✅ Acceptance tests
- [ ] Full Act 2 flow end-to-end: paste email → ranking → click dispatch Mike → modal slides in → SFO → Vegas → PHX option showing round-trip profit $4,800 vs $2,100 one-way → click "Dispatch full round trip" → two NavPro trips created → both show on map as connected polylines.
- [ ] Latency check: from click-dispatch to modal-visible ≤ 3 seconds on Vercel prod.
- [ ] Run the demo flow 5 times in a row with a fresh page load each time — must work 5/5. If it works 4/5, find the flake and fix it now.

#### 📝 Report update
Include a screen recording of the full Workflow 2 + 3 flow. This is the money shot. If the hackathon ended after this phase we'd still be competitive.

#### 🚦 Human gate
- Watch the recording. Does the round-trip profit moment land? If the bar animation is weak or the numbers are dull, fix now.
- **Anything you'd like to do differently before sleep?** Good time to tune seeded numbers — round-trip $4,800 sounds much better than $3,247.

Release: `Sleep release — all three take at least 4 hours`.

---

### Sleep (4–6 hours, non-negotiable)

A broken demo from tired presenters loses to a clean demo from rested ones. No code gets written. Set three alarms.

---

### Phase 4 — Workflow 4 voice + monitoring (Day 2 hours 0–6)

🎯 **Goal** — Maria's phone rings through the laptop speakers. Real ElevenLabs voice. She says "execute." Screen updates live. This is the emotional peak of the demo and the ElevenLabs side-track winner.

🔑 **Keys** — `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` must be populated.

#### 👤 A's tasks
1. Implement `POST /api/dev/simulate`: takes `{tripId, scenario}`, flips that trip's `ActiveTripMirror` state so the next monitor tick detects it. Scenarios: `"breakdown"` (long_idle outside any POI), `"route_deviation"` (GPS point 30 mi off planned route), `"eta_slip"` (predicted ETA +3 hours).
2. Seed one in-transit trip pre-pre-baked: driver "Sam Rodriguez" on truck 14, route LA→Phoenix, currently "stopped" near Barstow. This is the Act 3 demo trip. Hard-coded trip ID `TRIP-ACT3`.
3. Add a relay-driver candidate: "Kevin Walsh" near Victorville, 9 hours HOS left. Act 3 script calls him out by name.

#### 👤 B's tasks
1. Implement `lib/voice.ts`:
   - `speakAlert(text): Promise<ReadableStream>` → ElevenLabs TTS streaming endpoint, voice ID from env.
   - `listenForCommand(): Promise<{transcript, matchedCommand}>` → ElevenLabs Conversational Agent (or web Speech API fallback) listening for "execute" / "cancel" / "call kevin".
2. Implement `POST /api/voice/speak` — streams MP3 bytes back.
3. Implement `POST /api/voice/listen` — accepts audio blob, returns transcript + matched command.
4. Implement `lib/monitor.ts` and `POST /api/monitor/tick`:
   - fetch all active trips via NavPro dispatch endpoint
   - for each, check four conditions: route deviation > 5 mi, idle > 30 min outside POI, HOS remaining insufficient for remaining route, predicted ETA > scheduled + 60 min
   - on violation: call `draft_intervention` tool → saves to `InterventionDraft` table
5. Implement the real `draft_intervention` tool: for a given `tripId` and trigger, produces the full `InterventionDraft` with SMS copy, relay driver (use the scoring engine to pick nearest driver with enough HOS), reroute suggestion, and voice script.
6. **Pre-generate the Act 3 alert audio** at the start of this phase and commit the MP3 to `/public/act3-fallback.mp3`. If the live TTS call fails mid-demo the UI falls back to the cached file.

#### 👤 C's tasks
1. Build `components/VoiceAlert.tsx`:
   - fixed top-right popup, slides in from the edge with a "incoming call" animation
   - waveform visualization (use `wavesurfer.js` or a simple canvas animation keyed to the audio element's `timeupdate`)
   - large "Execute" button + smaller "Cancel" button
   - mic button to push-to-talk (Phase 4 optional — we can keep button-click as the primary)
2. Wire up the monitoring tick: client-side `setInterval(fetch('/api/monitor/tick'), 30000)` — when the response has new interventions, pop the `VoiceAlert`, play the audio, and on "Execute" click call `POST /api/fleet/assignments` for the relay and refresh the map.
3. Map updates: on intervention created, animate a red pulse on truck 14's pin. On execute, draw a connecting line from truck 14 to Kevin's pin, then replace truck 14's route with the reroute.
4. Record the fallback video in OBS during a working run — commit it to `/public/backup-demo.mp4`. If the live demo crashes we play the backup.

#### ✅ Acceptance tests
- [ ] Trigger: `curl -X POST http://localhost:3000/api/dev/simulate -d '{"tripId":"TRIP-ACT3","scenario":"breakdown"}'`
- [ ] Within 30s the UI pops the VoiceAlert, the audio plays, and the intervention matches the Act 3 narration word-for-word: "Maria, truck 14 has been stopped 47 minutes outside Barstow. Engine idle pattern suggests breakdown. I've drafted a customer SMS with a 3-hour delay, found relay driver Kevin 28 miles away with 9 HOS hours left, and prepped the swap plan. Say 'execute' to approve."
- [ ] Click "Execute" → two NavPro trips (reroute + relay) created, map updates, decision log gets a new entry.
- [ ] Kill internet mid-demo: the pre-cached MP3 still plays, button click still works.

#### 📝 Report update
Include the Act 3 recording. If it's rough, say so — Phase 5 is when you polish.

#### 🚦 Human gate
- Did the voice actually sound like a professional dispatcher? If robotic, try a different `ELEVENLABS_VOICE_ID` — voice choice matters for the emotional landing.
- **Anything you'd like to do differently for polish/rehearsal?**

Release: `Phase 5 release — proceed as written`.

---

### Phase 5 — Polish & rehearse (Day 2 hours 6–10)

🎯 **Goal** — All three stop writing features and switch to demo mode. The demo has been rehearsed ≥ 5 times with someone playing a hostile judge.

🔑 **Keys** — all stable, no new ones.

#### All three agents simultaneously
1. **Freeze feature work.** No new files. Only polish and bug fixes.
2. Walk through the full 3-act demo, end to end, five times. Write down every glitch. Fix the top-3 glitches. Accept the rest.
3. Tune seeded numbers so the on-screen figures look impressive — **$5,694 saved** sounds better than **$347**. **$4,800 round-trip profit vs $2,100 one-way** is emotionally bigger than 2.3x.
4. Build `components/DecisionLog.tsx` closer: timeline of every agent action this session, with month-to-date aggregates at the top ("2,847 deadhead miles eliminated, $5,694 recovered, 4.2 hours saved per day").
5. Write `DEMO_SCRIPT.md` — the presenter's word-for-word narration for each act. Print it. Tape it to the laptop.
6. Record a **backup video** in OBS with clean audio. Upload to YouTube unlisted. Keep the URL on stand-by — if the live demo crashes at any point, the fallback is one click away.

#### 👤 A's polish
- Freeze the NavPro driver list. No more invites. No more edits.
- Double-check the dev simulate endpoint is wired up and won't fire accidentally on stage.

#### 👤 B's polish
- Cache the pre-generated voice audio for Act 3. Verify the fallback MP3 plays on a fresh browser tab with DevTools → Network set to Offline.
- Confirm Groq → Gemini fallback triggers cleanly if Groq rate-limits. Rehearse with it forced.

#### 👤 C's polish
- Every hover state, every transition, every shadow gets one more review pass.
- Dark theme review — no light mode leaks.
- Backhaul modal animation — the bar grow from one-way to round-trip must land. Time it so the narration "round-trip profit jumps from $2,100 to $4,800" lands exactly as the bar finishes animating.

#### ✅ Acceptance tests
- [ ] Full demo, start to finish, with a stopwatch — total time under 3 minutes.
- [ ] Five clean run-throughs in a row. No refresh. No tab switch.
- [ ] One run-through with Wi-Fi turned off — the fallback MP3 still carries Act 3.
- [ ] One run-through where a teammate plays judge and tries to break it ("what about this edge case?"). The presenter has an answer.

#### 📝 Report update
Commit `DEMO_SCRIPT.md`. Link the backup video URL. Note any glitches accepted as "known, won't fix in time."

#### 🚦 Human gate
- **Can you run the demo flawlessly without looking at the script?** If no, rehearse twice more.
- **Anything you'd like to do differently for deck + submission?**

Release: `Phase 6 release — proceed as written`.

---

### Phase 6 — Deck, GTM & submit (Day 2 hours 10–12)

🎯 **Goal** — Submitted. URL in judges' hands. Shower. Eat.

🔑 **Keys** — just Vercel account.

#### Team split
- **A** — Vercel production deploy. Verify the deployed URL works with one fresh incognito window. Fix any env-var mismatches between local and prod.
- **B** — Write the GTM one-pager: target customers (owner-operators 5–50 trucks), pricing model (seat-based $99/truck/month or $0.05/mile enterprise), acquisition channels (Trucker Path cross-sell, DAT partnership, state trucking associations). One page, three sections. Commit as `/docs/GTM.md`.
- **C** — Build the 5-slide deck in Google Slides or Figma. Slide content in [Section 9 of this doc](#9-demo-script) is pre-written; C's job is to make it look like Vercel's marketing site, not a student project.

#### The 5 slides
1. **The Problem** — title: *"Two good halves, glued together with phone calls"* (their own quote). One image of Maria's messy desk.
2. **The Product** — title: *"Co-Dispatch — decisions, not dashboards"* (their phrase). One big screenshot of the three-panel UI with BackhaulModal open.
3. **Architecture** — clean left-to-right diagram (see Section 3). LLM box shows "Groq | Gemini | Local Gemma" — this is the slide that sells the enterprise GTM.
4. **Why we win** — 4 bullets:
   - Directly attacks cost/mile via backhaul
   - Novel: no team will do backhaul at dispatch moment
   - Upsells Trucker Path's own TruckLoads marketplace
   - LLM-agnostic, on-prem ready for enterprise
5. **The Ask / CTA** — live URL, one QR code, team names. One line: *"Try it now — demo login works for everyone in this room."*

#### Submission checklist
- [ ] Devpost project page with: live URL, GitHub repo, 3-min demo video, team names
- [ ] Backup demo video uploaded (YouTube unlisted)
- [ ] GTM one-pager linked
- [ ] Product deck linked
- [ ] **ElevenLabs side-track submission** at https://showcase.elevenlabs.io with the same demo video
- [ ] Screen-record the submit screen after clicking Submit — proof it went through
- [ ] Shower
- [ ] Eat
- [ ] Sleep if there's time

#### 📝 Final report update
Commit the final `PROGRESS_REPORT.md` with a "SHIPPED" section at the top showing the deployed URL, the Devpost link, and the ElevenLabs submission link.

---

## 8. Progress report template

Create `PROGRESS_REPORT.md` at repo root. Each agent appends to their own subsection after each phase.

```markdown
# Co-Dispatch — Progress Report

Deployed URL: <paste Vercel URL here after Phase 0>
Devpost URL: <paste after Phase 6>
ElevenLabs submission: <paste after Phase 6>

---

## Phase 0 — Setup & keys
### Agent A
- ✅ NavPro credentials obtained (yes/no + JWT expiry date)
- ✅ 15 seed drivers invited — list IDs: [...]
- ❗ Blockers: <none | describe>
- 📸 Evidence: <curl output, screenshot, commit SHA>

### Agent B
- ✅ Groq key tested — model: llama-3.3-70b-versatile
- ✅ Gemini key tested — model: gemini-2.0-flash
- ✅ ElevenLabs key claimed via Discord on <date>
- ❗ Blockers:
- 📸 Evidence:

### Agent C
- ✅ Next.js 14 scaffold, dark theme, shadcn installed
- ✅ Mapbox token verified
- ✅ Vercel auto-deploy confirmed: <URL>
- ❗ Blockers:
- 📸 Evidence:

### Human gate
- All keys in .env.local? <yes/no>
- Changes requested for Phase 1? <none | describe and update plan>
- Released Phase 1 at: <timestamp>

---

## Phase 1 — Foundation & contracts
### Agent A
...

### Agent B
...

### Agent C
...

### Human gate
...

---

## Phase 2 — Workflow 1 + 2 end-to-end
...

---

## Phase 3 — Workflow 3 backhaul
...

---

## Phase 4 — Workflow 4 voice + monitoring
...

---

## Phase 5 — Polish & rehearse
...

---

## Phase 6 — Deck, GTM & submit
...
```

---

## 9. Demo script

Total time ≤ 3 minutes. The presenter reads this word-for-word on stage. Rehearse it 5+ times.

### Act 1 — 7am triage (30 seconds)
> *Presenter opens the deployed URL. Morning brief already on screen from page-load call.*
>
> "This is Maria's 7am. Normally she's texting 20 drivers to figure out who can run today. Co-Dispatch did that in one API call. 14 drivers ready, 3 need rest, 2 compliance flags — Sara's on a fatigue pattern, I'll come back to that. This is Stop 1 of Maria's day, gone."

### Act 2 — 9am load + backhaul (90 seconds — centerpiece)
> *Presenter pastes the broker email into the LoadInbox.*
>
> "New load, Phoenix to San Francisco, $3,200. The AI parses it — 3 seconds — and ranks every available driver with full math on screen. Mike wins on deadhead because he's already in Tempe, HOS is clean, ripple impact minimal."
>
> *Click the score to expand the "why".*
>
> "Click the score — full math visible. Why not Jake? He's 4 HOS hours short of the required drive time. Alright, dispatching Mike —"
>
> *Click "Dispatch Mike Chen". BackhaulModal slides in.*
>
> "— wait. Before Maria confirms, our AI already pulled 3 backhaul options from TruckLoads along this corridor. Best pick — San Francisco to Vegas to Phoenix, $2,400, only 85 total deadhead miles. Round-trip profit jumps from $2,100 to $4,800."
>
> *Click "Dispatch full round trip".*
>
> "One click. Full circle dispatched through the NavPro trip API."

### Act 3 — 2pm intervention with voice (60 seconds — emotional peak)
> *Presenter clicks a subtle "demo: next scene" pill, OR the simulated breakdown fires on a timer.*
>
> *Laptop speakers ring. ElevenLabs voice plays:*
>
> "Maria, truck 14 has been stopped 47 minutes outside Barstow. Engine idle pattern suggests breakdown. I've drafted a customer SMS with a 3-hour delay, found relay driver Kevin 28 miles away with 9 HOS hours left, and prepped the swap plan. Say 'execute' to approve."
>
> *Presenter, into the laptop mic:*
>
> "Execute."
>
> *Screen updates live — SMS drafted, relay dispatched, reroute pushed.*

### Closer — 15 seconds
> *Presenter flips to the Decision Log tab.*
>
> "Every one of these decisions was logged with its full math. This month: 2,847 deadhead miles eliminated via backhaul pairing, $5,694 in revenue recovered, 4.2 hours saved for Maria every day. Notice we haven't built a Cost Intelligence feature — we didn't have to. It's what happens automatically when every decision is transparent."
>
> *(mic drop — implicitly claims 3 of 5 gaps while explicitly building 2, exactly what the brief asked for.)*

---

## 10. Risk register

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | NavPro credentials not granted in time | Medium | **Fatal** | Email integrations@ at hour 0. Backup plan: mock the NavPro layer in `lib/navpro.ts` with a `USE_NAVPRO_MOCK=true` flag — same types, seeded data. We lose demo credibility but not the demo. |
| 2 | Groq rate limits us mid-demo | Low | High | Gemini fallback in `lib/llm.ts` is automatic. Rehearse with Groq disabled once. |
| 3 | BackhaulModal looks cheap | Medium | **Very high** (this is the money shot) | Budget disproportionate polish hours in Phase 3. One teammate owns *only* this component for the last 2 hours of Phase 3. |
| 4 | ElevenLabs glitches on stage | Medium | Medium (we still win main track, lose side track) | Pre-generate Act 3 audio to `/public/act3-fallback.mp3`. UI falls back silently if live call fails. Also "execute" voice command falls back to a button click. |
| 5 | Demo anxiety / stumbling | High | Medium | 5 rehearsals minimum. Print the script. Whoever knows the UI best (person C) presents. |
| 6 | Agents overwrite each other's files | High | High | Strict lane discipline (Section 4). Each agent works on their own branch. Human merges. If an agent wants to cross lanes it stops and asks. |
| 7 | Judges ask "is the ranking AI or real math?" | 100% | Low | Answer: "real math, explainable by AI — scoring is pure `scoreDriverForLoad()`, the LLM only formats the rationale paragraph." Show the file on request. |
| 8 | Seeded numbers look unimpressive | Medium | High | Phase 5 explicitly tunes numbers — $5,694 saved not $347, $4,800 vs $2,100 not $2,280 vs $2,100. |

---

## 11. What we deliberately do NOT build

This list is almost as important as the build list. Scope creep is how hackathon teams die.

- ❌ No driver-side app (NavPro mobile exists)
- ❌ No generic chatbot (the agent refuses off-topic questions — failure mode is a chat that does everything badly)
- ❌ No auth, no settings, no user management, no light mode
- ❌ No invoicing, even though it's the fifth gap on Trucker Path's own slide — it would dilute the backhaul moment
- ❌ No mobile layout — demo is always on a laptop
- ❌ No real-time websockets — 30-second poll is enough, cheaper, more reliable
- ❌ No third-party analytics / error tracking — `console.log` is fine for 48 hours
- ❌ No end-to-end test framework — manual tests only, documented in acceptance sections above

If your agent suggests building any of the above, stop it immediately. Point it at this list.

---

## Appendix — Agent kickoff prompts

See the three separate files:
- `AGENT_A_KICKOFF.md` — paste into Agent A's terminal at Phase 0
- `AGENT_B_KICKOFF.md` — paste into Agent B's terminal at Phase 0
- `AGENT_C_KICKOFF.md` — paste into Agent C's terminal at Phase 0

Each kickoff prompt references this README and locks the agent into its lane before any code is written.

---

*End of master plan. Ship it.*
