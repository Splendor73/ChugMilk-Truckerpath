# Hackathon Demo Stabilization Plan

Last updated: April 18, 2026

## Goal

Ship one clean, believable 3-act demo that works 5/5 from a fresh page load:

1. Morning triage shows a real fleet snapshot and a clear operational story.
2. Load assignment ranks drivers with explainable math and dispatches the winner.
3. Backhaul + monitoring show the money shot and the intervention moment without breaking the flow.

This plan is intentionally biased toward demo reliability, visual clarity, and believable data over architectural purity.

## Current Truth

- The main workstation at `/` is the real demo surface.
- The synthetic NavPro backend is strong enough to support the story: Mike, Jake, Kevin, Sam, Sara, `TL-DEMO-01`, `TL-BH-01/02/03`, and `TRIP-ACT3`.
- The repo now builds successfully in demo mode.
- Legacy screen fixtures have been re-aligned to the same western-corridor story, but they are still a second data universe.
- `docs/navpro.json` is present, but the integration layer still uses partial `any`-typed wrappers and a few heuristic payloads.

## Demo North Star

If time gets tight, optimize only for these judge-visible moments:

1. Paste PHX -> SFO load, get Mike ranked first, show why Jake is eliminated.
2. Dispatch Mike and immediately show round-trip profit improvement via backhaul pairing.
3. Trigger Sam's Barstow breakdown and show the intervention package with Kevin as relay.

Everything else is secondary.

## P0 Must Fix Before Demo

### 1. Make `/` the only primary demo path

- Treat `src/components/workstation/dispatch-workstation.tsx` as the source of truth.
- Do not spend more time polishing legacy standalone screens unless they block the build.
- Make sure all presenter clicks for the demo happen inside the workstation flow.

Acceptance:

- Fresh load of `/` works without setup.
- Stage changes are obvious and stable.
- No presenter needs to navigate to a legacy page during the 3-minute demo.

### 2. Remove story drift between UI and backend

- Keep all demo names, IDs, and lanes aligned across synthetic backend, load parser, ranking, backhauls, and monitoring.
- Preserve these anchors exactly:
  - `TL-DEMO-01`
  - `TL-BH-01`, `TL-BH-02`, `TL-BH-03`
  - `TRIP-ACT3`
  - Mike Chen, Jake Morrison, Kevin Walsh, Sam Rodriguez, Sara Patel
- Any UI copy that references the mock layer should be reframed as live demo state or desk state.

Acceptance:

- The same names and IDs appear in the agent response, ranking cards, backhaul panel, and monitoring flow.
- No screen references unrelated regions or old fake personas.

### 3. Lock the assignment -> backhaul -> monitoring flow

- Ensure assignment success reliably opens or reveals the backhaul path.
- Ensure monitoring can be triggered deterministically every run.
- Ensure the intervention package always finds Kevin as the obvious relay choice.

Acceptance:

- One presenter can run the full flow without reloading or manually repairing app state.
- The result is the same on repeated runs.

### 4. Eliminate visible fake-app seams

- Replace copy like "shared mock store" with language that sounds like a real dispatch desk.
- Keep the synthetic mode internally, but avoid exposing that wording in judge-facing UI.
- Make status labels operational: "dispatch desk", "network state", "return lane activated", "intervention package ready".

Acceptance:

- The UI sounds like a product demo, not a prototype wired to local fixture objects.

## P1 High Value After P0

### 5. Make NavPro contract alignment real

- Refactor `src/server/integrations/navpro.ts` so `docs/navpro.json` is the contract source.
- Replace `any` responses with typed request/response interfaces for:
  - `queryDrivers`
  - `queryDriverPerformance`
  - `getDriverDispatch`
  - `queryTrips`
  - `createTrip`
  - `queryPOI`
  - `getRoutingProfiles`
- Remove heuristic request shape guessing where the OpenAPI spec is explicit.

Why it matters:

- This is the highest-confidence way to make synthetic data feel like the real app instead of a parallel fake API.

Acceptance:

- NavPro wrappers have typed envelopes and payloads.
- Synthetic providers return shapes that conform to the same types.

### 6. Collapse duplicate mock universes

- Stop growing `src/lib/mock-data/*`.
- Either:
  - derive those legacy screens from synthetic NavPro state, or
  - freeze them and clearly treat them as non-demo surfaces.
- Prefer one scenario engine over two.

Acceptance:

- One change to the demo story propagates everywhere.

### 7. Use POI and richer operational signals where they improve the story

- Bring `queryPOI()` into monitoring and scoring for believable stop, repair, or safe-parking context.
- Expand scoring only where it improves explainability in the demo:
  - HOS
  - deadhead
  - ETA window
  - fuel cost
  - driver performance
  - network impact
  - POI proximity

Do not add extra factors that cannot be explained in one sentence on stage.

## P2 Nice To Have If Time Remains

### 8. Demo polish

- Add a one-click "next scene" or deterministic stage advance for rehearsal.
- Add a small "reset demo" action that restores the synthetic scenario.
- Preload audio fallback and monitoring visuals earlier in the flow.
- Tighten copy so every panel supports the spoken demo script.

### 9. Rehearsal assets

- Add `DEMO_SCRIPT.md` with exact presenter words.
- Add `DEMO_CHECKLIST.md` for pre-demo smoke checks:
  - app boots
  - assignment works
  - backhaul computes
  - monitoring trigger works
  - audio fallback available
- Record the backup run once the flow is stable.

## Do Not Spend Time On

- Full production-grade refactors outside the demo path
- Broad UI redesigns that do not improve the 3 core moments
- New features not directly visible in the demo
- Deep data-model expansion for POD/BOL/ELD unless the judge-facing flow actually uses it
- Making every legacy screen perfect if the workstation flow already carries the demo

## Recommended Execution Order

1. Keep `/` as the canonical demo path and remove wording that exposes the mock layer.
2. Lock all names, IDs, and seeded outcomes across assignment, backhaul, and monitoring.
3. Add a deterministic demo reset/scene-control path.
4. Align NavPro wrappers with `docs/navpro.json`.
5. Collapse or freeze duplicate legacy mock data sources.
6. Add POI-backed realism only if the first 5 steps are stable.
7. Write the final script and rehearsal checklist.

## Definition of Done

The demo is ready when all of these are true:

- `npm run build` passes
- The workstation flow runs cleanly from a fresh load
- Mike wins the PHX -> SFO load and Jake is visibly eliminated with a grounded reason
- The best backhaul shows a meaningful round-trip profit jump
- Sam's breakdown produces a clean intervention package with Kevin as relay
- The presenter can finish the full flow in under 3 minutes without improvising around bugs

