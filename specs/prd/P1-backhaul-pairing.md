# PRD: Backhaul Pairing

**Priority:** P1
**Initiative:** [00-co-dispatch-overview.md](./00-co-dispatch-overview.md)
**Date:** 2026-04-18
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_BACKHAUL_PAIRING`
**Revenue Impact:** EXPAND

---

## 1. Summary
Implement the Act 2 centerpiece: after a driver is chosen, the app surfaces three return-load options, compares one-way vs round-trip profit, and lets the dispatcher create both legs in one flow. This PRD covers broker corridor search, backhaul math, the real `/api/agent/backhaul` endpoint, return-trip assignment, and the BackhaulModal experience.

## 2. Problem & Vision
**Problem:** A good outbound assignment still leaves money on the table if the truck deadheads home empty. The README and PDF position backhaul pairing as the product’s winning move.
**Vision:** After the user chooses Mike for PHX → SFO, the modal appears immediately with three corridor-compatible return options and a dramatic profit comparison. The user either dispatches the full round trip or explicitly skips.
**Why this priority:** This is the first differentiator beyond standard fleet management and the strongest demo visual.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As Maria, I want backhaul options immediately after selecting a driver so I can avoid empty miles | **Given** an outbound selection **When** the modal opens **Then** three ranked `BackhaulOption` entries are shown |
| US-2 | As Maria, I want one-way and round-trip profit shown side by side so I can justify the second leg | **Given** a selected option **When** the modal renders **Then** it shows `oneWayProfitUsd`, `roundTripProfitUsd`, delta, and total deadhead miles |
| US-3 | As Maria, I want one click to dispatch both legs so I do not recreate the return trip manually | **Given** a selected backhaul option **When** I click `Dispatch full round trip` **Then** `/api/fleet/assignments` is called with `returnLoadId` and returns `tripId` plus `returnTripId` |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As Maria, I want to skip backhaul explicitly so I retain control if the options look weak | **Given** the modal is open **When** I click `Skip backhaul` **Then** the modal closes without creating a return trip |

### Out of Scope
- Generic marketplace search beyond the seeded load broker
- Alternative economic models beyond the documented profit math

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Implement corridor search for candidate return loads | **Given** an outbound route and home base **When** `searchLoadsNearRoute` runs **Then** it returns at most 10 candidates whose origins are within 50 miles of the corridor and destinations are within 100 miles of the original origin |
| FR-2 | Enforce pickup window logic for return loads | **Given** an outbound drop time **When** searching backhauls **Then** candidates must start within 48 hours after outbound delivery |
| FR-3 | Implement `findBackhauls` math using the README guidance | **Given** an outbound load and candidate return loads **When** backhaul scoring runs **Then** it calculates total revenue, total deadhead, one-way profit, round-trip profit, and HOS feasibility and returns the top 3 by `roundTripProfitUsd` |
| FR-4 | Implement `POST /api/agent/backhaul` | **Given** `{outboundLoadId, driverId}` **When** the endpoint is called **Then** it returns validated `BackhaulOption[]` |
| FR-5 | Extend assignments to support `returnLoadId` | **Given** `{driverId, loadId, returnLoadId}` **When** assignment is submitted **Then** a second trip is created and the response includes `returnTripId` |
| FR-6 | Seed demo backhauls `TL-BH-01`, `TL-BH-02`, `TL-BH-03` | **Given** demo mode **When** backhaul options are requested for the demo outbound load **Then** the SFO → Vegas → PHX narrative is available and ranks first |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7 | Persist selected backhaul narrative in the decision log | **Given** a round-trip dispatch **When** it succeeds **Then** the selected option narrative is logged for the closer |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Performance | Modal should feel immediate after ranking dispatch click | modal data visible in ≤ 3 seconds in demo mode |
| NFR-2 | Explainability | Profit math must be readable and reproducible | all displayed numbers come from stored response values |
| NFR-3 | UX | Option switching must update map and bar without re-requesting | local state update only after initial fetch |

## 5. Design Direction

> **Design system: shadcn/ui + Tailwind CSS**
> For detailed implementation: invoke `/interface-design` with this section.

### Page Structure
- Full-screen modal/dialog launched from the ranking workflow
- Two-map split: outbound on left, return on right
- Bottom section: profit comparison bar and option selector list

### Components
- **Primary:** `Dialog`, `Card`, `Button`, `ScrollArea`, `Badge`, `Separator`
- **Actions:** `Dispatch full round trip`, `Skip backhaul`
- **Forms:** option selection via clickable rows/cards
- **Feedback:** skeleton modal while options load, error alert with retry

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | Modal shell opens and waits for options | modal-local `Skeleton` |
| Empty | No corridor matches found | `Card` with `Skip backhaul` CTA |
| Populated | Options, maps, and profit bar visible | dialog layout |
| Error | Backhaul endpoint failed | destructive `Alert` with `Retry backhaul search` |
| Gated | None | None |

### Responsive
- **Mobile (< 768px):** unsupported-screen message inherited from dashboard shell
- **Desktop (> 1024px):** two-map split with full-width profit bar

### Key Interactions
1. User clicks dispatch on ranking card.
2. Modal opens and fetches `/api/agent/backhaul`.
3. Highest-profit option is selected by default.
4. User switches options and sees map/profit updates.
5. User dispatches full round trip or skips.

## 6. Data Model

### Schema Changes
Use existing `LoadAssignment` and `DecisionLog` tables to store return-trip context.

### New Tables (if any)
None.

### Existing Table Modifications (if any)
- `LoadAssignment`
  - ensure `returnLoadId` and `returnTripId` exist
  - add `backhaulNarrative`: string nullable
  - add `profitDeltaUsd`: float nullable

### Migration Notes
All new backhaul columns nullable so prior one-way assignments remain valid.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `findBackhauls` | `src/features/backhaul/server/find-backhauls.ts` | `(input: { outbound: Load; driverHomeBase: { lat: number; lng: number; city: string }; returnWindowHours: number }) => Promise<BackhaulOption[]>` | Build ranked round-trip options |
| `getBackhaulOptions` | `src/features/backhaul/server/get-backhaul-options.ts` | `(input: { outboundLoadId: string; driverId: number }) => Promise<BackhaulOption[]>` | Resolve driver/load context and return options |

### Modified Actions
| Action | Location | Change |
|--------|----------|--------|
| `createAssignment` | `src/features/dispatch/server/create-assignment.ts` | Support optional `returnLoadId` and second trip creation |

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| Round-trip assignment | `fleet-snapshot`, `decision-log` |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| No return loads found | search returns zero candidates | "No viable backhaul found. You can still dispatch outbound only." | Keep modal open with `Skip backhaul` | `area='backhaul', status='empty'` |
| Backhaul fetch failed | `/api/agent/backhaul` 5xx | "Backhaul search failed. Retry or skip." | Retry button in modal | `area='backhaul', action='search', status='error'` |
| Return trip creation failed | outbound succeeded, return failed | "Outbound trip created, but return leg failed. Review before proceeding." | Keep assignment summary visible and refresh snapshot | `area='backhaul', action='assign_return', status='partial'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | Only 1 viable option | Show one selected option and keep dispatch CTA enabled | P0 |
| 2 | 0 HOS-feasible options | Show options marked infeasible and disable full round-trip CTA | P0 |
| 3 | Option ties on round-trip profit | Break ties by lower `totalDeadheadMiles`, then alphabetical narrative | P1 |
| 4 | User closes modal after outbound assignment | Treat as skip and preserve existing outbound dispatch | P0 |

## 10. Dev Mode
- **Data:** seed `TL-BH-01`, `TL-BH-02`, `TL-BH-03` and deterministic driver home bases
- **Auth:** none
- **External services:** use local broker data only; no external load board integration required

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Backhaul pairing | Full access | Full access |

**Upgrade trigger:** None in current scope.

## 12. AI Path
- **V1 (no AI):** rules-based corridor search and math are enough
- **Future (AI):** explain route narratives and recommend why one return leg is strategically better

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Mock backhaul options with real math | Demo flow shows SFO → Vegas → PHX as top option | `ENABLE_BACKHAUL_PAIRING=true` in demo mode |
| 2 | Full round-trip create flow | Both trip IDs persisted and shown on map | `ENABLE_BACKHAUL_PAIRING=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| Seed data quality | Blocker | High | Seed explicit corridor loads matching demo script |
| Return-trip NavPro payload | Risk | Medium | Store request payload and validate with mock first |
| Modal UX weakens demo | Risk | High | Treat interface-design follow-up as required before final polish |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Backhaul modal load success | 0% | 100% in demo scenario | smoke test |
| Demo profit delta | 0 | one-way ≈ $2,100, round-trip ≈ $4,800 | fixture-based integration |
| Repeatability | 0/5 | 5/5 successful fresh runs | manual smoke |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | One-way profit uses outbound revenue minus deadhead cost at $0.65/mi | README documents this proxy | If costs broaden, displayed economics change |
| A2 | Top option is selected by default | Simplifies demo and aligns with “best pick” narrative | User choice friction increases if no default is set |
| A3 | Return route visuals can use home base instead of exact final destination trip path | Shared contract exposes return load and home base, not a separate route contract | Route rendering may need refinement later |

## 17. Implementation Notes
- **Key files to modify:** `src/app/api/agent/backhaul/route.ts`, `src/features/backhaul/**`, `src/features/dispatch/server/create-assignment.ts`, `data/loads/seed.json`
- **Patterns to follow:** corridor rules and demo values from `README.md` Phase 3
- **Testing:** unit tests for profit math and corridor filtering; integration test for top-3 option ordering; smoke test for full round-trip creation
- **Design enrichment:** invoke `/interface-design` with Section 5
