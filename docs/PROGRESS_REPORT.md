# Co-Dispatch — Progress Report

> All three agents (A/B/C) append their own subsection after every phase.
> The human orchestrator reviews this at every phase gate before releasing the next phase.

---

## Shipped URLs

- **Deployed (Vercel):** _pending_
- **GitHub repo:** _pending_
- **Devpost submission:** _pending_
- **ElevenLabs showcase:** _pending_
- **Backup demo video (YouTube unlisted):** _pending_

---

## Phase 0 — Setup & keys

### Agent A — The Data Spine

- [ ] NavPro credentials obtained — JWT expiry: _pending_
- [ ] 15 seed drivers invited across AZ / CA / NV — IDs: _pending_
- [ ] `curl` to `/api/driver/query` returned non-empty list — evidence: _pending_
- **Blockers:** _none_
- **Evidence / commit SHA:** _pending_

### Agent B — The Brain

- [ ] Groq key tested — model `llama-3.3-70b-versatile` returns completion
- [ ] Gemini key tested — model `gemini-2.0-flash` returns completion
- [ ] ElevenLabs key claimed via Discord
- [ ] ElevenLabs TTS smoke-tested (GET a voice, POST a short sample)
- **Blockers:** _none_
- **Evidence / commit SHA:** _pending_

### Agent C — The Face

- [ ] Next.js 14 scaffolded with Tailwind + shadcn (dark theme)
- [ ] Mapbox token verified by rendering a blank map centered on Phoenix
- [ ] Vercel auto-deploy from `main` confirmed — URL: _pending_
- **Blockers:** _none_
- **Evidence / commit SHA:** _pending_

### Human gate
- All 6 key groups populated in `.env.local`? **[ ]**
- NavPro confirmed live with real data? **[ ]**
- Changes requested for Phase 1? _none | describe and update plan before release_
- **Phase 1 released at:** _timestamp_

---

## Phase 1 — Foundation & contracts

### Agent A

- [ ] `shared/contracts.ts` committed and frozen
- [ ] `lib/navpro.ts` wraps: queryDrivers, queryDriverPerformance, getDriverDispatch, createTrip, queryTrips, queryPOI, getRoutingProfiles
- [ ] `data/loads.seed.json` with 500 loads, 60% on PHX/LA/SFO/Vegas corridor
- [ ] `lib/loadBroker.ts` with `listLoads` and `searchLoadsNearRoute`
- [ ] `prisma/schema.prisma` models: DecisionLog, LoadAssignment, ActiveTripMirror, InterventionDraft
- [ ] `GET /api/fleet/snapshot` returns valid `FleetSnapshot` with ≥ 15 real drivers
- **Blockers:**
- **Evidence:**

### Agent B

- [ ] `lib/llm.ts` with Groq primary + Gemini fallback, OpenAI-style tool schemas
- [ ] `lib/scoring.ts` — pure `scoreDriverForLoad` passes unit sanity checks
- [ ] `lib/agent.ts` — 5-tool loop with locked system prompt
- [ ] `POST /api/agent` streams at least one `token` event on simple input
- [ ] Tool stubs return hardcoded-but-typed mocks for `find_backhauls`, `monitor_trips`, `draft_intervention`
- **Blockers:**
- **Evidence:**

### Agent C

- [ ] Dark theme tokens locked in `globals.css`
- [ ] Three-panel layout in `app/page.tsx`
- [ ] `LoadInbox`, `FleetMap`, `DriverRankCard`, `BackhaulModal` (placeholder data), `AICopilot`, `DecisionLog` all present
- [ ] Mapbox renders 15 pins from live `/api/fleet/snapshot`
- **Blockers:**
- **Evidence (Vercel URL + screenshot):**

### Human gate
- `tsc --noEmit` clean across the repo? **[ ]**
- `shared/contracts.ts` confirmed frozen? **[ ]**
- Map showing real driver pins? **[ ]**
- Changes for Phase 2? _none | describe_
- **Phase 2 released at:**

---

## Phase 2 — Workflow 1 + 2 end-to-end

### Agent A

- [ ] `POST /api/fleet/assignments` creates real NavPro trip via `/api/trip/create`
- [ ] Seeded load `TL-DEMO-01` — PHX→SFO, $3,200, 38k lbs, pickup +4h
- [ ] Seeded driver "Mike Chen" (Tempe, fresh HOS) and "Jake Morrison" (Flagstaff, 4h HOS)
- [ ] Active trips mirrored into local DB on every snapshot
- **Blockers:**
- **Evidence:**

### Agent B

- [ ] Real `get_fleet_snapshot` + `score_assignment` tools
- [ ] Broker-email parsing via JSON-schema structured output
- [ ] `POST /api/agent/score` returns sorted `DriverScore[]`
- [ ] Agent's system prompt tuned to always mention backhaul setup
- **Blockers:**
- **Evidence:**

### Agent C

- [ ] Paste email → agent streams parse → ranking grid renders
- [ ] "Dispatch {driver}" button wired to `/api/fleet/assignments`
- [ ] Morning brief strip at top of LoadInbox
- [ ] Expanded "why" on DriverRankCard shows clickable math
- **Blockers:**
- **Evidence (screen recording link):**

### Human gate
- Act 2 end-to-end works? Mike wins, Jake eliminated with reason? **[ ]**
- NavPro trip actually created? Confirmed via curl? **[ ]**
- Morning brief reads correctly on page load? **[ ]**
- Changes for Phase 3? _none | describe_
- **Phase 3 released at:**

---

## Phase 3 — Workflow 3 backhaul (the money shot)

### Agent A

- [ ] Corridor search (50-mi pad) with return-to-home filter
- [ ] Seeded backhaul loads `TL-BH-01/02/03` for the demo
- [ ] Assignments endpoint accepts optional `returnLoadId` → creates second trip
- **Blockers:**
- **Evidence:**

### Agent B

- [ ] `lib/backhaul.ts::findBackhauls` — top 3 sorted by round-trip profit
- [ ] Real `find_backhauls` tool
- [ ] `POST /api/agent/backhaul` direct endpoint for UI
- [ ] Agent final message explicitly includes "round-trip profit jumps from $X to $Y"
- **Blockers:**
- **Evidence:**

### Agent C

- [ ] BackhaulModal fully wired to real data
- [ ] Two-map split + animated profit comparison bar
- [ ] "Dispatch full round trip" creates both NavPro trips and closes modal
- [ ] Both trips appear as connected polylines on the main map
- **Blockers:**
- **Evidence (screen recording of full Workflow 2 + 3 flow):**

### Human gate
- Does the profit bar animation land emotionally? **[ ]**
- 5/5 successful end-to-end runs from fresh page load? **[ ]**
- Seeded numbers impressive ($4,800 vs $2,100)? **[ ]**
- Changes before sleep? _none | describe_
- **Sleep released at:**

---

## Sleep
- [ ] All three agents got ≥ 4 hours
- [ ] Alarms set

---

## Phase 4 — Workflow 4 voice + monitoring

### Agent A

- [ ] `POST /api/dev/simulate` triggers chosen scenario
- [ ] In-transit demo trip `TRIP-ACT3` with Sam Rodriguez seeded
- [ ] Relay candidate Kevin Walsh seeded near Victorville
- **Blockers:**
- **Evidence:**

### Agent B

- [ ] `lib/voice.ts` — `speakAlert` streaming, `listenForCommand` for voice commands
- [ ] `POST /api/voice/speak` streams MP3
- [ ] `POST /api/voice/listen` returns matched command
- [ ] `lib/monitor.ts` + `POST /api/monitor/tick` detect all 4 violation types
- [ ] Real `draft_intervention` tool with SMS, relay, reroute, voice script
- [ ] `public/act3-fallback.mp3` pre-generated and committed
- **Blockers:**
- **Evidence:**

### Agent C

- [ ] `VoiceAlert.tsx` with slide-in + waveform + Execute/Cancel
- [ ] Client-side 30s polling of `/api/monitor/tick`
- [ ] Map animates red pulse + reroute line on intervention
- [ ] OBS backup demo video recorded during a clean run
- **Blockers:**
- **Evidence (Act 3 recording):**

### Human gate
- Voice sounds professional (not robotic)? **[ ]**
- Words match Act 3 script exactly? **[ ]**
- Offline fallback MP3 plays correctly? **[ ]**
- Changes for Phase 5? _none | describe_
- **Phase 5 released at:**

---

## Phase 5 — Polish & rehearse

### All three agents
- [ ] Feature freeze
- [ ] 5 clean end-to-end rehearsals
- [ ] Top-3 glitches fixed, rest accepted as known
- [ ] Seeded numbers tuned for impact
- [ ] `DEMO_SCRIPT.md` written word-for-word
- [ ] OBS backup video uploaded (YouTube unlisted)
- [ ] One rehearsal with Wi-Fi off — fallback works
- [ ] One rehearsal with hostile-judge teammate

### Human gate
- Can C present flawlessly without looking at the script? **[ ]**
- Backup video ready on standby tab? **[ ]**
- Changes for submission phase? _none | describe_
- **Phase 6 released at:**

---

## Phase 6 — Deck, GTM & submit

### Agent A
- [ ] Vercel production deploy live at public URL
- [ ] Incognito-window smoke test passes
- **Evidence (public URL):**

### Agent B
- [ ] `/docs/GTM.md` — target customers, pricing, acquisition channels
- **Evidence:**

### Agent C
- [ ] 5-slide deck built and shared
- **Evidence (deck link):**

### Submission checklist
- [ ] Devpost project submitted with live URL, GitHub, 3-min demo, team names
- [ ] Backup video uploaded + linked on Devpost
- [ ] GTM + deck linked on Devpost
- [ ] **ElevenLabs showcase submission** at https://showcase.elevenlabs.io
- [ ] Screen-recording proof of submit click

---

## SHIPPED ✅

- **Deployed:**
- **Devpost:**
- **ElevenLabs:**
- **Shower:** [ ]
- **Food:** [ ]
- **Sleep:** [ ]
