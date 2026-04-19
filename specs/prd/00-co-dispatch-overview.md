# Initiative: Co-Dispatch End-to-End Repo Blueprint

**Source Brief:** [specs/briefs/co-dispatch-end-to-end-repo-blueprint.md](../briefs/co-dispatch-end-to-end-repo-blueprint.md)
**Date:** 2026-04-18
**PRDs:** 7

## Current Repo Reality
- The repo currently contains planning docs only: `README.md`, `docs/contracts.ts`, kickoff docs, and keys/progress docs.
- There is no app scaffold, no `src/`, no `prisma/`, no tests, and no package manifest yet.
- `README.md` and `docs/contracts.ts` are the source of truth for feature scope and public wire shapes.

## Feature Map
| Priority | PRD File | Feature | Dependencies |
|----------|----------|---------|-------------|
| P0 | [P0-foundation-and-shared-platform.md](./P0-foundation-and-shared-platform.md) | App scaffold, shared contracts, config, repositories, test harness | None |
| P0 | [P0-fleet-snapshot-and-dashboard-shell.md](./P0-fleet-snapshot-and-dashboard-shell.md) | Dashboard shell, fleet snapshot, load inbox shell, map shell | Foundation |
| P0 | [P0-dispatch-ranking-and-assignment.md](./P0-dispatch-ranking-and-assignment.md) | Load parsing, driver scoring, assignment creation, ranking UX | Fleet/dashboard |
| P1 | [P1-backhaul-pairing.md](./P1-backhaul-pairing.md) | Return load search, backhaul economics, modal flow | Dispatch |
| P1 | [P1-copilot-orchestration.md](./P1-copilot-orchestration.md) | Agent streaming, tool orchestration, copilot pane | Fleet, dispatch, backhaul |
| P2 | [P2-monitoring-and-voice-intervention.md](./P2-monitoring-and-voice-intervention.md) | Monitoring tick, intervention drafts, voice speak/listen | Fleet, dispatch, copilot |
| P2 | [P2-dashboard-polish-and-decision-log.md](./P2-dashboard-polish-and-decision-log.md) | Decision log, demo polish, closer metrics, backup states | All prior PRDs |

## Implementation Order
1. **P0-foundation-and-shared-platform.md**
2. **P0-fleet-snapshot-and-dashboard-shell.md**
3. **P0-dispatch-ranking-and-assignment.md**
4. **P1-backhaul-pairing.md**
5. **P1-copilot-orchestration.md**
6. **P2-monitoring-and-voice-intervention.md**
7. **P2-dashboard-polish-and-decision-log.md**

## Shared Decisions
- Preserve the public API surface from `README.md` Section 5.
- Preserve the domain shapes from `docs/contracts.ts`, but split them internally under `src/shared/contracts/`.
- Use a domain-first structure under `src/features/`, with route handlers only delegating into feature server modules.
- Keep demo constraints from `README.md`: no auth, no light mode, no mobile-first workflow, no generic chatbot, no invoicing.

## Design Enrichment Needed
| PRD | Skill to Invoke | Reason |
|-----|----------------|--------|
| P0-fleet-snapshot-and-dashboard-shell.md | `/interface-design` | New dashboard shell and information layout |
| P0-dispatch-ranking-and-assignment.md | `/interface-design` | Ranking grid, explainable cards, assignment CTA flow |
| P1-backhaul-pairing.md | `/interface-design` | Hero modal and two-map profit comparison flow |
| P2-monitoring-and-voice-intervention.md | `/interface-design` | Voice alert overlay and intervention UX |
| P2-dashboard-polish-and-decision-log.md | `/interface-design` | Decision log closer and final polish states |
