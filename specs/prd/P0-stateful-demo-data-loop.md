# PRD: Stateful Demo Data Loop

**Priority:** P0
**Initiative:** [00-co-dispatch-working-demo-hardening.md](./00-co-dispatch-working-demo-hardening-overview.md)
**Date:** 2026-04-19
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_STATEFUL_DEMO_DATA`
**Revenue Impact:** TABLE_STAKES

---

## 1. Summary
This PRD makes every workflow action in Co-Dispatch persist and reload through the same repositories and APIs. The product may use realistic seeded and synthetic data, but it cannot behave like a front-end illusion. Dispatching, backhaul selection, monitoring ticks, intervention execution, and decision metrics must all survive refresh and power the next workflow state.

## 2. Problem & Vision
**Problem:** Some flows already write to SQLite, but the product still mixes persisted state, synthetic runtime state, and non-authoritative mock data infrastructure. That leaves room for mismatched evidence after refresh or during cross-workflow transitions.
**Vision:** The workstation reloads into the same truth a user created. Assignment records, mirrored trips, intervention drafts, and decision metrics all come from repositories, and synthetic/live integrations feed the same contract shapes.
**Why this priority:** Without durable state, the map, monitoring flow, and economics proof cannot be trusted.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As a judge, I want a dispatch action to survive refresh so that I trust the system recorded it | **Given** I dispatch an outbound or round trip **When** I refresh the app **Then** the trip appears from persisted state and the monitoring stage still reflects it |
| US-2 | As a dispatcher, I want interventions and decision logs to reflect my latest actions so that the dashboard tells the truth | **Given** a monitoring tick drafts or executes an intervention **When** the feed reloads **Then** the draft, log, and metrics come from the database |
| US-3 | As an engineer, I want a single state loop through API -> feature service -> repository -> UI so that demo logic is maintainable | **Given** I inspect workflow mutations **When** I trace them through the codebase **Then** they all pass through the existing server modules and repositories |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As a presenter, I want a resettable demo state so that I can rehearse repeatedly without manual DB surgery | **Given** I trigger a reset action **When** it completes **Then** DB-backed demo entities return to the initial seeded state |

### Out of Scope
- Replacing SQLite with a hosted database
- Building multi-user concurrency controls
- Introducing new workflow domains

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Treat Prisma repositories under [`src/server/repositories/`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/server/repositories) as the only persisted source of workflow truth | **Given** a workflow mutation happens **When** it completes **Then** the UI can reconstruct the resulting state from repository reads alone |
| FR-2 | Extend `LoadAssignment` writes in [`src/server/repositories/load-assignments.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/server/repositories/load-assignments.ts) to store enough structured metadata for proof and replay | **Given** a dispatch succeeds **When** the row is created **Then** it records outbound/return payload metadata, mode, warnings, and economics where available |
| FR-3 | Ensure `ActiveTripMirror` is updated for outbound and return legs and remains the source for monitoring ticks | **Given** a dispatch or scenario trigger occurs **When** the write finishes **Then** `runMonitoringTick()` can discover the trip from `ActiveTripMirror` without relying on in-memory UI state |
| FR-4 | Ensure `InterventionDraft` records include execution status and optional audio provenance | **Given** voice playback or execution occurs **When** the feed reloads **Then** the draft reflects current `status`, `audioSource`, and `matchedCommand` |
| FR-5 | Make decision metrics derived solely from `DecisionLog` repository aggregation | **Given** any workflow records deadhead saved, revenue recovered, or time saved **When** the metrics panel reloads **Then** values match repository aggregation, not client-side math |
| FR-6 | Add a reset path that clears and reseeds demo entities using Prisma and synthetic scenario reset functions | **Given** an operator reset action **When** it succeeds **Then** `DecisionLog`, `LoadAssignment`, `InterventionDraft`, `ActiveTripMirror`, and synthetic scenario state return to initial demo state |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7 | Record a `demoRunId` or equivalent seed/version tag in mutation metadata | **Given** a rehearsal environment **When** multiple demo runs occur **Then** rows can be attributed to a specific reset cycle |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Integrity | Refresh after any workflow mutation shows the same state | 100% for manual rehearsal path |
| NFR-2 | Observability | Every mutation writes a repository-backed trace | 0 primary mutations without a persisted record |
| NFR-3 | Reliability | Reset operation returns the app to known-good state | < 2 seconds local |

## 5. Design Direction

> **Design system: custom Tailwind workstation components**
> For detailed implementation: no separate design skill required.

### Page Structure
State remains surfaced through the existing workstation panels. Reset actions, if added, live outside the judge path or in an operator-only affordance.

### Components
- **Primary:** assignment feedback banner, monitoring feed cards, metrics summaries
- **Actions:** dispatch CTA, intervention execute CTA, operator reset control
- **Forms:** none beyond existing load-intake and hidden operator actions
- **Feedback:** success/error banners with exact copy

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | repository-backed reads pending | current syncing states |
| Empty | no assignments or drafts exist yet | neutral guidance card |
| Populated | assignments, trips, drafts, logs, metrics exist | current workstation panels |
| Error | mutation or reload failed | inline banner |
| Gated | not used | none |

### Responsive
- **Mobile (< 768px):** collapse proof cards into stacked sections
- **Desktop (> 1024px):** keep evidence visible across left panel and map

### Key Interactions
1. User dispatches a load.
2. API writes assignment row and mirrored trips.
3. Monitoring tick reads mirrored trips and may create drafts.
4. User executes a draft and the log/metrics update from DB.
5. Refresh preserves all of the above.

## 6. Data Model

### Schema Changes
Describe schema additions declaratively:
- `LoadAssignment`
  - Add optional `economicsJson` text column for outbound vs round-trip economics snapshot.
  - Add optional `demoRunId` text column indexed for reset/rehearsal tracing.
- `InterventionDraft`
  - Keep existing fields; add optional `executionSummary` text column if execution details need to be replayed cleanly.
- `DecisionLog`
  - No new required columns, but all applicable workflow writes must populate `deadheadSavedMi`, `revenueRecoveredUsd`, and `timeSavedMin`.

### New Tables (if any)
None required.

### Existing Table Modifications (if any)
- `LoadAssignment`: add `economicsJson TEXT NULL`, `demoRunId TEXT NULL`
- `InterventionDraft`: add `executionSummary TEXT NULL`

### Migration Notes
- Backfill existing rows with `NULL`.
- Do not rewrite historical `navProPayloadJson`; keep backward compatibility.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `resetDemoState` | `src/features/demo/server/reset-demo-state.ts` | `() => Promise<{ ok: true }>` | Clear workflow tables, reseed showcase rows, reset synthetic scenario state |

### Modified Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `createAssignment` | [`src/features/dispatch/server/create-assignment.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/dispatch/server/create-assignment.ts) | existing signature | Persist richer assignment metadata and economics |
| `executeIntervention` | [`src/features/monitoring/server/execute-intervention.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/monitoring/server/execute-intervention.ts) | existing signature | Persist execution summary and metric impact |
| `runMonitoringTick` | [`src/features/monitoring/server/run-monitoring-tick.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/monitoring/server/run-monitoring-tick.ts) | existing signature | Deduplicate based on persisted state only |

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| `createAssignment` | refetch `/api/fleet/snapshot`, `/api/monitor/feed` |
| `executeIntervention` | refetch `/api/monitor/feed`, `/api/fleet/snapshot` |
| `resetDemoState` | refetch `/api/fleet/snapshot`, `/api/monitor/feed`, `/api/demo/advanced-ranking` |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Assignment persistence failure | DB write fails after API call | "Dispatch created upstream, but local state failed to save. Refreshing..." | Re-fetch snapshot and show warning | `action='create_assignment', status='partial_failure'` |
| Monitoring draft persistence failure | draft creation throws | "Trip risk detected, but the intervention draft could not be saved." | Retry on next tick | `action='run_monitoring_tick', status='error'` |
| Reset failure | reset API throws | "Demo reset failed. Current state preserved." | Leave current data intact | `action='reset_demo_state', status='error'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | Refresh immediately after dispatch | Persisted trip still appears | P0 |
| 2 | Dispatch with return load and outbound only succeeds upstream | Persist local warnings and partial metadata | P0 |
| 3 | Monitoring tick runs twice on same risk | No duplicate open draft for same trip + trigger | P0 |
| 4 | Empty DB after reset | Snapshot can still rebuild from synthetic/live data and seed load board | P0 |
| 5 | 10K decision log rows later | Repository list can remain capped for UI while aggregate stays accurate | P1 |

## 10. Dev Mode
- **Data:** synthetic NavPro + seeded loads + Prisma SQLite
- **Auth:** none
- **External services:** live voice and live NavPro remain optional; persistence must work even when both are absent

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Stateful demo loop | Full | Full |
| Historical evidence depth | limited in production | unlimited in production |

**Upgrade trigger:** in production, durable history and advanced proofs become premium; in demo, all are enabled.

## 12. AI Path
- **V1 (no AI):** deterministic workflow state still persists
- **Future (AI):** repository history can be summarized into trend and recommendation layers

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Persist assignments, mirrored trips, intervention executions, metrics | Refresh test passes | `ENABLE_STATEFUL_DEMO_DATA=true` |
| 2 | Add reset workflow and run tagging | Rehearsal can restart from clean slate | `ENABLE_STATEFUL_DEMO_DATA=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| Schema migrations on SQLite | Risk | Medium | Use nullable additions only |
| Synthetic and persisted state diverge | Risk | High | Reset both DB and synthetic scenario together |
| Missing economics fields in assignment rows | Dependency | Medium | Add structured metadata before proof-layer PRDs |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Refresh consistency after dispatch | Partial | 100% | manual dispatch-refresh-reload script |
| Duplicate open intervention drafts | Possible under race | 0 | monitoring tick tests |
| Reset time | None | < 2 s local | manual timing |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | SQLite remains the demo database | Existing stack uses Prisma + SQLite | Additional infra work |
| A2 | Repositories remain the correct abstraction seam | Current code already centralizes persistence there | Refactor scope expands |

## 17. Implementation Notes
- **Key files to modify:** [`src/features/dispatch/server/create-assignment.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/dispatch/server/create-assignment.ts), [`src/features/monitoring/server/run-monitoring-tick.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/monitoring/server/run-monitoring-tick.ts), [`src/features/monitoring/server/execute-intervention.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/monitoring/server/execute-intervention.ts), [`src/server/repositories/load-assignments.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/server/repositories/load-assignments.ts), [`src/server/repositories/decision-log.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/server/repositories/decision-log.ts), [`prisma/schema.prisma`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/prisma/schema.prisma), [`prisma/seed.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/prisma/seed.ts)
- **Patterns to follow:** keep route handlers thin; use repository methods instead of direct Prisma from feature routes
- **Testing:** add repository-level tests for persistence + refresh flow, run `npm run typecheck`, `npm test`
- **Design enrichment:** not required
