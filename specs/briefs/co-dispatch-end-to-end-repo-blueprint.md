# Product Brief: Co-Dispatch End-to-End Repo Blueprint

**Date:** 2026-04-18
**Status:** Ready for PRD
**Author:** Product Manager Agent

---

## Vision
Turn this repo from a docs-only hackathon planning package into the actual Co-Dispatch application. Ship the same four demo-critical workflows from the README, but organize implementation as a domain-first Next.js codebase with thin route handlers, isolated business logic, split contracts, and testable feature modules.

## Problem
The current repo contains planning docs, contracts, and kickoff prompts, but no application code. The original build plan assumes a fast hackathon implementation with coarse file ownership. That is good for coordination, but weak for maintainability. The next step is to preserve the same product scope while restructuring execution into a repo shape a proper software engineer can build, test, and extend.

## Validation

### Feasibility
| Check | Result | Notes |
|-------|--------|-------|
| Tech stack supports it | ✅ | README already fixes Next.js 14, TypeScript, Prisma, SQLite, Mapbox, Groq, Gemini, ElevenLabs |
| Data model supports it | ✅ | `docs/contracts.ts` defines the shared domain model; Prisma models are already implied in README |
| No conflicts with existing | ✅ | Repo is docs-only today, so there is no implementation to migrate |
| Dependencies available | ⚠️ | Implementation depends on external API keys and NavPro access from `docs/KEYS.md` |

### Market Fit
- **User demand signal:** The README and PDF both frame Maria's day around triage, assignment, backhaul, and in-transit intervention.
- **Competitive gap:** The product differentiator remains explainable dispatch plus backhaul pairing at decision time.
- **Revenue potential:** `CONVERT`, `EXPAND`, `TABLE_STAKES`

## User Segments
| Segment | Pain Level | Benefit |
|---------|-----------|---------|
| Small-fleet dispatcher | 🔴 | Faster daily triage and fewer wrong dispatch decisions |
| Fleet owner / operator | 🔴 | Lower deadhead cost and higher truck utilization |
| Demo judge / buyer proxy | 🟡 | Sees a coherent, explainable workflow instead of a generic chatbot |

## Feature Decomposition

### P0 — Core (Must Have)
| Feature | Description | Tier | Revenue Impact | Dependencies |
|---------|-------------|------|---------------|-------------|
| Foundation and shared platform | Scaffold `src/`, config, contracts, repositories, env, test harness | Both | TABLE_STAKES | None |
| Fleet snapshot and dashboard shell | Real fleet snapshot endpoint and initial dashboard layout | Both | TABLE_STAKES | Foundation |
| Dispatch ranking and assignment | Parse load, score drivers, create assignment, render explainable ranking | Both | CONVERT | Fleet snapshot |

### P1 — Enhanced (Should Have)
| Feature | Description | Tier | Revenue Impact | Dependencies |
|---------|-------------|------|---------------|-------------|
| Backhaul pairing | Search corridor return loads and compare one-way vs round-trip economics | Both | EXPAND | Dispatch ranking |
| Copilot orchestration | Stream tool-driven agent responses and expose scoring/backhaul APIs | Both | RETAIN | Fleet, dispatch, backhaul |

### P2 — Polish (Nice to Have)
| Feature | Description | Tier | Revenue Impact | Dependencies |
|---------|-------------|------|---------------|-------------|
| Monitoring and voice intervention | Detect trip risk, draft interventions, and play voice alerts | Both | EXPAND | Fleet, dispatch, copilot |
| Decision log and dashboard polish | Capture decision history, closer metrics, and final demo polish | Both | RETAIN | All prior features |

### P3 — Future (Not Now)
| Feature | Description | Why Not Now |
|---------|-------------|-------------|
| Auth and multi-user management | Real account system, roles, and settings | Explicitly out of scope in README |
| Driver mobile app | New mobile surface for drivers | NavPro mobile already exists |
| Invoicing workflow | Auto-invoice or paperwork automation | Explicit non-goal for this initiative |

## Implementation Sequence
1. **Foundation and shared platform**
2. **Fleet snapshot and dashboard shell**
3. **Dispatch ranking and assignment**
4. **Backhaul pairing**
5. **Copilot orchestration**
6. **Monitoring and voice intervention**
7. **Decision log and dashboard polish**

## Key Decisions Made
| Decision | Choice | Rationale | Alternatives Considered |
|----------|--------|-----------|----------------------|
| Repo home | Same repo | Current repo already contains canonical docs and contracts | Separate implementation repo |
| Repo structure | Domain-first | Easier to maintain than strict A/B/C file silos | Flat `lib/` layout |
| API surface | Preserve README endpoints | Avoids changing the UI/integration contract | New REST surface |
| Contract strategy | Split internal files, preserve wire shapes | Better maintainability without product churn | Single giant contracts file |

## Design Direction
- **Design system:** shadcn/ui + Tailwind CSS, dark-only
- **Key UI patterns:** three-panel dashboard, dense ops cards, modal-driven backhaul flow, alert popover for intervention
- **Design skills needed:** `/interface-design` for dashboard shell, dispatch ranking, backhaul modal, and voice alert

## AI Enhancement Opportunities
| Feature | AI Angle | Tier (1=Analyze, 2=Suggest, 3=Automate) |
|---------|----------|----------------------------------------|
| Dispatch ranking | Explain the math and recommend best driver | 2 |
| Backhaul pairing | Recommend round-trip options after assignment scoring | 2 |
| Monitoring intervention | Draft remediation and approve execution | 3 |

## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| NavPro access delayed | Medium | High | Support `USE_NAVPRO_MOCK=true` dev mode from day one |
| Demo-critical UI looks weak | Medium | High | Separate dashboard polish PRD with explicit backhaul modal and decision log requirements |
| Voice API instability | Medium | Medium | Cached Act 3 fallback MP3 and button fallback for execute |

## Next Step
> Feed this brief into the PRD set in `specs/prd/`.
> Implementation order: foundation → fleet/dashboard → dispatch → backhaul → copilot → monitoring/voice → decision log/polish
