# PRD: Monitoring and Voice Intervention

**Priority:** P2
**Initiative:** [00-co-dispatch-overview.md](./00-co-dispatch-overview.md)
**Date:** 2026-04-18
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_MONITORING_VOICE`
**Revenue Impact:** EXPAND

---

## 1. Summary
Implement Act 3: periodic trip monitoring, intervention drafting, voice playback, voice/listen actions, and execution handling for a relay response. This PRD covers `/api/monitor/tick`, `/api/voice/speak`, `/api/voice/listen`, the intervention draft model, the VoiceAlert UI, and the demo-critical fallback MP3 behavior.

## 2. Problem & Vision
**Problem:** Loads go dark in transit and the dispatcher learns about issues too late. The product promise is not just to alert, but to draft the fix and present it in a memorable way.
**Vision:** Every 30 seconds the app checks active trips, detects route deviation, long idle, HOS risk, or ETA slip, drafts an intervention, plays a professional voice alert, and lets Maria approve with one action.
**Why this priority:** This feature is the emotional peak of the demo and the explicit ElevenLabs side-track hook.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As Maria, I want the app to detect in-transit problems without manual polling so I learn before the customer calls | **Given** active trips exist **When** `/api/monitor/tick` runs **Then** it creates interventions for qualifying trips |
| US-2 | As Maria, I want the system to draft the response, not just alert me, so I can act quickly | **Given** a monitoring trigger **When** an intervention is created **Then** it includes customer SMS, relay driver, reroute flag, and voice script |
| US-3 | As Maria, I want the alert read aloud so I can approve without staring at the screen | **Given** a new intervention **When** the VoiceAlert opens **Then** audio plays from ElevenLabs or the cached fallback MP3 |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As Maria, I want to say or click execute so I can approve the intervention quickly | **Given** an open VoiceAlert **When** the user says or clicks execute **Then** the UI triggers the intervention execution flow |

### Out of Scope
- Autonomous action without user approval
- Weather integrations beyond the documented four triggers

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Implement `POST /api/monitor/tick` as a thin route calling a monitoring use-case | **Given** the route is called **When** it completes **Then** it returns `{interventionsCreated: number}` |
| FR-2 | Evaluate the four monitoring conditions from README | **Given** an active trip **When** monitoring runs **Then** triggers are created for route deviation `> 5 mi`, idle `> 30 min` outside POI, insufficient HOS for remaining route, or ETA slip `> 60 min` |
| FR-3 | Implement `draftIntervention` using the shared `InterventionDraft` shape | **Given** a triggered trip **When** drafting runs **Then** it returns customer SMS, relay suggestion, reroute flag, and a voice script |
| FR-4 | Implement `POST /api/voice/speak` to stream MP3 bytes or fallback audio | **Given** `{text, voiceId?}` **When** live ElevenLabs succeeds **Then** the route streams live audio; **When** it fails **Then** it serves `/public/act3-fallback.mp3` |
| FR-5 | Implement `POST /api/voice/listen` to resolve transcript and matched command | **Given** `{audioBase64}` **When** voice recognition succeeds **Then** it returns `{transcript, matchedCommand}` where `matchedCommand` is `execute`, `cancel`, `call kevin`, or `null` |
| FR-6 | Seed Act 3 data: `TRIP-ACT3`, Sam Rodriguez, and Kevin Walsh | **Given** demo mode **When** simulate or monitor runs **Then** the Act 3 narration can be produced deterministically |
| FR-7 | Implement `POST /api/dev/simulate` to flip `ActiveTripMirror` into a chosen demo condition | **Given** `{tripId, scenario}` **When** the request succeeds **Then** the next monitor tick detects it |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-8 | Pre-generate and store `/public/act3-fallback.mp3` before final rehearsal | **Given** the repo **When** assets are checked **Then** the fallback MP3 exists and can be played offline |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Reliability | Monitoring can run every 30 seconds without duplicate spam | no duplicate draft for same trip+trigger within 5 minutes |
| NFR-2 | Latency | Voice alert opens quickly after intervention creation | within one poll interval + 2 seconds |
| NFR-3 | Resilience | Offline fallback must still support the demo | cached MP3 and click-to-execute path work with network disabled |

## 5. Design Direction

> **Design system: shadcn/ui + Tailwind CSS**
> For detailed implementation: invoke `/interface-design` with this section.

### Page Structure
- Voice alert appears as a fixed top-right overlay on top of the dashboard
- Alert includes message summary, waveform/visual activity, and action buttons

### Components
- **Primary:** `Card`, `Button`, `Badge`, `Alert`
- **Actions:** `Execute`, `Cancel`, optional mic/push-to-talk
- **Forms:** none beyond optional voice capture control
- **Feedback:** pulse indicator, waveform, fallback badge if cached audio used

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | intervention detected, audio still preparing | compact overlay skeleton |
| Empty | no active intervention | nothing shown |
| Populated | alert open with audio and actions | overlay card |
| Error | voice or execution failed | destructive `Alert` within overlay |
| Gated | None | None |

### Responsive
- **Mobile (< 768px):** unsupported-screen message inherited from dashboard shell
- **Desktop (> 1024px):** fixed top-right overlay with enough width for the full voice script summary

### Key Interactions
1. Poll `/api/monitor/tick` every 30 seconds.
2. Open alert when `interventionsCreated > 0`.
3. Play live or fallback audio.
4. User clicks or says execute.
5. UI updates the map and decision log.

## 6. Data Model

### Schema Changes
Use `InterventionDraft` and `ActiveTripMirror` from foundation, with fields required for dedupe and execution tracking.

### New Tables (if any)
None.

### Existing Table Modifications (if any)
- `InterventionDraft`
  - add `status`: string default `drafted`
  - add `matchedCommand`: string nullable
  - add `audioSource`: string nullable (`live`, `fallback`)
- `ActiveTripMirror`
  - add `overrideReason`: string nullable

### Migration Notes
Default `status='drafted'` for existing rows if the table was already created.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `runMonitoringTick` | `src/features/monitoring/server/run-monitoring-tick.ts` | `() => Promise<{ interventionsCreated: number }>` | Evaluate active trips and create drafts |
| `draftIntervention` | `src/features/monitoring/server/draft-intervention.ts` | `(input: { tripId: string; trigger: InterventionDraft['trigger'] }) => Promise<InterventionDraft>` | Build intervention payload |
| `speakAlert` | `src/features/voice/server/speak-alert.ts` | `(input: { text: string; voiceId?: string }) => Promise<ReadableStream | { fallbackPath: string }>` | Voice playback |
| `listenForCommand` | `src/features/voice/server/listen-for-command.ts` | `(input: { audioBase64: string }) => Promise<{ transcript: string; matchedCommand: string | null }>` | Voice command recognition |

### Modified Actions
| Action | Location | Change |
|--------|----------|--------|
| `createAssignment` | `src/features/dispatch/server/create-assignment.ts` | Support intervention execution path when relay or reroute assignment is approved |

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| Intervention creation | `fleet-snapshot`, `decision-log` |
| Intervention execution | `fleet-snapshot`, `decision-log` |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Monitor tick failed | upstream or repository failure | "Trip monitoring delayed. Retrying on next cycle." | Do nothing immediately; next poll retries | `area='monitoring', action='tick', status='error'` |
| Voice playback failed | ElevenLabs request failed | "Live voice unavailable. Playing backup audio." | Automatically play fallback MP3 | `area='voice', action='speak', status='fallback'` |
| Execute failed | relay/reroute assignment fails | "Intervention approval failed. Review trip status and retry." | Keep overlay visible and do not mark draft executed | `area='monitoring', action='execute', status='error'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | Same trip triggers repeatedly | Create at most one open draft per trip+trigger inside 5 minutes | P0 |
| 2 | No relay driver available | Draft still created with `relayDriverId=null` and explicit script language | P0 |
| 3 | Voice command ambiguous | `matchedCommand=null`, keep buttons visible | P0 |
| 4 | Internet disabled mid-demo | fallback MP3 plays and click execute remains functional | P0 |

## 10. Dev Mode
- **Data:** use seeded `TRIP-ACT3` and relay fixtures from `data/demo/scenarios.ts`
- **Auth:** none
- **External services:** if ElevenLabs is unavailable or disabled, always use fallback MP3 and deterministic transcript fixtures

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Monitoring and voice intervention | Full access | Full access |

**Upgrade trigger:** None in current scope.

## 12. AI Path
- **V1 (no AI):** rule-driven detection and deterministic intervention drafts in demo mode
- **Future (AI):** smarter intervention narratives and more nuanced reroute/relay strategy selection

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Simulated trigger + fallback audio | Act 3 demo works offline with button execute | `ENABLE_MONITORING_VOICE=true`, fixture mode |
| 2 | Live monitor + live voice | monitor tick and live ElevenLabs playback verified | `ENABLE_MONITORING_VOICE=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| ElevenLabs keys and quota | Blocker | High | Fallback MP3 and click execution path |
| Active trip mirror freshness | Risk | Medium | Mirror on every snapshot and on assignment actions |
| False-positive alerts | Risk | Medium | Deduping window and seeded deterministic scenario path |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Act 3 trigger success | 0% | 100% on `TRIP-ACT3` simulate flow | smoke test |
| Offline fallback success | 0% | 100% | manual network-off scenario |
| Duplicate-alert suppression | 0 | no duplicates within dedupe window | integration test |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | Polling every 30 seconds is sufficient | README explicitly rejects websockets | Faster real-time needs would require transport changes |
| A2 | Execute can fall back to button click | README and PDF both allow this as demo safeguard | If voice-only becomes required, error rates become riskier |
| A3 | Long idle outside POI can be inferred from mirrored trip data plus POI lookup | README names this rule | Additional geospatial logic may be needed if POI lookup is weak |

## 17. Implementation Notes
- **Key files to modify:** `src/app/api/monitor/tick/route.ts`, `src/app/api/voice/speak/route.ts`, `src/app/api/voice/listen/route.ts`, `src/app/api/dev/simulate/route.ts`, `src/features/monitoring/**`, `src/features/voice/**`, `public/act3-fallback.mp3`
- **Patterns to follow:** trigger definitions and Act 3 script from README Phase 4 and Demo Script sections
- **Testing:** unit tests for trigger evaluation; integration test for intervention draft shape; manual smoke for offline fallback
- **Design enrichment:** invoke `/interface-design` with Section 5
