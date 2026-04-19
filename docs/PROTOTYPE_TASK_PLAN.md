# Co-Dispatch Prototype Task Plan

> Reset on 2026-04-19 from clean `main` branch copy.
> Constraint for this pass: preserve the existing NavPro-style shell because it already matches the original platform better than the refactor.
> Execution rule: implement incrementally, test after each slice, then mark only the finished items done.

---

## Status Legend

- DONE = implemented and verified in this branch
- PARTIAL = some behavior exists but the full flow is not complete
- MISSING = not built yet

---

## Current State Summary

| Layer | Status |
|-------|--------|
| **Backend API routes** | DONE - all required endpoints already exist on `main` |
| **Backend scoring / dispatch / monitoring logic** | DONE - core service layer exists |
| **UI shell / visual direction** | DONE - existing workstation already matches the original NavPro-like platform shape |
| **Shared client state** | PARTIAL - monolithic local state works, but cross-panel sync is not yet organized cleanly |
| **Driver info desk parity** | PARTIAL - morning triage exists, but not as a complete searchable driver desk |
| **Fleet map parity** | PARTIAL - map exists, but hover/select/route-preview behavior needs tightening |
| **AI dispatch parity** | PARTIAL - load parsing and ranking exist, but explanation, compare, and interaction gaps remain |
| **Monitoring + voice alert parity** | PARTIAL - monitor drawer exists, but execution/edit flows and richer alert UX are incomplete |
| **Decision log / polish / cleanup** | PARTIAL - some operational feedback exists, but prototype cleanup and doc discipline are incomplete |

---

## Implementation Slices

### Slice 1: Preserve Shell, Organize State, Remove Confusion

**Goal:** Keep the current UI shell and make the old experience easier to extend without replacing the platform look.

- [x] Keep the current top bar, rail, stage tabs, and map-heavy shell as the baseline
- [x] Reduce repeated or confusing duplicate UI copy inside the existing shell
- [ ] Extract only the state/helpers needed for cleaner cross-panel sync without changing the visible product shape
- [x] Keep operator/demo hooks hidden or low-visibility so the main flow stays clear
- [ ] Add regression coverage for preserved shell rendering and stage navigation

**Status:** PARTIAL

### Slice 2: Driver Info Desk Inside Existing Morning/Fleet UI

**Goal:** Upgrade the left-side experience without replacing the existing platform structure.

- [x] Add a real driver desk view using the current fleet snapshot data
- [x] Add live search across driver name, city, and lane context
- [x] Add clear status chips for Available / On Route / Resting / Off Duty
- [x] Show driver rows with name, status, HOS, current city, and destination/ETA when active
- [x] Open a detail drawer/panel from the existing UI when a driver is selected
- [x] Sync hover and selection with the map
- [ ] Add tests for search, filter, hover, and drawer behavior

**Status:** PARTIAL

### Slice 3: Fleet Map Sync and Route Clarity

**Goal:** Tighten the existing map behavior so it mirrors dispatcher actions better while keeping the current visual shell.

- [x] Highlight hovered drivers and selected drivers consistently on the map
- [x] Pan/zoom to the selected driver from driver list and ranking interactions
- [x] Show active route emphasis more clearly
- [x] Add deadhead preview from ranking metrics
- [x] Keep outbound and backhaul routes visible after dispatch decisions
- [ ] Add or improve the active-routes strip below/around the current map area
- [x] Add tests for map presentation outputs and route persistence

**Status:** PARTIAL

### Slice 4: AI Dispatch Flow in the Existing Dispatch Stage

**Goal:** Finish the core copilot and dispatch flow without replacing the stage-based dispatch screen.

- [x] Keep `/api/agent` streaming visible in the dispatch lane
- [x] Improve the parsed load card and ranking grid readability
- [ ] Finish score explanation parity, including scoring-math details
- [ ] Wire metric clicks to map previews where useful
- [ ] Add compare-top-3 behavior
- [x] Add a dispatch confirmation step before final assignment
- [x] Refresh the driver desk, map, and decision feedback after dispatch
- [ ] Auto-start backhaul lookup with visible corridor-search feedback
- [ ] Add tests for streaming, ranking, dispatch confirmation, and backhaul kickoff

**Status:** PARTIAL

### Slice 5: Monitoring, Voice Alert, and Backhaul Completion

**Goal:** Finish the intervention and round-trip flows while preserving the existing monitoring stage and modal surfaces.

- [ ] Improve live alert presentation with better voice alert behavior and fallback audio
- [x] Add Execute, Edit SMS, and Dismiss actions to the monitoring alert flow
- [x] Wire execute to `/api/monitor/interventions/execute`
- [x] Keep backhaul suggestions integrated with the dispatch flow and round-trip confirmation
- [x] Improve round-trip profit comparison clarity
- [x] Keep outbound and return route context visible together after booking
- [ ] Add tests for monitoring polling, alert behavior, execute wiring, and round-trip persistence

**Status:** PARTIAL

### Slice 6: Final Cleanup and Demo Readiness

**Goal:** Ship a coherent prototype on top of the original-looking UI.

- [x] Remove leftover confusing or repeated content introduced by partial flows
- [x] Re-run `npm test`
- [x] Re-run `npm run typecheck`
- [x] Re-run `npm run build`
- [x] Mark only the completed tasks with `*` / checked boxes so remaining work is obvious

**Status:** PARTIAL
