# PRD: Monitoring and Voice Closure

**Priority:** P1
**Initiative:** [00-co-dispatch-working-demo-hardening.md](./00-co-dispatch-working-demo-hardening-overview.md)
**Date:** 2026-04-19
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_MONITORING_VOICE_CLOSURE`
**Revenue Impact:** EXPAND

---

## 1. Summary
The monitoring flow already detects risks, drafts interventions, and plays audio. This PRD finishes the last mile so the intervention loop feels complete under scrutiny: the draft appears from persisted state, voice playback records provenance, execution changes the trip evidence and decision log, and the workstation visibly closes the loop.

## 2. Problem & Vision
**Problem:** Today the monitoring path is promising but still partial. Voice parsing is intentionally simple, execution logs do not yet update trip-level evidence, and the operator can approve an intervention without seeing the downstream state change clearly.
**Vision:** A breakdown or ETA-slip event creates an intervention package, voice playback references that exact package, approval updates persisted state, and the feed clearly shows the intervention moved from drafted to executed with measurable operational impact.
**Why this priority:** The voice moment is the emotional peak of the demo and the ElevenLabs-track differentiator.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As a judge, I want a visible link between the alert, the voice script, and the execution record so that I trust the system is acting on one coherent object | **Given** an intervention draft exists **When** I play voice or execute it **Then** the same draft ID, trip ID, and recommendation remain consistent across the UI and repositories |
| US-2 | As a dispatcher, I want approval to change system state so that the action feels real | **Given** I execute an intervention **When** the request succeeds **Then** the draft becomes executed, the decision log records it, and the related trip evidence updates |
| US-3 | As a presenter, I want a graceful fallback if live voice is unavailable so that the demo still lands | **Given** ElevenLabs is unavailable **When** I play the alert **Then** fallback audio still plays and the draft records `audioSource='fallback'` |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As a user, I want basic spoken command parsing for “execute” and “cancel” so that approval feels hands-free | **Given** an audio transcript contains `execute` or `cancel` **When** it is processed **Then** the matched command is returned and stored |

### Out of Scope
- Full speech-to-text integration
- Real customer SMS delivery
- Real relay driver dispatch to external systems

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Keep `runMonitoringTick()` deduped by `tripId + trigger` against open drafts | **Given** the same risk is evaluated twice **When** the second tick runs **Then** no duplicate open draft is created |
| FR-2 | Persist audio provenance when voice playback is requested | **Given** `handlePlayVoice()` plays live or fallback audio **When** the request completes **Then** the corresponding draft stores `audioSource='live'` or `audioSource='fallback'` |
| FR-3 | Update intervention execution to change downstream trip evidence | **Given** a draft is executed **When** execution completes **Then** the related `ActiveTripMirror` row updates status or override reason to reflect the mitigation outcome |
| FR-4 | Record execution summary and metrics in `DecisionLog` | **Given** an intervention is executed **When** the decision log row is written **Then** it includes a human summary, relay detail if applicable, and any time/revenue impact available |
| FR-5 | Keep the workstation feed split between open drafts and recent decisions | **Given** a draft is executed **When** the feed reloads **Then** the open draft list excludes it and the decision log includes it |
| FR-6 | Preserve fallback speech parsing through `listen-for-command.ts` | **Given** base64 text audio includes `execute`, `cancel`, or `kevin` **When** it is parsed **Then** the matched command is returned exactly as today unless deliberately extended |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7 | Add a visible “executed” receipt in the workstation | **Given** an intervention succeeds **When** the UI updates **Then** a receipt shows `Executed`, time, and command used |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Reliability | Voice fallback always returns playable bytes | 100% local demo path |
| NFR-2 | Integrity | Draft/play/execute all reference one persisted draft record | 0 orphan playback/execution actions |
| NFR-3 | Accessibility | Manual execute remains available even without voice | always available |

## 5. Design Direction

> **Design system: custom Tailwind workstation components**
> For detailed implementation: no separate design skill required.

### Page Structure
Monitoring remains in the `trip_monitoring` workstation stage with the live intervention card, proposed action plan, and decision log below it.

### Components
- **Primary:** live intervention card, drafted SMS card, relay plan card, voice CTA, decision log list
- **Actions:** `Run live check`, `Play voice alert`, `Execute`
- **Forms:** none
- **Feedback:** audio status message, execution receipt, monitor error banner

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | monitor feed or voice request pending | button loading states |
| Empty | no open intervention drafts | neutral “no active intervention” card |
| Populated | draft exists | full intervention package |
| Error | monitor or voice request fails | inline error banner |
| Gated | not used | none |

### Responsive
- **Mobile (< 768px):** stack action plan cards below the live intervention card
- **Desktop (> 1024px):** keep intervention and action plan visible in one vertical flow beside the map

### Key Interactions
1. Monitoring tick creates draft.
2. User plays voice alert.
3. User executes manually or via command.
4. Feed reloads and shows executed evidence in decision history.

## 6. Data Model

### Schema Changes
- `InterventionDraft`
  - Ensure `audioSource`, `matchedCommand`, `executedAt`, and optional `executionSummary` support the full loop.
- `ActiveTripMirror`
  - No new column required if `scenarioOverride` and `overrideReason` can represent post-mitigation state; otherwise add `mitigationStatus TEXT NULL`.

### New Tables (if any)
None.

### Existing Table Modifications (if any)
- Optional `ActiveTripMirror.mitigationStatus TEXT NULL`
- Optional `InterventionDraft.executionSummary TEXT NULL` if not added in the persistence PRD

### Migration Notes
- Backfill new optional columns as `NULL`.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `recordDraftAudioSource` | `src/server/repositories/intervention-drafts.ts` | `(id: string, audioSource: "live" | "fallback") => Promise<void>` | Persist playback provenance |

### Modified Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `speakAlert` | [`src/features/voice/server/speak-alert.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/voice/server/speak-alert.ts) | existing signature | Return source and enable repository update |
| `executeIntervention` | existing file | existing signature | update trip evidence and richer log metrics |
| `getMonitorFeed` | existing file | existing signature | surface executed receipt fields if needed |

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| voice playback provenance write | refetch `/api/monitor/feed` only if the UI shows source |
| intervention execute | refetch `/api/monitor/feed` and `/api/fleet/snapshot` |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Voice playback failure | both live and fallback audio fail | "Voice playback failed." | keep manual execute available | `surface='monitor', action='voice_playback', status='error'` |
| Execute failure | execute route rejects | "Execution failed." | draft remains open | `surface='monitor', action='execute_intervention', status='error'` |
| Feed load failure | monitor feed rejects | "Unable to load monitoring feed." | retry on poll/refresh | `surface='monitor', action='feed_load', status='error'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | Voice playback succeeds but DB update fails | play audio, show warning, retry provenance write silently | P0 |
| 2 | Draft already executed in another action cycle | execute route returns safe conflict or no-op | P0 |
| 3 | No relay driver found | draft still renders without relay card | P0 |
| 4 | Command transcript says `cancel` | no execution occurs, matched command stored if applicable | P1 |

## 10. Dev Mode
- **Data:** synthetic trip breakdowns and persisted intervention drafts
- **Auth:** none
- **External services:** ElevenLabs optional; fallback MP3 and text transcript path remain first-class

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| UI alert only | Full | Full |
| Voice escalation | Preview | Full |
| Execute-from-alert workflow | Limited | Full |

**Upgrade trigger:** voice-driven intervention and execute approval are premium automation behaviors.

## 12. AI Path
- **V1 (no AI):** deterministic draft generation and manual execution
- **Future (AI):** richer remediation packages and customer-message variants based on trip context

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Persist audio provenance and execution closure | rehearsal loop passes | `ENABLE_MONITORING_VOICE_CLOSURE=true` |
| 2 | Executed receipt polish and transcript handling | voice flow feels complete | `ENABLE_MONITORING_VOICE_CLOSURE=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| ElevenLabs instability | Risk | Medium | Keep fallback audio and manual execute path |
| Trip state not visibly changing after execution | Risk | High | Update mirror state and reload snapshot |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Open draft remains after execution | possible | 0 | monitor feed inspection |
| Voice playback source recorded | partial | 100% | DB inspection |
| Manual recovery path when voice fails | subjective | always available | rehearsal checklist |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | Basic transcript parsing is sufficient for the hackathon demo | User needs working flow, not full voice AI | STT integration work increases |
| A2 | Updating mirrored trip evidence after execution is enough to make the action feel real | The app does not need full TMS downstream automation | More system coupling required |

## 17. Implementation Notes
- **Key files to modify:** [`src/features/monitoring/server/run-monitoring-tick.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/monitoring/server/run-monitoring-tick.ts), [`src/features/monitoring/server/execute-intervention.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/monitoring/server/execute-intervention.ts), [`src/features/voice/server/speak-alert.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/voice/server/speak-alert.ts), [`src/features/voice/server/listen-for-command.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/voice/server/listen-for-command.ts), [`src/server/repositories/intervention-drafts.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/server/repositories/intervention-drafts.ts), [`src/components/workstation/dispatch-workstation.tsx`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/components/workstation/dispatch-workstation.tsx)
- **Patterns to follow:** keep execution state in repositories; keep the voice route thin and resilient
- **Testing:** unit tests for dedupe and execution, fallback audio test, manual monitor flow rehearsal
- **Design enrichment:** not required
