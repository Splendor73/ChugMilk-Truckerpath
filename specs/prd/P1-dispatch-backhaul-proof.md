# PRD: Dispatch and Backhaul Proof

**Priority:** P1
**Initiative:** [00-co-dispatch-working-demo-hardening.md](./00-co-dispatch-working-demo-hardening-overview.md)
**Date:** 2026-04-19
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_DISPATCH_BACKHAUL_PROOF`
**Revenue Impact:** EXPAND

---

## 1. Summary
This PRD turns the assignment and backhaul flow into defensible proof instead of persuasive copy. The scoring math, counterfactuals, economics, and advanced ranking showcase must all be explainable from seeded or live data sources without admitting “fake” behavior. The user should be able to inspect why a driver wins, why another driver loses, and how the round-trip economics change.

## 2. Problem & Vision
**Problem:** The core ranking engine is real, but the UI still includes credibility leaks like “DB-backed fake driver data,” and `find-backhauls.ts` contains a demo-specific override for one hero lane.
**Vision:** The assignment and backhaul experience is still optimized for the PHX → SFO demo, but the proof comes from realistic seeded data, explicit formulas, and persisted economics snapshots rather than one-off hardcoded overrides.
**Why this priority:** This is the product’s main judging moment and the strongest upsell story for Trucker Path’s own marketplace.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As a judge, I want to see how the winning driver was scored so that I believe the recommendation | **Given** a parsed load with ranked candidates **When** I inspect the top candidate and counterfactuals **Then** deadhead, HOS, fuel, ETA confidence, and ripple impact are visible and consistent with the backend calculation |
| US-2 | As a dispatcher, I want backhaul economics to be based on seeded or live route opportunities so that the round-trip recommendation feels real | **Given** a selected outbound driver and load **When** backhaul options appear **Then** revenue, deadhead, and round-trip profit come from repeatable search and formula logic |
| US-3 | As an engineer, I want the advanced showcase to read as seeded operational evidence, not fake filler, so that it supports the main product instead of undermining it | **Given** the advanced showcase panel **When** it loads **Then** the explanation copy references seeded signals and demo provenance without using the word “fake” |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As a judge, I want to click a metric and see what it means so that the UI feels explainable, not decorative | **Given** a metric row like deadhead or HOS **When** I interact with it **Then** a concise explanation appears inline |

### Out of Scope
- OCR or full PDF parsing
- Broker marketplace live integration beyond current load-board seam
- Dynamic fuel-price ingestion

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Preserve the existing scoring formula from [`src/features/dispatch/server/score-load.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/dispatch/server/score-load.ts) unless intentionally revised | **Given** a candidate driver **When** they are scored **Then** the result still uses deadhead, HOS slack, pickup timing, economics, destination fit, performance, network penalty, and compliance penalty |
| FR-2 | Surface exact scoring evidence in the UI | **Given** a ranked candidate **When** their card renders **Then** visible fields include `deadheadMiles`, `hosCheck.availableMin`, `hosCheck.requiredMin`, `fuelCostUsd`, `etaConfidence`, and `rippleImpact` |
| FR-3 | Replace `applyDemoOverride()` in [`src/features/backhaul/server/find-backhauls.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/backhaul/server/find-backhauls.ts) with seeded scenario economics | **Given** the hero outbound lane **When** the best backhaul is computed **Then** the winning economics come from a seeded scenario definition or load-board data, not an inline override function |
| FR-4 | Persist outbound vs round-trip economics with each assignment | **Given** a user dispatches outbound only or with a return load **When** the assignment is saved **Then** the row stores one-way profit, round-trip profit, total deadhead, and winning narrative snapshot |
| FR-5 | Rewrite advanced showcase explanation and header copy to remove the term “fake” | **Given** the showcase panel renders **When** a judge reads it **Then** the copy says the panel is seeded, database-backed, and sourced from operational demo signals |
| FR-6 | Show at least one counterfactual for eliminated candidates | **Given** there are eliminated drivers **When** the panel renders **Then** the UI shows the precise elimination reason from `score-load.ts` |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7 | Add inline explanation affordances for metric chips | **Given** a user clicks deadhead, HOS, fuel, ETA, or ripple **When** the interaction resolves **Then** the UI opens a small explanatory detail based on current score inputs |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Accuracy | UI values match backend response exactly | 0 visible mismatches in manual audit |
| NFR-2 | Trust | No user-facing copy admits fake or unfinished evidence | 0 such phrases in dispatch/backhaul path |
| NFR-3 | Performance | Analysis + scoring + backhaul fetch feels responsive in demo mode | < 2.5 s combined local |

## 5. Design Direction

> **Design system: custom Tailwind workstation components**
> For detailed implementation: no separate design skill required.

### Page Structure
The load-assignment and backhaul-review stages stay inside the left workstation panel while the center map reflects the selected evidence.

### Components
- **Primary:** candidate cards, metric grid, rationale card, backhaul option cards, advanced showcase rows
- **Actions:** `Re-run analysis`, `Dispatch`, `Outbound`, backhaul selection
- **Forms:** load-intake textarea
- **Feedback:** assignment feedback banner and inline explanation drawers

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | analysis or showcase is in progress | existing button loading states + skeleton rows |
| Empty | no parsed load yet | load-intake prompt |
| Populated | scores and backhauls loaded | current workstation ranking panels |
| Error | analysis or backhaul fetch fails | inline banner using exact error text |
| Gated | not used | none |

### Responsive
- **Mobile (< 768px):** show only top candidate first and collapse secondaries
- **Desktop (> 1024px):** keep top candidate, secondaries, counterfactuals, and showcase visible in one scroll

### Key Interactions
1. User pastes a lane.
2. Copilot parses and scores it.
3. User inspects top candidate and counterfactuals.
4. User opens backhaul review and sees corridor economics.
5. Dispatch writes the chosen economics snapshot.

## 6. Data Model

### Schema Changes
- `LoadAssignment`
  - Add `economicsJson TEXT NULL` if not already introduced by the persistence PRD.
  - Add `scoreSnapshotJson TEXT NULL` population requirement if the column remains the main storage field.

### New Tables (if any)
None required.

### Existing Table Modifications (if any)
- Ensure `scoreSnapshotJson` stores ranked candidate summary or top-candidate evidence.
- Ensure `backhaulNarrative` and `profitDeltaUsd` are populated for round-trip assignments.

### Migration Notes
- Existing rows remain valid; new writes populate the richer fields.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `getSeededBackhaulScenario` | `src/features/backhaul/server/seeded-backhaul-scenarios.ts` | `(outboundLoadId: string) => Scenario | null` | Replace one-off inline hero override with structured seed data |

### Modified Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `scoreLoad` | existing file | existing signature | expose any additional proof fields needed by the UI |
| `findBackhauls` | existing file | existing signature | remove inline override and source hero proof from scenario seeds |
| `createAssignment` | existing file | existing signature | persist economics snapshot |
| `getAdvancedRankingShowcase` | [`src/features/dispatch/server/advanced-ranking-showcase.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/dispatch/server/advanced-ranking-showcase.ts) | existing signature | rewrite explanation copy and provenance text |

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| dispatch assignment | refetch `/api/fleet/snapshot`, `/api/monitor/feed` |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Analysis failure | copilot or score route errors | "Load analysis failed." | Keep previous analysis visible until next run | `surface='dispatch', action='analyze_load', status='error'` |
| Backhaul lookup failure | `/api/agent/backhaul` errors | "Backhaul options unavailable for this lane." | Allow outbound-only dispatch | `surface='dispatch', action='backhaul_lookup', status='error'` |
| Showcase failure | advanced ranking fetch errors | "Advanced showcase failed to load." | Hide showcase and keep core ranking usable | `surface='dispatch', action='advanced_showcase_load', status='error'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | No non-eliminated drivers | Show blocker summary and disable dispatch CTA | P0 |
| 2 | Backhaul search returns zero results | Keep outbound dispatch path visible | P0 |
| 3 | Hero lane not found in seeded scenario table | Fall back to route search only | P0 |
| 4 | Negative round-trip delta | Show outbound as preferred decision | P1 |

## 10. Dev Mode
- **Data:** seeded load board, synthetic fleet snapshot, seeded advanced showcase rows
- **Auth:** none
- **External services:** not required for proof flow

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Top candidate recommendation | 1 recommendation | full ranked table |
| Counterfactual reasoning | hidden | full |
| Backhaul profit optimization | preview | full execution |

**Upgrade trigger:** the jump from one recommendation to a full explainable optimizer is the natural paywall.

## 12. AI Path
- **V1 (no AI):** deterministic rule-based ranking and backhaul comparison
- **Future (AI):** natural-language “why not Jake?” and “what if we delay pickup?” exploration against the same score inputs

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Remove fake copy, persist economics, replace hero override | manual economics audit passes | `ENABLE_DISPATCH_BACKHAUL_PROOF=true` |
| 2 | Metric explanation affordances | judge rehearsal confirms explainability | `ENABLE_DISPATCH_BACKHAUL_PROOF=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| Existing hero override is convenient but brittle | Risk | High | Replace with seeded scenario object |
| Score evidence may drift from UI labels | Risk | Medium | Render directly from API response fields |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Fake-copy instances in dispatch flow | At least 1 | 0 | copy audit |
| Economics snapshot persistence rate | partial | 100% of dispatches | DB inspection |
| Judge comprehension of “why this driver” | subjective | immediate | rehearsal feedback |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | The existing score formula is directionally correct for demo | It already captures the right signals | Formula review expands scope |
| A2 | Hero corridor economics can be represented as seeded scenario data | User permits realistic mock data with logic | Need live marketplace integration sooner |

## 17. Implementation Notes
- **Key files to modify:** [`src/features/dispatch/server/score-load.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/dispatch/server/score-load.ts), [`src/features/backhaul/server/find-backhauls.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/backhaul/server/find-backhauls.ts), [`src/features/dispatch/server/advanced-ranking-showcase.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/features/dispatch/server/advanced-ranking-showcase.ts), [`src/components/workstation/dispatch-workstation.tsx`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/components/workstation/dispatch-workstation.tsx)
- **Patterns to follow:** keep proof fields inside shared contracts and schemas; render from API payloads rather than duplicating formulas in the UI
- **Testing:** unit tests for backhaul seed logic, assignment persistence assertions, manual audit of displayed metrics
- **Design enrichment:** not required
