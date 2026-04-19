# PRD: Dashboard Polish and Decision Log

**Priority:** P2
**Initiative:** [00-co-dispatch-overview.md](./00-co-dispatch-overview.md)
**Date:** 2026-04-18
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_DECISION_LOG`
**Revenue Impact:** RETAIN

---

## 1. Summary
Implement the final closer experience: a decision log timeline, top-line outcome metrics, polished transitions, and backup-demo affordances that turn a working tool into a compelling end-to-end narrative. This PRD also covers the dashboard tab switch between primary workflow view and decision log view.

## 2. Problem & Vision
**Problem:** Even if the workflows work, the product loses impact if it ends abruptly without showing cumulative value. The README’s closer depends on a persistent decision log and strong demo polish.
**Vision:** At any point, the user can switch to a Decision Log view showing timestamped actions, math summaries, outcomes, and aggregate metrics like deadhead miles eliminated, revenue recovered, and time saved per day.
**Why this priority:** It is the capstone that ties the app into the “decisions, not dashboards” story.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As Maria, I want a decision log so I can see what the system decided and why | **Given** assignments, backhauls, or interventions have occurred **When** I open the Decision Log **Then** I see timeline entries with timestamp, action, math summary, and outcome |
| US-2 | As a judge, I want summary metrics at the top so I understand the operational impact quickly | **Given** decision log data exists **When** the log view opens **Then** aggregate metrics display above the timeline |
| US-3 | As a presenter, I want the app to feel polished during transitions so the demo lands emotionally | **Given** the user moves between ranking, backhaul, alerts, and log view **When** the UI updates **Then** transitions are smooth and panel layouts stay stable |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As a presenter, I want a stable fallback video reference in the repo so a crash does not end the demo | **Given** the repo assets **When** final polish is complete **Then** `/public/backup-demo.mp4` exists or is explicitly reserved |

### Out of Scope
- External analytics platforms
- Long-term BI reporting outside the demo/log scope

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Implement a dashboard tab or toggle that switches between workflow view and decision log view | **Given** the dashboard top bar **When** the user selects `Decision Log` **Then** the main content swaps to the log layout without a full page navigation |
| FR-2 | Implement `DecisionLog` timeline UI backed by `DecisionLog` records | **Given** log records exist **When** the component renders **Then** entries are sorted descending by `createdAt` |
| FR-3 | Show aggregate metrics above the timeline | **Given** log data exists **When** metrics are computed **Then** the UI shows deadhead miles eliminated, revenue recovered, and daily time saved using stored records and seeded demo totals if needed |
| FR-4 | Log assignment, backhaul, and intervention actions as they happen | **Given** any successful workflow mutation **When** it completes **Then** a `DecisionLog` row is written |
| FR-5 | Preserve stable loading states so panels do not jump during async work | **Given** any panel fetch or mutation is in progress **When** the UI updates **Then** panel dimensions stay fixed and skeletons replace content locally |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-6 | Provide a reserved location for `/public/backup-demo.mp4` | **Given** the repo assets **When** final polish is complete **Then** the backup video can be served statically |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Visual Stability | No whole-page spinners after shell load | 0 global loading blockers in normal workflow |
| NFR-2 | Readability | Decision log must remain scannable for at least 50 entries | timeline remains readable without layout breakage |
| NFR-3 | Demo polish | Core transitions should feel intentional | no abrupt unmounted flashes between major workflow states |

## 5. Design Direction

> **Design system: shadcn/ui + Tailwind CSS**
> For detailed implementation: invoke `/interface-design` with this section.

### Page Structure
- Top bar toggle between main workflow and decision log
- Decision log view uses a vertical timeline layout with aggregate metric cards on top
- Main workflow view keeps existing three-panel shell

### Components
- **Primary:** `Tabs`, `Card`, `ScrollArea`, `Badge`, `Separator`
- **Actions:** view toggle only
- **Forms:** none
- **Feedback:** skeleton metric cards, empty-state log card

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | log or metrics still loading | metric card skeletons + timeline skeleton rows |
| Empty | no decision rows yet | `Card` with `No decisions logged yet` |
| Populated | metrics and timeline entries shown | timeline + stat cards |
| Error | log fetch or aggregate calculation fails | destructive `Alert` with `Retry log` |
| Gated | None | None |

### Responsive
- **Mobile (< 768px):** unsupported-screen message inherited from dashboard shell
- **Desktop (> 1024px):** metrics in a row at top, timeline below

### Key Interactions
1. User clicks Decision Log in top bar.
2. Metrics cards load first.
3. Timeline entries render newest-first.
4. User returns to workflow view without losing current workflow state.

## 6. Data Model

### Schema Changes
Extend `DecisionLog` with fields required for aggregate calculations and grouping.

### New Tables (if any)
None.

### Existing Table Modifications (if any)
- `DecisionLog`
  - add `deadheadSavedMi`: float nullable
  - add `revenueRecoveredUsd`: float nullable
  - add `timeSavedMin`: float nullable
  - add `entityType`: string nullable (`assignment`, `backhaul`, `intervention`)

### Migration Notes
Older rows may remain null for metric fields; aggregate queries should treat null as zero.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `listDecisionLog` | `src/features/decision-log/server/list-decision-log.ts` | `() => Promise<DecisionLogViewModel[]>` | Read timeline entries |
| `getDecisionMetrics` | `src/features/decision-log/server/get-decision-metrics.ts` | `() => Promise<{ deadheadSavedMi: number; revenueRecoveredUsd: number; timeSavedMin: number }>` | Compute top-line metrics |
| `appendDecisionLog` | `src/features/decision-log/server/append-decision-log.ts` | `(input: AppendDecisionLogInput) => Promise<void>` | Shared mutation logger |

### Modified Actions
| Action | Location | Change |
|--------|----------|--------|
| `createAssignment` | `src/features/dispatch/server/create-assignment.ts` | append assignment and backhaul log records |
| `runMonitoringTick` / intervention execution flow | `src/features/monitoring/server/*` | append intervention log records |

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| Append decision log | `decision-log` |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Log fetch failed | decision log query fails | "Decision log unavailable. Try again." | Stay on current view and retry manually | `area='decision_log', action='list', status='error'` |
| Metrics calc failed | aggregate query fails | "Impact metrics unavailable. Showing timeline only." | Show timeline without metric cards | `area='decision_log', action='metrics', status='degraded'` |
| Log append failed | mutation completes but log write fails | None to user in v1 | Log warning and continue core workflow | `area='decision_log', action='append', status='error'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | 0 log entries | Show empty-state card and zeroed metrics | P0 |
| 2 | 50+ log entries | ScrollArea with virtualized or stable long-list rendering if needed | P1 |
| 3 | Null metric fields on old rows | Treat as zero in aggregates | P0 |

## 10. Dev Mode
- **Data:** if no real rows exist, provide seeded demo timeline entries matching the README closer metrics
- **Auth:** none
- **External services:** none

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Decision log and demo polish | Full access | Full access |

**Upgrade trigger:** None in current scope.

## 12. AI Path
- **V1 (no AI):** explicit action logging and aggregate math
- **Future (AI):** natural-language monthly summary and anomaly explanations

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Decision log entries and empty-state metrics | Timeline renders with seeded entries | `ENABLE_DECISION_LOG=true` |
| 2 | Full closer experience | live workflow writes metrics-bearing rows | `ENABLE_DECISION_LOG=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| Incomplete prior workflow logging | Risk | High | Add append hooks in each mutation PRD |
| Weak aggregate numbers | Risk | Medium | Seed impressive but traceable demo fixtures in dev mode |
| View toggle resets workflow state | Risk | Medium | Keep dashboard and log under one route stateful shell |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Log append coverage | 0% | 100% of successful assignments/backhauls/interventions | integration audit |
| Closer metrics visible | 0% | 100% | smoke test |
| View-toggle stability | 0 | workflow state preserved when returning from log view | manual regression |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | Decision log is a tab/toggle, not a separate route | README calls it a tab toggle in top bar | Navigation structure changes if separate route is preferred |
| A2 | Stored metrics are enough for demo aggregates | Simpler and more reliable than recomputing from raw upstream data | More complex aggregate pipeline if wrong |
| A3 | Backup video is a static public asset, not an in-app player requirement | README only requires it to exist and be ready | Additional UI work if playback needs to be in-app |

## 17. Implementation Notes
- **Key files to modify:** `src/features/decision-log/**`, top bar/dashboard shell files, `public/backup-demo.mp4`
- **Patterns to follow:** closer script and polish guidance from README Phase 5 and Demo Script sections
- **Testing:** unit tests for aggregate calculation; integration test for log append; manual smoke for workflow-to-log toggle
- **Design enrichment:** invoke `/interface-design` with Section 5
