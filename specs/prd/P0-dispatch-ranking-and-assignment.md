# PRD: Dispatch Ranking and Assignment

**Priority:** P0
**Initiative:** [00-co-dispatch-overview.md](./00-co-dispatch-overview.md)
**Date:** 2026-04-18
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_DISPATCH_RANKING`
**Revenue Impact:** CONVERT

---

## 1. Summary
Implement the core Act 2 workflow: parse a broker load, score drivers with explainable math, render ranking cards, and dispatch the winning driver through `/api/fleet/assignments`. This PRD includes the scoring formulas from `README.md`, the seeded demo load and drivers, and the UI needed to show why Mike wins and Jake is eliminated. This is the minimum viable product moment even before backhaul and voice.

## 2. Problem & Vision
**Problem:** Dispatchers choose drivers from memory, not an explainable ranking. That leads to deadhead waste, HOS mistakes, and fragile decisions.
**Vision:** The user pastes a broker email, the system parses it into a `Load`, scores every driver with visible math, clearly eliminates infeasible candidates, and lets the dispatcher create a trip with one click.
**Why this priority:** This is the first full value loop in the app and the prerequisite for backhaul pairing.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As Maria, I want to paste a broker email and get a structured load so I do not retype dispatch data | **Given** a broker email in the load inbox **When** the user submits it **Then** the system parses a valid `Load` object or shows a parsing failure state |
| US-2 | As Maria, I want every driver ranked with visible math so I can defend the choice | **Given** a parsed load **When** ranking completes **Then** the UI shows ordered `DriverScore` cards with score, deadhead, HOS check, fuel cost, ETA confidence, ripple impact, and rationale |
| US-3 | As Maria, I want infeasible drivers clearly marked so I do not accidentally assign them | **Given** a driver fails HOS or hard compliance gating **When** ranking renders **Then** the card shows `eliminated` state and the exact `eliminationReason` |
| US-4 | As Maria, I want to click dispatch on the top-ranked driver so the trip is created immediately | **Given** a ranked driver card **When** the user clicks `Dispatch {driverName}` **Then** `/api/fleet/assignments` is called and a success toast confirms trip creation |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-5 | As Maria, I want the score math displayed in the card so I see how the number was derived | **Given** a ranking card **When** the user expands the why section **Then** the formula display matches the README example and uses monospace formatting |

### Out of Scope
- Backhaul options and round-trip dispatch
- Voice intervention
- Free-form chat beyond load-driven dispatch tasks

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Implement load parsing as a server use-case that outputs the shared `Load` shape | **Given** broker email text **When** parsing succeeds **Then** `loadId`, `source`, origin, destination, pickup window, rate, and optional freight details are returned |
| FR-2 | Implement `scoreDriverForLoad` using the exact formulas from `README.md` | **Given** a driver, load, and fleet snapshot **When** scoring runs **Then** deadhead, required minutes, HOS pass, fuel cost, ripple impact, and clamped score follow the documented formulas |
| FR-3 | Implement `POST /api/agent/score` as a non-streaming endpoint returning sorted `DriverScore[]` | **Given** a valid `Load` payload **When** the endpoint is called **Then** it returns drivers sorted descending by `score` |
| FR-4 | Implement `POST /api/fleet/assignments` to create a NavPro trip and persist a `LoadAssignment` row | **Given** `{driverId, loadId}` **When** assignment succeeds **Then** the response returns `{tripId}` and the DB stores the assignment record |
| FR-5 | Seed the demo load `TL-DEMO-01` and demo drivers Mike Chen and Jake Morrison | **Given** demo mode data **When** the user pastes the README sample email **Then** Mike ranks first and Jake is eliminated with the documented reason |
| FR-6 | Render ranking cards in the left/center dashboard workflow | **Given** scoring completes **When** the UI updates **Then** one `DriverRankCard` renders per `DriverScore` |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7 | Highlight deadhead route on click from the ranking card | **Given** a ranking card **When** the user clicks deadhead miles **Then** the map highlights the route from the driver's current location to the load origin |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Performance | Demo ranking flow should feel fast | ranking visible within 5 seconds in local/demo mode |
| NFR-2 | Determinism | Scoring math must be reproducible | same inputs always produce same numeric outputs |
| NFR-3 | Trust | LLM may polish rationale only, never compute the numbers | 0 numeric fields derived by LLM |

## 5. Design Direction

> **Design system: shadcn/ui + Tailwind CSS**
> For detailed implementation: invoke `/interface-design` with this section.

### Page Structure
- Left panel: load inbox with paste area and brief
- Center panel: fleet map plus optional highlighted route
- Ranking display appears beneath or alongside the inbox depending on available vertical space

### Components
- **Primary:** `Textarea`, `Card`, `Button`, `Badge`, `ScrollArea`, `Separator`
- **Actions:** `Dispatch {driverName}` button on top card
- **Forms:** pasted text submit, optional file drop shell
- **Feedback:** `Skeleton`, `Alert`, success/error toast

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | Parsing or scoring in progress | ranking-card skeletons |
| Empty | No pasted load yet | empty inbox prompt `Paste a broker email to rank drivers` |
| Populated | Parsed load and ranked cards visible | `Card` grid/list |
| Error | Parsing or assignment failed | destructive `Alert` + retry action |
| Gated | None | None |

### Responsive
- **Mobile (< 768px):** unsupported-screen message inherited from dashboard shell
- **Desktop (> 1024px):** cards render in a vertical stack with the top card visually emphasized

### Key Interactions
1. User pastes broker email.
2. Submit triggers parse request.
3. Parsed load triggers `/api/agent/score`.
4. Ranked cards render.
5. User expands “why” for full formula.
6. User clicks dispatch on top card and sees a success toast.

## 6. Data Model

### Schema Changes
Extend `LoadAssignment` to capture enough assignment context for auditability and later backhaul support.

### New Tables (if any)
None.

### Existing Table Modifications (if any)
- `LoadAssignment`
  - add `scoreSnapshotJson`: JSON/text storing the top ranking at assignment time
  - add `assignedBy`: string default `copilot-ui`
  - add `navProPayloadJson`: JSON/text for request/response audit

### Migration Notes
All new columns should be nullable on migration and populated for new assignments only.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `parseLoadInput` | `src/features/dispatch/server/parse-load.ts` | `(input: { userMessage: string }) => Promise<Load>` | Convert broker text into contract load |
| `scoreLoad` | `src/features/dispatch/server/score-load.ts` | `(load: Load) => Promise<DriverScore[]>` | Rank drivers against a load |
| `createAssignment` | `src/features/dispatch/server/create-assignment.ts` | `(input: { driverId: number; loadId: string; returnLoadId?: string }) => Promise<{ tripId: string; returnTripId?: string }>` | Create trip and persist assignment |

### Modified Actions
| Action | Location | Change |
|--------|----------|--------|
| `getFleetSnapshot` | `src/features/fleet/server/get-fleet-snapshot.ts` | Mirror active trips into `ActiveTripMirror` on each fetch |

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| `createAssignment` | `fleet-snapshot`, `decision-log` |
| Demo load parse | none |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Load parse failed | parser cannot produce valid `Load` | "Could not parse this load. Paste rate, origin, destination, and pickup window." | Keep input intact for editing | `area='dispatch', action='parse', status='error'` |
| Score request failed | `/api/agent/score` 5xx or contract mismatch | "Driver ranking unavailable. Try again in a moment." | Keep parsed load in state and retry manually | `area='dispatch', action='score', status='error'` |
| Assignment failed | NavPro trip create fails | "Trip creation failed. No dispatch was saved." | Do not close ranking UI; allow retry | `area='dispatch', action='assign', status='error'` |
| Assignment partially persisted | NavPro succeeded but DB write failed | "Trip created upstream, but local log failed. Refreshing fleet state." | Re-fetch snapshot immediately and log warning | `area='dispatch', action='assign', status='partial'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | Parsed load missing weight or commodity | Continue scoring; optional fields remain undefined | P0 |
| 2 | All drivers eliminated | Show cards in eliminated state and disable dispatch CTA | P0 |
| 3 | Multiple drivers tie on score | Sort by lower deadhead miles, then higher HOS remaining, then driver name ascending | P1 |
| 4 | Duplicate dispatch click | Disable CTA after first click until response resolves | P0 |

## 10. Dev Mode
- **Data:** include `TL-DEMO-01`, Mike Chen, and Jake Morrison in demo fixtures
- **Auth:** none
- **External services:** in mock mode, assignment returns deterministic `tripId` strings and records them locally

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Load parsing and driver ranking | Full access | Full access |
| Assignment creation | Full access | Full access |

**Upgrade trigger:** None in current scope.

## 12. AI Path
- **V1 (no AI):** direct JSON load payloads could score drivers without natural-language parsing
- **Future (AI):** support PDF/image extraction and richer rationale wording

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Mock parsing + deterministic scoring | Demo input produces Mike/Jake outcome locally | `ENABLE_DISPATCH_RANKING=true`, `USE_NAVPRO_MOCK=true` |
| 2 | Live assignment to NavPro | README acceptance test passes against real trip create | `ENABLE_DISPATCH_RANKING=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| Real NavPro create trip payload shape | Blocker | High | Implement mock assignment path and request logging first |
| LLM structured output variability | Risk | Medium | Validate parser output with zod and fall back to explicit parse failure message |
| Scoring perception mismatch | Risk | Medium | Show full math and exact elimination reason |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Demo parse-to-rank flow | 0% | 100% on demo input | smoke scenario |
| Correct top driver | 0 | Mike Chen is rank #1 | integration test fixture |
| Correct elimination | 0 | Jake shows exact HOS elimination reason | integration test fixture |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | Load parsing can accept plain text only for v1 | README centers on pasted broker email | PDF/image parsing can be added later |
| A2 | Compliance hard-fail uses current flag set plus HOS failure | Contract includes compliance flags but not exact hard-fail matrix | If stricter rules are needed, scoring logic must expand |
| A3 | The sample email maps to `TL-DEMO-01` in demo mode | Needed for deterministic acceptance tests | Demo data matching rules need adjustment if not used |

## 17. Implementation Notes
- **Key files to modify:** `src/app/api/fleet/assignments/route.ts`, `src/app/api/agent/score/route.ts`, `src/features/dispatch/**`, `src/features/fleet/**`, `data/loads/seed.json`
- **Patterns to follow:** formulas and demo text from `README.md` Phase 2; types from `docs/contracts.ts`
- **Testing:** unit tests for scoring formulas; integration test for Mike/Jake ordering; manual smoke with the sample email from README
- **Design enrichment:** invoke `/interface-design` with Section 5
