# PRD: Map and Scenario Sync

**Priority:** P0
**Initiative:** [00-co-dispatch-working-demo-hardening.md](./00-co-dispatch-working-demo-hardening-overview.md)
**Date:** 2026-04-19
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_MAP_SCENARIO_SYNC`
**Revenue Impact:** CONVERT

---

## 1. Summary
The map is already real, but it must become narratively precise. This PRD makes the map, stage transitions, and scenario engine follow the dispatcher’s current context: triage fleet view, assignment lane, backhaul corridor, and intervention relay plan. It also defines operator-safe scenario controls for rehearsal without polluting the judge path.

## 2. Problem & Vision
**Problem:** The current map already renders routes and markers, but the synchronization contract between stage, selected evidence, scenario state, and map camera is still implicit inside `DispatchWorkstation`.
**Vision:** The map always answers the same question the current panel is answering. In triage, it shows fleet readiness. In assignment, it shows the winning lane and candidate driver. In backhaul, it shows the corridor and return leg. In monitoring, it shows the failing trip, relay driver, and intervention route.
**Why this priority:** The map is a primary proof surface for judges; it cannot feel decorative or arbitrary.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As a judge, I want the map to change when the workflow changes so that the app feels alive | **Given** I switch between triage, dispatch, backhaul, and monitoring **When** the stage changes **Then** viewport, routes, and emphasized markers change to match that stage |
| US-2 | As a dispatcher, I want selecting a driver or backhaul option to update the map so that I can verify the decision visually | **Given** I select a ranked driver or return load **When** the selection changes **Then** the map emphasizes the related route and markers |
| US-3 | As a presenter, I want reproducible scenario transitions so that every rehearsal tells the same story | **Given** I trigger or reset a demo scenario **When** it completes **Then** the workstation, active trips, and map all reflect the new scenario |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As an operator, I want hidden rehearsal controls for reset/freeze/stage-set so that I can recover quickly during practice | **Given** operator mode is active **When** I use a scenario control **Then** the resulting map state is deterministic |

### Out of Scope
- Public multi-user map sharing
- Real-time websocket subscriptions
- Driver mobile map updates

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Extract map state derivation from `DispatchWorkstation` into a dedicated view-model helper | **Given** `activeStage`, selected driver, parsed load, selected backhaul, active trip, and open draft **When** the helper runs **Then** it returns the exact viewport, routes, and markers for the map |
| FR-2 | Define stage-specific map modes | **Given** `morning_triage` **When** the map renders **Then** it emphasizes ready drivers and active trip coverage across the current fleet geography |
| FR-3 | Define assignment map behavior | **Given** `load_assignment` and a parsed load **When** the map renders **Then** it shows pickup, drop, and the selected driver’s current position with the outbound route emphasized |
| FR-4 | Define backhaul map behavior | **Given** `backhaul_review` and a selected return option **When** the map renders **Then** it shows outbound + return corridor with distinct colors and updated viewport |
| FR-5 | Define monitoring map behavior | **Given** `trip_monitoring` and an open draft **When** the map renders **Then** it emphasizes the affected trip, relay driver, and any reroute path |
| FR-6 | Connect scenario actions from [`src/app/api/dev/simulate/route.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/app/api/dev/simulate/route.ts) to visible workstation state reloads | **Given** a stage set, trigger, reset, or freeze action **When** it succeeds **Then** the workstation refetches snapshot and monitor feed and the map updates within the same interaction cycle |
| FR-7 | Keep operator scenario controls off the main judge-facing shell | **Given** judge mode is active **When** the workstation renders **Then** debug controls are hidden |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-8 | Add “focus on selection” behavior when a secondary ranked candidate is clicked | **Given** a non-top driver card is selected **When** the map updates **Then** that driver becomes emphasized and camera centers accordingly |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Latency | Camera and marker updates feel immediate after selection | < 150 ms local state update |
| NFR-2 | Predictability | Same scenario input yields same viewport and route emphasis | deterministic in local rehearsal |
| NFR-3 | Reliability | Map does not crash if Directions API fails | graceful fallback to straight-line points |

## 5. Design Direction

> **Design system: custom Tailwind workstation components + Mapbox GL**
> For detailed implementation: no separate design skill required.

### Page Structure
The map remains the center panel driven by `InteractiveDispatchMap`.

### Components
- **Primary:** `InteractiveDispatchMap`
- **Actions:** zoom buttons, reset-view button, stage tabs, selection cards
- **Forms:** none
- **Feedback:** inline map-mode label and operator-only scenario controls

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | map or routes still resolving | map remains mounted with prior state or skeleton overlay |
| Empty | no parsed load and no active trip focus | fleet coverage map |
| Populated | stage-specific map content present | map with markers + routes |
| Error | route lookup fails | fallback route lines + inline note |
| Gated | not used | none |

### Responsive
- **Mobile (< 768px):** map moves below the evidence panel and prioritizes current focus route
- **Desktop (> 1024px):** map remains center canvas with full marker density

### Key Interactions
1. Switch stage.
2. Workstation recomputes map model.
3. Map updates markers/routes/camera.
4. If operator triggers scenario change, data reloads and the map follows the new state.

## 6. Data Model

### Schema Changes
No required schema changes for map sync. Scenario actions continue using existing synthetic runtime control plus persisted trip mirrors.

### New Tables (if any)
None.

### Existing Table Modifications (if any)
None.

### Migration Notes
No migration required.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `buildMapPresentationModel` | `src/components/workstation/map-presentation.ts` | pure function | Centralize stage-to-map derivation |

### Modified Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `/api/dev/simulate` | existing route | existing signature | Ensure stage and reset actions trigger full workstation reloads |

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| scenario control actions | refetch `/api/fleet/snapshot` and `/api/monitor/feed` |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Directions lookup failure | Mapbox route request rejects | "Live route detail unavailable. Showing corridor path." | Render fallback polyline | `surface='map', action='directions_lookup', status='fallback'` |
| Scenario action failure | `/api/dev/simulate` rejects | "Scenario update failed." | Keep current map state | `surface='map', action='scenario_control', status='error'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | No selected driver in assignment stage | Default to top non-eliminated score | P0 |
| 2 | No backhaul options returned | Stay on outbound map only | P0 |
| 3 | Open draft references missing relay driver | Show failing trip only | P0 |
| 4 | Directions API unavailable | Render fallback point-to-point geometry | P0 |

## 10. Dev Mode
- **Data:** synthetic NavPro, seeded loads, persisted trips/drafts
- **Auth:** none
- **External services:** Mapbox token optional but preferred; fallback geometry remains functional without Directions success

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Context-aware map | Full | Full |
| Rehearsal/operator scenario tooling | Internal only | Internal only |

**Upgrade trigger:** in production this becomes part of the premium dispatch workspace, but demo build is fully enabled.

## 12. AI Path
- **V1 (no AI):** deterministic map view follows structured workflow state
- **Future (AI):** agent can command focus changes or compare alternative corridors conversationally

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Extract map view model and stage-specific behaviors | Manual stage-switch audit passes | `ENABLE_MAP_SCENARIO_SYNC=true` |
| 2 | Operator scenario controls and selection focus | Rehearsal loop becomes deterministic | `ENABLE_MAP_SCENARIO_SYNC=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| Map logic remains embedded in `DispatchWorkstation` | Risk | Medium | Extract pure helpers for testability |
| Synthetic scenario and DB state drift | Risk | High | Always reload snapshot/feed after scenario mutations |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Stage-map mismatch incidents | Subjective, non-zero | 0 in rehearsal | manual walkthrough |
| Map update latency after selection | unknown | < 150 ms local | browser profiling |
| Successful scenario resets | manual guesswork | deterministic | operator rehearsal log |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | Mapbox remains the chosen map layer | Already integrated in `InteractiveDispatchMap` | Larger implementation change |
| A2 | Operator controls can remain hidden from judges | User wants polished demo, not debug UI | Separate presentation mode work required |

## 17. Implementation Notes
- **Key files to modify:** [`src/components/workstation/dispatch-workstation.tsx`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/components/workstation/dispatch-workstation.tsx), [`src/components/workstation/interactive-dispatch-map.tsx`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/components/workstation/interactive-dispatch-map.tsx), [`src/app/api/dev/simulate/route.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/app/api/dev/simulate/route.ts), [`src/server/integrations/navpro-synthetic.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/server/integrations/navpro-synthetic.ts)
- **Patterns to follow:** keep route geometry fallback in the map component; keep scenario state changes on the server side
- **Testing:** add view-model unit tests for each stage, keep `npm run typecheck` and `npm test`
- **Design enrichment:** not required
