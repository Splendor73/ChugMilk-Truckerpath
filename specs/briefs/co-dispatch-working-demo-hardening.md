# Product Brief: Co-Dispatch Working Demo Hardening

**Date:** 2026-04-19
**Status:** Ready for PRD
**Author:** Product Manager Agent

---

## Vision
Ship Co-Dispatch as a judge-proof working demo, not a storyboard. The app should still tell the same four-part story from the Trucker Path deck, but every visible action on the dispatcher surface must be backed by live application state, persisted records, and map behavior that matches what the operator is looking at. When a judge clicks, refreshes, dispatches, triggers a breakdown, or approves a relay, the product must respond like a real system.

## Problem
The repo already contains a serious Next.js workstation, Prisma models, API routes, synthetic NavPro flows, and a live Mapbox surface. It also still carries traces of demo theater: stale PRDs that describe a docs-only repo, unused mock-data UI infrastructure, non-functional chrome like the universal search bar, copy that admits parts of the engine are “fake,” and workflow evidence that is not yet consistently persisted and replayable. A judge will not reward a good narrative if clicking around reveals disconnected state or decorative UI.

## Validation

### Feasibility
| Check | Result | Notes |
|-------|--------|-------|
| Tech stack supports it | ✅ | `src/app/page.tsx`, `src/components/workstation/dispatch-workstation.tsx`, `src/components/workstation/interactive-dispatch-map.tsx`, and the API routes already form a working shell |
| Data model supports it | ✅ | `prisma/schema.prisma` already contains `DecisionLog`, `LoadAssignment`, `ActiveTripMirror`, `InterventionDraft`, and showcase tables |
| No conflicts with existing | ⚠️ | Older docs and legacy mock-data UI code still describe a different product state and can mislead implementation |
| Dependencies available | ✅ | Synthetic NavPro fallback is built in via `src/server/integrations/navpro.ts`; tests and typecheck pass locally |

### Market Fit
- **User demand signal:** The user’s final brief and the Trucker Path framing both insist on “decisions, not dashboards” and on reducing cost per mile and downtime.
- **Competitive gap:** Most hackathon teams will stop at visualization; a stateful, explainable, end-to-end workflow surface is the differentiator.
- **Revenue potential:** `CONVERT`, `EXPAND`, `TABLE_STAKES`

## User Segments
| Segment | Pain Level | Benefit |
|---------|-----------|---------|
| Dispatcher Maria | 🔴 | Fewer calls, faster triage, explainable dispatch decisions, proactive exception handling |
| Fleet owner / judge | 🔴 | Trust that the product is buildable, not mocked, and visibly tied to cost-per-mile economics |
| Engineering team | 🟡 | One authoritative implementation plan that targets the current codebase instead of the superseded docs-only plan |

## Feature Decomposition

### P0 — Core (Must Have)
| Feature | Description | Tier | Revenue Impact | Dependencies |
|---------|-------------|------|---------------|-------------|
| Demo shell integrity | Collapse the visible product onto one authoritative workstation and remove unwired chrome or fake affordances | Both | TABLE_STAKES | None |
| Stateful workflow persistence | Ensure triage, assignment, backhaul, monitoring, and execution all write meaningful records and survive refresh | Both | TABLE_STAKES | Demo shell integrity |
| Map and scenario synchronization | Make the map, stage transitions, and scenario controls follow the operator’s current decision context | Both | CONVERT | Stateful workflow persistence |

### P1 — Enhanced (Should Have)
| Feature | Description | Tier | Revenue Impact | Dependencies |
|---------|-------------|------|---------------|-------------|
| Explainable dispatch and backhaul proof | Replace credibility-leaking language and hardcoded overrides with seeded, explainable operational evidence | Both | EXPAND | P0 complete |
| Monitoring and voice closure | Complete the loop from trip risk to drafted intervention to voice playback to execution and decision-log proof | Both | EXPAND | P0 complete |

### P2 — Polish (Nice to Have)
| Feature | Description | Tier | Revenue Impact | Dependencies |
|---------|-------------|------|---------------|-------------|
| Demo operator mode | Add clean reset/freeze/stage controls for rehearsals without exposing judge-facing debug clutter | Both | RETAIN | P1 complete |
| Evidence copy polish | Tighten all labels, helper text, and headings so nothing admits “fake” data or unfinished behavior | Both | TABLE_STAKES | P1 complete |

### P3 — Future (Not Now)
| Feature | Description | Why Not Now |
|---------|-------------|-------------|
| New driver mobile app | Separate driver experience | NavPro already owns the driver-side surface |
| Auth, settings, role management | Enterprise platform work | Hurts hackathon scope and does not improve demo credibility |
| Invoice automation | Fifth workflow expansion | Valuable later, but dilutes the four-moment narrative |

## Implementation Sequence
1. **Demo shell integrity** — remove visible trust breakers first
2. **Stateful workflow persistence** — make every operator action survive refresh and feed the evidence layer
3. **Map and scenario synchronization** — ensure the live map mirrors whatever story the operator is telling
4. **Explainable dispatch and backhaul proof** — make the economics and ranking evidence defensible
5. **Monitoring and voice closure** — finish the intervention loop and voice approval path

## Sellability & Unit Economics

### Conversion Potential
| Signal | Assessment | Evidence |
|--------|-----------|----------|
| Free -> Pro driver | ✅ | The judge-facing “aha” is visible operational leverage, not commodity CRUD |
| Trial “aha moment” | ✅ | One-click round-trip profit lift plus live intervention recovery are immediate value moments |
| VP Sales greenlight | ✅ | The product lines up with Trucker Path’s own deck language and marketplace expansion story |

### Unit Economics (per dispatcher seat/month, demo-stage assumption)
| Cost | Free Tier | Pro Tier | Notes |
|------|-----------|----------|-------|
| AI API tokens | Low | Medium | Only invoked on load analysis and intervention copy |
| External APIs | Low | Medium | Mapbox + optional voice; synthetic NavPro keeps dev/demo cheap |
| DB storage | Low | Low | SQLite now; later moves to hosted DB without changing product shape |
| Compute | Low | Medium | Polling and ranking are light relative to enterprise dispatch systems |
| **Total** | **Low** | **Medium** | The economics are favorable because the product is a decision layer, not a full TMS replacement |

### Paywall Decision
| Capability | Free | Pro | Rationale |
|-----------|------|-----|-----------|
| Morning brief | Limited fleet size | Full fleet size | Natural entry point without giving away the full value engine |
| Explainable dispatch ranking | 1 active recommendation | Full candidate table + counterfactuals | Strong conversion wedge |
| Backhaul pairing | Preview only | Bookable round-trip plan | Clear expansion lever |
| Proactive monitoring + voice | Email/UI alerts only | Voice escalation + execute approval | Premium automation behavior |

### Sellability Score
- **Conversion:** High
- **Retention:** High
- **Expansion:** High
- **Competitive moat:** Medium-high

## Key Decisions Made
| Decision | Choice | Rationale | Alternatives Considered |
|----------|--------|-----------|----------------------|
| Authoritative UI surface | Keep the single-page workstation at `/` | It already contains the most complete API-backed flow | Re-expanding the legacy screen system |
| Demo data strategy | Realistic seeded/synthetic data, persisted through Prisma | Meets the “nothing fake” requirement without needing full external coverage | Ad hoc hardcoded front-end arrays |
| Debug affordances | Keep them operator-only, not judge-facing | Judges punish visible scaffolding | Exposing reset/debug controls in the main chrome |
| Mapping behavior | Context-driven map that follows stage, selection, and intervention | The map is part of the proof, not decoration | Static hero map |

## Design Direction
- **Design system:** custom Tailwind workstation components, custom glyphs, and `InteractiveDispatchMap` over Mapbox GL
- **Key UI patterns:** single dispatcher workstation, left decision rail, live center map, bottom-sheet style intervention proof, compact economic evidence cards
- **Design skills needed:** none before implementation; the current code already establishes the visual language

## AI Enhancement Opportunities
| Feature | AI Angle | Tier (1=Analyze, 2=Suggest, 3=Automate) |
|---------|----------|----------------------------------------|
| Morning triage | Synthesize fleet status into an ordered brief | 1 |
| Dispatch ranking | Explain why a driver wins and why others fail | 2 |
| Backhaul pairing | Recommend the best round-trip option and quantify the delta | 2 |
| Intervention handling | Draft customer communication and approve execution | 3 |

## Open Questions Resolved
| Question | Answer | Rationale |
|----------|--------|-----------|
| Should we keep the extra global search bar and shell affordances? | No | Unwired chrome hurts credibility more than it helps realism |
| Is synthetic data acceptable? | Yes, if it is realistic, persisted, and behaves consistently through the system | The user explicitly allows realistic mock data with database logic |
| Should the map behave independently of the current workflow? | No | The map is part of the decision explanation and must track current context |

## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Demo path still leaks legacy/fake copy | Medium | High | Audit visible strings and remove admissions of “fake” or placeholder behavior |
| Backhaul proof still depends on one-off overrides | Medium | High | Move demo economics into seeded scenario data with provenance |
| Monitoring loop feels partial after refresh | Medium | High | Persist draft/execution state and reload from repositories only |
| Team implements against stale PRDs | High | Medium | Treat this brief and its linked PRDs as the authoritative implementation source |

## Next Step
> Feed this brief to **prd-architect** to produce the current-state implementation PRDs.
> Priority order: `P0-demo-shell-integrity` → `P0-stateful-demo-data-loop` → `P0-map-and-scenario-sync` → `P1-dispatch-backhaul-proof` → `P1-monitoring-voice-closure`
