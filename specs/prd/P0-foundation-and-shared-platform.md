# PRD: Foundation and Shared Platform

**Priority:** P0
**Initiative:** [00-co-dispatch-overview.md](./00-co-dispatch-overview.md)
**Date:** 2026-04-18
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_REPO_BLUEPRINT`
**Revenue Impact:** TABLE_STAKES

---

## 1. Summary
Create the actual application scaffold inside this repo so all later features have a stable home. This PRD covers the initial Next.js 14 app structure, shared contracts, env/config loaders, repository pattern, integration clients, Prisma schema bootstrap, and a baseline test harness. The goal is not user-visible value by itself; the goal is to remove ambiguity for every later feature PRD.

## 2. Problem & Vision
**Problem:** The repo currently has no runnable app, no package manifest, and no shared implementation structure. If engineering starts directly on endpoints or UI, file organization, contracts, and test patterns will fragment immediately.
**Vision:** After this ships, the repo is a runnable TypeScript app with stable folders, split contracts, explicit environment loading, database schema, repository interfaces, and test scaffolding that every later feature uses consistently.
**Why this priority:** All later PRDs depend on these directories, types, feature boundaries, and base services existing first.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As an engineer, I want a consistent folder structure so that feature code has an obvious home | **Given** a fresh checkout **When** I inspect the repo **Then** `src/app`, `src/features`, `src/server`, `src/shared`, `src/config`, `prisma`, `data`, `public`, and `tests` exist with the structure defined in the initiative overview |
| US-2 | As an engineer, I want split shared contracts so that wire types are reusable without a monolithic file | **Given** the codebase **When** I inspect `src/shared/contracts` **Then** `domain.ts`, `api.ts`, `events.ts`, `llm.ts`, and `index.ts` exist and re-export the shapes from `docs/contracts.ts` without changing public wire shape |
| US-3 | As an engineer, I want environment loading centralized so that feature code does not read `process.env` directly | **Given** a server feature module **When** it needs secrets or config **Then** it imports from `src/config/env.server.ts` or `src/config/env.client.ts` rather than reading raw env variables |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As an engineer, I want a shared repository pattern so route handlers do not talk to Prisma directly | **Given** a server use-case **When** it needs persistence **Then** it imports a repository from `src/server/repositories` |

### Out of Scope
- Building business-specific user-visible workflows
- Styling beyond what is required to boot the app
- External API integration logic beyond thin client shells and typed interfaces

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Create the Next.js app scaffold inside this repo using the `src/` convention | **Given** the repo root **When** the app is scaffolded **Then** application code lives under `src/` and docs remain under `docs/` |
| FR-2 | Create shared contract files that preserve current domain and API wire shapes | **Given** `docs/contracts.ts` **When** the split contracts are implemented **Then** every exported type in current use is present under `src/shared/contracts/index.ts` with the same field names and types |
| FR-3 | Create schema validation folders for shared and feature-local validation | **Given** an API route **When** it validates input or output **Then** it uses zod schemas from `src/shared/schemas` or `src/features/*/schemas` |
| FR-4 | Create `src/server/integrations` for NavPro, Groq, Gemini, ElevenLabs, and Mapbox-adjacent client helpers | **Given** a feature server module **When** it needs an external service **Then** it calls a typed adapter from `src/server/integrations` |
| FR-5 | Create a Prisma schema with `DecisionLog`, `LoadAssignment`, `ActiveTripMirror`, and `InterventionDraft` models | **Given** the schema file **When** Prisma is initialized **Then** those four models exist with fields sufficient for later PRDs |
| FR-6 | Create a test harness with unit, integration, and smoke folders | **Given** the repo **When** tests are added **Then** they can be placed in `tests/unit`, `tests/integration`, and `tests/smoke` |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-7 | Create developer seed/demo data locations for loads and demo scenarios | **Given** the repo **When** demo data is needed **Then** seeded loads live in `data/loads/seed.json` and scenario definitions live in `data/demo/scenarios.ts` |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | Maintainability | No route handler may contain business logic beyond parse/call/respond | 0 route files exceed 80 lines before later feature-specific logic |
| NFR-2 | Type Safety | Shared contracts and API schemas must type-check without `any` | `tsc --noEmit` passes |
| NFR-3 | Reliability | Env validation must fail fast on missing required secrets | App start aborts with explicit missing-key error on server boot |

## 5. Design Direction

> **Design system: shadcn/ui + Tailwind CSS**
> For detailed implementation: invoke `/interface-design` only after the dashboard PRDs are in play.

### Page Structure
This PRD only establishes the app shell. The root dashboard route will live at `src/app/(dashboard)/page.tsx` and later PRDs will populate it.

### Components
- **Primary:** minimal layout shell, loading placeholder, app-level provider wrapper
- **Feedback:** `Skeleton`, `Alert`

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | Route group loading before later features hydrate | `Skeleton` |
| Empty | No business panels yet; foundation only | `Card` with “Co-Dispatch setup complete” copy |
| Populated | Not applicable in this PRD | N/A |
| Error | Missing env or schema init issue | `Alert` destructive |
| Gated | Not applicable | None |

### Responsive
- **Mobile (< 768px):** show a minimal shell only
- **Desktop (> 1024px):** same minimal shell; later PRDs define the real layout

### Key Interactions
1. Engineer installs dependencies.
2. Engineer runs dev server and sees the shell load successfully.
3. Engineer imports contracts, repositories, and env helpers from stable locations.

## 6. Data Model

### Schema Changes
Create the initial Prisma schema in `prisma/schema.prisma`. Because the current repo has no DB yet, this is a first migration, not a modification.

### New Tables
- **DecisionLog**
  - `id`: string UUID primary key
  - `createdAt`: datetime default now
  - `actionType`: string
  - `summary`: string
  - `mathSummary`: string nullable
  - `outcome`: string
  - `tripId`: string nullable
  - `driverId`: integer nullable
  - index on `createdAt desc`
- **LoadAssignment**
  - `id`: string UUID primary key
  - `createdAt`: datetime default now
  - `driverId`: integer
  - `loadId`: string
  - `returnLoadId`: string nullable
  - `tripId`: string
  - `returnTripId`: string nullable
  - `status`: string default `created`
  - unique index on `tripId`
- **ActiveTripMirror**
  - `tripId`: string primary key
  - `driverId`: integer
  - `loadId`: string
  - `status`: string
  - `lastSeenAt`: datetime
  - `etaMs`: bigint
  - `currentLat`: float
  - `currentLng`: float
  - `scenarioOverride`: string nullable
- **InterventionDraft**
  - `id`: string UUID primary key
  - `createdAt`: datetime default now
  - `tripId`: string
  - `trigger`: string
  - `customerSms`: string
  - `relayDriverId`: integer nullable
  - `relayDriverName`: string nullable
  - `relayDistanceMi`: float nullable
  - `rerouteNeeded`: boolean
  - `voiceScript`: string
  - `executedAt`: datetime nullable
  - index on `tripId`, `createdAt desc`

### Existing Table Modifications
None. This is the first schema version.

### Migration Notes
Create an initial migration only. No backfill is required because there is no existing runtime data.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `getServerEnv` | `src/config/env.server.ts` | `() => ServerEnv` | Validate and expose server secrets |
| `getClientEnv` | `src/config/env.client.ts` | `() => ClientEnv` | Expose browser-safe config |
| `getDb` | `src/server/db/client.ts` | `() => PrismaClient` | Shared Prisma client |
| `createRepositories` | `src/server/repositories/index.ts` | `() => RepositoryRegistry` | Shared repository access |

### Modified Actions
None.

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| Initial scaffold | None |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Missing env | Required secret absent on boot | None; boot error page only | Abort app startup with explicit key list | `area='config', status='missing_env'` |
| Prisma init failure | DB unavailable or schema mismatch | "Database setup failed. Check migration status." | Keep shell visible with destructive alert and dev instructions in console | `area='db', status='init_failed'` |
| Contract/schema mismatch | zod parse fails inside internal smoke tests | "Contract validation failed. See console for details." | Fail the request in development and log offending payload | `area='schema', status='invalid_payload'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | Repo cloned without secrets | App boots only if non-secret shell path is allowed; feature routes fail fast with explicit errors | P0 |
| 2 | `USE_NAVPRO_MOCK=true` | Later integrations may use mock adapters; foundation must expose the flag | P0 |
| 3 | Tests run before migrations | Integration tests must fail with clear DB setup guidance | P0 |

## 10. Dev Mode
- **Data:** mock loads and scenario data live under `data/`
- **Auth:** none, per README non-goals
- **External services:** env-controlled mock mode through `USE_NAVPRO_MOCK` and later feature-specific test doubles

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Foundation/platform | Included | Included |

**Upgrade trigger:** None. This PRD is infrastructure only.

## 12. AI Path
- **V1 (no AI):** shared folders, schema, and adapters exist without invoking LLMs
- **Future (AI):** enables tool orchestration and rationale generation in later PRDs

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Scaffold only | App boots and type-checks | `ENABLE_REPO_BLUEPRINT=true` in development |
| 2 | Baseline shared platform complete | Prisma migration, tests, and imports stable | `ENABLE_REPO_BLUEPRINT=true` in all environments |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| Next.js 14 scaffold | Blocker | High | Create app before feature work |
| Prisma dependency setup | Blocker | High | Ship schema and client during this PRD |
| Missing package conventions | Risk | Medium | Define all top-level folders now |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| App boot success | 0% | 100% on local dev | `npm run dev` starts |
| Type safety | No code exists | 100% scaffold compiles | `tsc --noEmit` |
| Shared contract coverage | 1 monolithic docs file | 5 split contract files + barrel | file audit |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | This repo is becoming the real app repo | User-approved blueprint says same repo | File layout changes if separate repo is later chosen |
| A2 | shadcn/ui remains the UI system | README fixes stack choice | Shell component choices would change if the UI kit changes |
| A3 | Prisma + SQLite are acceptable for initial build | README fixes stack choice | Repository and migration strategy would change if DB changes |

## 17. Implementation Notes
- **Key files to modify:** create `package.json`, `src/**`, `prisma/schema.prisma`, `prisma/seed.ts`, `data/**`, `tests/**`
- **Patterns to follow:** preserve domain terms and wire shapes from `docs/contracts.ts`; preserve stack and non-goals from `README.md`
- **Testing:** add one unit test proving HOS helpers compile and one integration smoke proving env/config boot path works
- **Design enrichment:** not required for this PRD
