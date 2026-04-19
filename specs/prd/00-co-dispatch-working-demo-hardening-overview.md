# Initiative: Co-Dispatch Working Demo Hardening

**Source Brief:** [specs/briefs/co-dispatch-working-demo-hardening.md](../briefs/co-dispatch-working-demo-hardening.md)
**Date:** 2026-04-19
**PRDs:** 5

## Current Repo Reality
- The current repo is a partial implementation, not a docs-only package. Core evidence: `src/app/page.tsx`, `src/components/workstation/dispatch-workstation.tsx`, API routes under `src/app/api/`, and Prisma persistence in `prisma/schema.prisma`.
- `npm run typecheck` and `npm test` pass, so the baseline is stable enough for implementation work.
- The main product path already lives on `/` and redirects stage-specific routes back into the workstation.
- Trust breakers remain: older PRDs that assume a docs-only repo, unused mock-data UI infrastructure, unwired chrome, and copy that admits parts of the experience are “fake.”

## Feature Map
| Priority | PRD File | Feature | Dependencies |
|----------|----------|---------|-------------|
| P0 | [P0-demo-shell-integrity.md](./P0-demo-shell-integrity.md) | Collapse the user-visible product onto one honest workstation surface | None |
| P0 | [P0-stateful-demo-data-loop.md](./P0-stateful-demo-data-loop.md) | Persist every decision and workflow mutation through repositories and reloads | Demo shell integrity |
| P0 | [P0-map-and-scenario-sync.md](./P0-map-and-scenario-sync.md) | Make the map and scenario engine follow the active workflow and selected evidence | Stateful demo data loop |
| P1 | [P1-dispatch-backhaul-proof.md](./P1-dispatch-backhaul-proof.md) | Turn ranking and backhaul economics into provenance-backed proof instead of demo theater | P0 complete |
| P1 | [P1-monitoring-voice-closure.md](./P1-monitoring-voice-closure.md) | Finish the intervention loop from trigger to voice playback to execution and log proof | P0 complete |

## Implementation Order
1. **P0-demo-shell-integrity.md**
2. **P0-stateful-demo-data-loop.md**
3. **P0-map-and-scenario-sync.md**
4. **P1-dispatch-backhaul-proof.md**
5. **P1-monitoring-voice-closure.md**

## Shared Decisions
- The workstation at `/` is the only judge-facing source of truth.
- Synthetic data is allowed only if it is realistic, database-backed where applicable, and routed through the same APIs as live mode.
- The map is part of the proof layer and must update with stage, selection, and intervention context.
- The 2026-04-18 docs-only blueprint PRDs are historical context only and should not drive current implementation.

## Design Enrichment Needed
| PRD | Skill to Invoke | Reason |
|-----|----------------|--------|
| None | None | The current repo already establishes the visual direction; this initiative is primarily interaction and credibility hardening |
