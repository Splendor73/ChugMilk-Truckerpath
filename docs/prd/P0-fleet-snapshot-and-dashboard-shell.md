# PRD: Fleet Snapshot and Dashboard Shell

**Priority:** P0
**Initiative:** [00-co-dispatch-overview.md](./00-co-dispatch-overview.md)
**Date:** 2026-04-18
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_FLEET_SNAPSHOT`
**Revenue Impact:** TABLE_STAKES

---

## 1. Summary
Implement the first user-visible version of Co-Dispatch: the dashboard shell, morning brief, map shell, queued load shell, and fleet snapshot API. This PRD gives the app a real page layout and real fleet data flow, while keeping advanced scoring and backhaul behavior out of scope. The result should look like the product, load live or mocked fleet data, and establish the page model used by later PRDs.

## 2. Problem & Vision
**Problem:** The dispatcher needs one place to understand who is ready, who is at risk, and where the fleet is right now. Without this shell, later dispatch and intervention workflows have nowhere coherent to live.
**Vision:** On page load, the dashboard renders a three-panel layout with a top bar, morning brief, queued loads area, map centered on Phoenix, and a right-side copilot placeholder. The fleet snapshot endpoint returns a typed `FleetSnapshot` matching `docs/contracts.ts`.
**Why this priority:** Dispatch, backhaul, monitoring, and the copilot all depend on the fleet snapshot contract and dashboard shell.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As Maria, I want the dashboard to show a fleet morning brief on page load so I know who is ready without texting drivers | **Given** the dashboard loads **When** `/api/fleet/snapshot` succeeds **Then** the left panel shows `morningBrief.headline` verbatim |
| US-2 | As Maria, I want to see the fleet on a live map so I can trust the system is using actual locations | **Given** snapshot data includes drivers **When** the center panel renders **Then** the map shows one pin per driver colored by `hosStatus` |
| US-3 | As an engineer, I want the snapshot route to own data synthesis so downstream UI and copilot code consume one stable shape | **Given** NavPro or mock responses **When** `GET /api/fleet/snapshot` is called **Then** it returns a fully formed `FleetSnapshot` object |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As Maria, I want to see compliance hints below the morning brief so I can spot problem drivers early | **Given** drivers contain compliance flags **When** the left panel renders **Then** a compact flag row appears under the headline |

### Out of Scope
- Driver ranking cards with live scores
- Dispatch creation
- Backhaul modal
- Monitoring-triggered UI alerts

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Create the dashboard route group at `src/app/(dashboard)` | **Given** a browser visit to `/` **When** the dashboard loads **Then** the app renders from `src/app/(dashboard)/page.tsx` and `layout.tsx` |
| FR-2 | Implement `GET /api/fleet/snapshot` as a thin route delegating to a fleet server use-case | **Given** a request to `/api/fleet/snapshot` **When** the route executes **Then** the route handler only parses request, calls the fleet use-case, validates output, and returns JSON |
| FR-3 | Synthesize HOS status using the thresholds from `docs/contracts.ts` | **Given** `hosRemainingMin` **When** the fleet service computes `hosStatus` **Then** values are `fresh` for `>= 360`, `low` for `< 360 and >= 120`, and `must_rest` for `< 120` |
| FR-4 | Compute the morning brief headline using the exact README format | **Given** a synthesized snapshot **When** headline text is produced **Then** it matches `"{readyCount} drivers ready to run, {restSoonCount} need rest within 2 hours, {complianceFlagCount} have compliance flags, {inMaintenanceCount} truck(s) in maintenance."` |
| FR-5 | Create dashboard panels for load inbox shell, fleet map, and copilot shell | **Given** the dashboard page **When** it renders **Then** the left panel shows the load inbox shell, center shows the map, and right shows the copilot placeholder |
| FR-6 | Use Mapbox in the center panel and color pins by `hosStatus` | **Given** driver snapshot data **When** the map renders **Then** `fresh` is accent/green, `low` is warn/yellow, and `must_rest` is critical/red |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7 | Render active trip polylines when `activeTrips` are present | **Given** snapshot data with active trips **When** the map renders **Then** each trip `plannedRoute` is drawn in accent color |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Performance | Initial dashboard snapshot fetch completes quickly enough for the morning brief to feel immediate | < 1500 ms on local mock mode |
| NFR-2 | Reliability | Snapshot output always validates against the shared contract schema | 100% zod validation before response |
| NFR-3 | Accessibility | Morning brief and flags remain readable in dark theme | WCAG AA contrast for text blocks |

## 5. Design Direction

> **Design system: shadcn/ui + Tailwind CSS**
> For detailed implementation: invoke `/interface-design` with this section.

### Page Structure
- Route: `/`
- Layout: fixed top bar plus three-column body
- Width split:
  - left: 25%
  - center: 50%
  - right: 25%
- Top bar content:
  - product name `Co-Dispatch`
  - live clock
  - toggle placeholder for future Decision Log view

### Components
- **Primary:** `Card`, `ScrollArea`, `Separator`, `Badge`, `Tabs`, `Skeleton`
- **Actions:** passive in this PRD; no dispatch or modal CTA yet
- **Forms:** load inbox textarea and file-drop placeholder only
- **Feedback:** `Skeleton` for each panel, destructive `Alert` for fetch failure

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | Each panel holds its layout and shows panel-local skeletons | `Skeleton` |
| Empty | No drivers or no queued loads available | `Card` with “No fleet data available” or “No queued loads yet” |
| Populated | Snapshot loaded and map pins visible | `Card`, `ScrollArea`, map canvas |
| Error | Snapshot fetch fails | `Alert` destructive with retry button text `Retry snapshot` |
| Gated | None | None |

### Responsive
- **Mobile (< 768px):** show a full-screen message `Co-Dispatch is optimized for laptop dispatch workflows. Open on a wider screen.` and do not render the full dashboard
- **Desktop (> 1024px):** render the full three-panel layout

### Key Interactions
1. Page mounts and requests `/api/fleet/snapshot`.
2. Morning brief renders headline and compact flags.
3. Map renders driver pins and active routes.
4. Copilot shell shows placeholder messages until copilot PRD ships.

## 6. Data Model

### Schema Changes
No new tables beyond the foundation schema. This PRD reads fleet data and may mirror active trips into `ActiveTripMirror`.

### New Tables (if any)
None.

### Existing Table Modifications (if any)
- `ActiveTripMirror` may require:
  - `plannedRouteJson`: JSON/text field storing serialized route points
  - `sourceUpdatedAt`: datetime from upstream fetch

### Migration Notes
If `plannedRouteJson` is added after foundation, make it nullable so snapshot can write partial trip data before route enrichment is present.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `getFleetSnapshot` | `src/features/fleet/server/get-fleet-snapshot.ts` | `() => Promise<FleetSnapshot>` | Assemble the fleet snapshot |
| `synthesizeDriver` | `src/features/fleet/server/synthesize-driver.ts` | `(upstream: NavProDriver, performance: NavProPerformance) => Driver` | Convert upstream data into contract shape |
| `buildMorningBrief` | `src/features/fleet/server/build-morning-brief.ts` | `(snapshot: Omit<FleetSnapshot, 'morningBrief'>) => FleetSnapshot['morningBrief']` | Create headline and counts |

### Modified Actions
None.

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| Snapshot refresh | revalidate tag `fleet-snapshot` after any assignment or simulate action in later PRDs |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Snapshot fetch failed | `/api/fleet/snapshot` returns 5xx | "Fleet snapshot unavailable. Retrying..." | Auto-retry once, then show error panel with retry button | `area='fleet', action='snapshot', status='error'` |
| Map token missing | `NEXT_PUBLIC_MAPBOX_TOKEN` absent | "Map unavailable. Check Mapbox configuration." | Keep center panel mounted with error card | `area='map', status='missing_token'` |
| Upstream NavPro partial failure | some driver performance calls fail | "Some driver details are delayed. Showing latest available fleet view." | Return degraded snapshot with missing drivers omitted and log count | `area='fleet', action='partial_snapshot', status='degraded'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | 0 drivers returned | Morning brief shows `0 drivers ready to run...`; map shows empty-state card | P0 |
| 2 | 1 driver only | Map centers on that driver and renders single pin | P0 |
| 3 | 15+ drivers clustered near Phoenix | Map uses default clustering only if readable; otherwise offset overlapping pins | P1 |
| 4 | Driver missing location timestamp | Exclude from map, keep in snapshot list only if required later | P0 |

## 10. Dev Mode
- **Data:** when `USE_NAVPRO_MOCK=true`, the fleet service reads seeded drivers and trips from local mock fixtures
- **Auth:** none
- **External services:** NavPro calls bypassed in mock mode; Mapbox still uses public token if available

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Fleet dashboard shell | Full access | Full access |

**Upgrade trigger:** None in hackathon scope.

## 12. AI Path
- **V1 (no AI):** static snapshot-driven dashboard
- **Future (AI):** copilot uses snapshot as tool input and decision log summarizes snapshot state changes

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Mock fleet snapshot + shell | Dashboard renders from local mock mode | `ENABLE_FLEET_SNAPSHOT=true`, `USE_NAVPRO_MOCK=true` |
| 2 | Real NavPro-backed snapshot | Snapshot endpoint returns real drivers and trips | `ENABLE_FLEET_SNAPSHOT=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| NavPro driver and performance endpoints | Blocker | High | Implement mock mode first |
| Mapbox token | Risk | Medium | Graceful center-panel fallback |
| Upstream route shape ambiguity | Risk | Medium | Store raw route JSON in mirror table before normalizing |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Morning brief render success | 0% | 100% of dashboard loads | browser smoke test |
| Snapshot contract validity | 0% | 100% valid payloads | integration test |
| Fleet map visibility | 0 | 15 seeded pins visible in demo mode | smoke scenario |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | Dashboard remains laptop-first | README explicitly excludes mobile layout as a product goal | Responsive design effort increases if this changes |
| A2 | `ActiveTrip.plannedRoute` can be sourced or synthesized from NavPro responses | Required by shared contract | Map may need stub routes initially if upstream shape is incomplete |
| A3 | The morning brief headline is rendered verbatim from server output | README requires verbatim rendering | Client formatting logic would need to be introduced if this changes |

## 17. Implementation Notes
- **Key files to modify:** `src/app/(dashboard)/*`, `src/app/api/fleet/snapshot/route.ts`, `src/features/fleet/**`, `src/features/shared-ui/**`
- **Patterns to follow:** wire shapes from `docs/contracts.ts`; wording and headline format from `README.md`
- **Testing:** unit test HOS threshold mapping; integration test snapshot output validation; smoke test morning brief and map rendering
- **Design enrichment:** invoke `/interface-design` with Section 5 before final UI implementation
