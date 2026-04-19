# PRD: Demo Shell Integrity

**Priority:** P0
**Initiative:** [00-co-dispatch-working-demo-hardening.md](./00-co-dispatch-working-demo-hardening-overview.md)
**Date:** 2026-04-19
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_DEMO_SHELL_INTEGRITY`
**Revenue Impact:** TABLE_STAKES

---

## 1. Summary
The current workstation is visually strong, but a judge can still find UI that looks real and does nothing or copy that undermines trust. This PRD defines the shell cleanup pass that makes every visible control in the demo path either functional or absent. The work centers on `src/components/workstation/dispatch-workstation.tsx`, the app layout, and visible chrome. Success means the product feels intentional under active clicking, not staged.

## 2. Problem & Vision
**Problem:** Unwired affordances such as the global search field, decorative bell/settings buttons, dead top-nav items, helper text about future file drop, and copy that says “fake” weaken trust before the product’s real strengths appear.
**Vision:** The shell looks like a focused dispatcher workstation. Every button changes state, navigates, refreshes data, or opens proof. Anything not implemented is removed from the judge path.
**Why this priority:** If the shell leaks “unfinished” signals, later data and workflow improvements will not rescue the demo.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As a judge, I want every visible primary control to do something meaningful so that I trust the product | **Given** I click any primary shell control in the workstation header, rail, or stage tabs **When** the click resolves **Then** the UI changes state, navigates, refreshes, or opens a relevant proof panel |
| US-2 | As a dispatcher, I want the shell to reflect only the four approved workflows so that I am not distracted by fake product breadth | **Given** I load `/` **When** the shell renders **Then** only workflow-relevant navigation and actions are shown |
| US-3 | As an implementer, I want one authoritative shell so that I do not maintain two competing demo surfaces | **Given** the repo **When** I inspect the app entry points **Then** the workstation route is clearly the primary experience and legacy shell patterns are not exposed in the judge path |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As a judge, I want helper copy to read like a real product, not a dev TODO | **Given** helper text, empty states, or status copy **When** they render **Then** none of them mention future work, fake data, or placeholders |

### Out of Scope
- Rebuilding the visual design language
- New workflows outside the four approved moments
- Auth, settings, notifications, or universal search

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Remove or replace the header search field in [`src/components/workstation/dispatch-workstation.tsx`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/components/workstation/dispatch-workstation.tsx) | **Given** the header renders **When** search is not implemented **Then** the field is removed or replaced with a functional workflow status element |
| FR-2 | Remove decorative bell/settings controls unless they open implemented panels | **Given** the header actions render **When** a control has no backed behavior **Then** it does not appear in judge mode |
| FR-3 | Make top navigation and rail actions consistent with the workstation stage model from [`src/lib/navigation/workstation.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/lib/navigation/workstation.ts) | **Given** a user clicks Fleet, Routes, Intelligence, Triage, Dash, Map, Loads, Drivers, or Stats **When** the action fires **Then** it maps to an implemented stage or is removed |
| FR-4 | Rewrite helper text that admits future scope or fake behavior | **Given** load intake, advanced engine showcase, or similar helper copy **When** it renders **Then** it uses present-tense product language and no “later,” “fake,” or “placeholder” wording |
| FR-5 | Remove `MockDataProvider` from [`src/app/layout.tsx`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/app/layout.tsx) if the active workstation no longer depends on it | **Given** the root layout renders **When** the workstation is the only live path **Then** unused in-memory demo context is not wrapped around the app |
| FR-6 | Mark legacy mock-data screen components as non-authoritative implementation references | **Given** engineers inspect `src/components/screens/**` and `src/lib/mock-data/**` **When** they compare them with the workstation **Then** the codebase clearly signals those files are not the primary judge-facing path |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7 | Add a compact workstation status ribbon showing data source and last sync | **Given** the header renders **When** snapshot state is known **Then** the shell shows `Synthetic NavPro` or `Live NavPro` and the latest sync time |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Clarity | No visible judge-path control may be inert | 0 dead clicks in manual shell audit |
| NFR-2 | Performance | Shell cleanup must not slow initial workstation render | No measurable regression beyond 100 ms local |
| NFR-3 | Accessibility | Keyboard focus remains visible for all retained shell controls | WCAG AA visible focus on interactive elements |

## 5. Design Direction

> **Design system: custom Tailwind workstation components**
> For detailed implementation: no separate design skill required.

### Page Structure
The route remains `/` via [`src/app/page.tsx`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/app/page.tsx). The page keeps the three-column workstation layout already implemented in `DispatchWorkstation`.

### Components
- **Primary:** `DispatchWorkstation`, `RailButton`, `TopNavButton`, stage tabs, workstation status pills
- **Actions:** refresh button, stage navigation, dispatch CTA, monitoring CTA
- **Forms:** load-intake textarea only
- **Feedback:** inline status chips and inline message banners already used by the workstation

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | Snapshot or monitor feed still loading | existing shell labels with `syncing` text, no fake values |
| Empty | No active interventions or no parsed load yet | inline neutral card with next-step CTA |
| Populated | Workstation has live data | current workstation panels |
| Error | Snapshot or monitor fetch failed | inline error banner in panel column |
| Gated | Not used in demo build | none |

### Responsive
- **Mobile (< 768px):** stack the workstation sections vertically and hide non-essential shell chrome
- **Desktop (> 1024px):** keep the current rail + panel + map layout and resizable left panel

### Key Interactions
1. User lands on `/` and sees only implemented workflow controls.
2. Clicking shell navigation switches `activeStage` and updates the URL query.
3. Clicking refresh calls `refreshAll(true)`.
4. No visible control leads to a dead end or decorative no-op.

## 6. Data Model

### Schema Changes
No Prisma schema changes are required for this PRD.

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
| None | None | None | Shell cleanup is client-first |

### Modified Actions
None.

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| None | None |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Snapshot load failure | `/api/fleet/snapshot` request rejects | "Unable to load fleet snapshot." | Keep current shell, show retry via Refresh | `surface='shell', action='snapshot_load', status='error'` |
| Monitor feed failure | `/api/monitor/feed` request rejects | "Unable to load monitoring feed." | Keep current shell, retry on next poll or refresh | `surface='shell', action='monitor_feed_load', status='error'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | Judge clicks a removed affordance from stale screenshots | Control no longer exists in the current shell | P0 |
| 2 | No snapshot yet | Show `syncing` labels, not fake numeric placeholders | P0 |
| 3 | Legacy routes like `/load-assignment` are used | Route still redirects into the workstation | P0 |
| 4 | Mobile width | Hide decorative chrome before shrinking core controls | P1 |

## 10. Dev Mode
- **Data:** existing synthetic NavPro and seeded load board remain the data source
- **Auth:** none
- **External services:** unchanged; this PRD does not add external dependencies

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Demo shell access | Full | Full |
| Judge-mode integrity | Full | Full |

**Upgrade trigger:** none for demo hardening; this is trust infrastructure.

## 12. AI Path
- **V1 (no AI):** shell behaves honestly regardless of AI availability
- **Future (AI):** status ribbon can show AI availability and fallback mode

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Remove dead chrome and fake copy | Manual shell audit passes | `ENABLE_DEMO_SHELL_INTEGRITY=true` |
| 2 | Add status ribbon and final polish | Judge rehearsal has no dead clicks | `ENABLE_DEMO_SHELL_INTEGRITY=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| Legacy mock-data components confuse engineers | Risk | Medium | Annotate or isolate them as non-authoritative |
| Team wants to keep decorative UI for realism | Risk | High | Default to removal unless behavior is implemented |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Dead-click count in judge path | Unknown, non-zero | 0 | Manual shell walkthrough |
| Visible fake/placeholder copy instances | At least 2 | 0 | String audit across workstation |
| Shell trust score in rehearsal | Subjective | “Feels real” from internal review | Demo review notes |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | The workstation at `/` remains the only judge-facing surface | Current page routes already redirect there | More route cleanup work |
| A2 | Removing decorative chrome is acceptable | User explicitly asked to remove extra stuff like universal search | If product leadership wants fuller chrome, behaviors must be implemented instead |

## 17. Implementation Notes
- **Key files to modify:** [`src/components/workstation/dispatch-workstation.tsx`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/components/workstation/dispatch-workstation.tsx), [`src/app/layout.tsx`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/app/layout.tsx), [`src/lib/navigation/workstation.ts`](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/src/lib/navigation/workstation.ts)
- **Patterns to follow:** keep state local in `DispatchWorkstation`; keep routes thin and redirect-based
- **Testing:** manual click audit, `npm run typecheck`, `npm test`
- **Design enrichment:** not required
