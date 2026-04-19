# Co-Dispatch Frontend Design

**Date:** 2026-04-18
**Status:** Approved for planning
**Source Inputs:**
- Figma design: `https://www.figma.com/design/JGHloDAGNvku9xlmkrk9Uf/Untitled?node-id=0-1&m=dev&t=br1c1uZXZ1XHOoE4-1`
- Product brief: [specs/briefs/co-dispatch-end-to-end-repo-blueprint.md](/Users/anishk/Documents/coding_docs/TruckerPath-hack/specs/briefs/co-dispatch-end-to-end-repo-blueprint.md)
- PRDs: [P2-monitoring-and-voice-intervention.md](/Users/anishk/Documents/coding_docs/TruckerPath-hack/specs/prd/P2-monitoring-and-voice-intervention.md), [P2-dashboard-polish-and-decision-log.md](/Users/anishk/Documents/coding_docs/TruckerPath-hack/specs/prd/P2-dashboard-polish-and-decision-log.md)

## Goal
Build a high-fidelity frontend application for Co-Dispatch that reproduces the Figma design across the full app shell and the four workflow screens, while using realistic mock data and interactive transitions where backend functionality does not yet exist.

## Scope

### In Scope
- Full light-theme application shell from the Figma file
- Four workflow screens:
  - Morning Triage
  - Load Assignment
  - Backhaul Pairing
  - Proactive Monitoring
- Shared navigation and route transitions between screens
- Shared mocked state so the flows feel connected
- Reusable UI component system derived from the repeated Figma patterns
- Figma-faithful layout, spacing, hierarchy, and color treatment, with minor normalization where the source is irregular

### Out of Scope
- Real backend integration
- Real authentication
- Production-grade data persistence
- Full decision log screen
- Perfect one-to-one reproduction of every Figma implementation quirk when it hurts maintainability

## Product Shape
The frontend should behave like a real product, not a screen gallery. The user lands inside a persistent shell with a sidebar and top app bar. Moving between workflows should preserve shell context and selected mock state so the app feels continuous.

The shell is the backbone of the experience:
- Left sidebar with brand block, primary CTA, workflow navigation, support/settings links, and dispatcher profile footer
- Top app bar with section title, search input, primary tabs, alerts/history actions, export action, go-live button, and avatar
- Main content area that swaps the active workflow while keeping the shell fixed

## Screen Inventory

### 1. Morning Triage
Purpose:
- Present a high-level fleet readiness dashboard at 7:00 AM
- Establish the overview state before dispatch decisions

Primary content:
- Page title and subtitle
- Top metrics cards
- Fleet map panel
- Driver roster or readiness list
- Supplemental summary panels from the Figma screen

### 2. Load Assignment
Purpose:
- Show a load awaiting dispatch
- Present ranked driver recommendations and score explanation

Primary content:
- Route header with load metadata and revenue/margin summary
- Driver ranking list
- AI score math panel
- Mini map / route preview
- Bottom action bar with cancel and assign actions

### 3. Backhaul Pairing
Purpose:
- Compare one-way vs optimized round-trip economics
- Show why pairing a return load improves margin

Primary content:
- Page header and route context
- Two-card comparison between standard trip and optimized trip
- Value delta and profit emphasis
- Optional marketplace/upgrade panel from the Figma file
- Action treatment that keeps the screen feeling decision-oriented

### 4. Proactive Monitoring
Purpose:
- Surface in-transit risk and intervention recommendations
- Match the Act 3 product moment described in the PRD

Primary content:
- Main monitoring map / route canvas
- Intervention package card
- Customer communication draft
- Relay or contingency recommendation
- Monitoring status and urgency treatments

## Architecture
Use a route-based frontend structure with a persistent application shell and route-level workflow screens.

Recommended structure:
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/morning-triage/page.tsx`
- `src/app/load-assignment/page.tsx`
- `src/app/backhaul-pairing/page.tsx`
- `src/app/proactive-monitoring/page.tsx`
- `src/components/app-shell/*`
- `src/components/screens/*`
- `src/components/ui/*`
- `src/lib/mock-data/*`
- `src/lib/navigation/*`

Why route-based:
- Keeps each screen isolated and readable
- Makes shared shell composition straightforward
- Allows deep links for each workflow
- Matches the user’s request for a full frontend rather than a single-screen prototype

## State Model
Use mocked shared state that can be read by all screens. This does not need a backend, but it should make the product feel connected.

Shared state should cover:
- Current dispatcher profile
- Selected load
- Recommended driver list
- Currently assigned driver
- Selected backhaul option
- Monitoring incident state
- Notification count

Expected interactions:
- Sidebar changes the current workflow route
- `Dispatch New Load` routes into the load assignment workflow
- Assigning a driver updates the shared mock state
- Backhaul pairing reflects the assigned or recommended load/driver context
- Monitoring can display an active intervention scenario from mock state

Implementation note:
- A simple client-side store or context is enough for the first pass
- The state model should be structured for straightforward replacement with real server data

## Component Model

### Shell Components
- `AppShell`
- `Sidebar`
- `BrandBlock`
- `SidebarNav`
- `SidebarFooter`
- `TopBar`
- `TopBarSearch`
- `TopBarTabs`
- `TopBarActions`

### Shared Content Components
- `PageHeader`
- `MetricCard`
- `PanelCard`
- `StatusPill`
- `PrimaryButton`
- `SecondaryButton`
- `Avatar`
- `UserListItem`
- `MapCard`
- `MiniRouteCard`
- `RouteBadge`

### Workflow Components
- `MorningTriageScreen`
- `LoadAssignmentScreen`
- `BackhaulPairingScreen`
- `ProactiveMonitoringScreen`
- `DriverRankCard`
- `ScoreBreakdownCard`
- `TripComparisonCard`
- `InterventionPackageCard`
- `CustomerCommCard`
- `ActionBar`

## Styling Rules
The frontend should follow the Figma file as the visual source of truth.

Visual rules:
- Light application background with subtle cool tint
- White cards with thin borders and soft shadows
- Blue primary accents for action, selection, and emphasis
- Slate text hierarchy with darker heading ink and softer secondary copy
- Rounded corners, especially 8px to 12px patterns
- Spacious but dense enterprise layout, not airy marketing spacing

Typography rules:
- Preserve the same hierarchy seen in Figma:
  - bold display page titles
  - medium/small metadata labels
  - strong numeric emphasis on scores and key metrics
- Use a single consistent font stack that approximates the Figma source if the exact web font is not already present

Normalization rules:
- Repeating spacing values may be consolidated into tokens
- Inconsistent widths/heights may be normalized into a clean grid when the visual difference is negligible
- Decorative details may be simplified if they do not materially change the look

## Fidelity Expectations
The implementation should be visually close enough that someone comparing the app and Figma side by side recognizes them as the same product.

Acceptable optimizations:
- Converting awkward one-off dimensions into reusable spacing units
- Replacing brittle absolute positioning with stable layout primitives
- Converting repeated Figma-generated wrapper layers into cleaner component markup
- Using mocked stand-ins where the Figma references image assets that are not stable long-term

Unacceptable drift:
- Changing the app to dark mode
- Replacing the enterprise shell with a generic dashboard template
- Removing key supporting panels from the Figma layouts
- Compressing the UI into a mobile-first or card-only layout

## PRD Alignment

### Monitoring and Voice Intervention
The proactive monitoring screen should visually support:
- urgency state
- intervention package presentation
- operator approval moment

Even if voice/audio is mocked for now, the UI should reserve the right surfaces for:
- intervention status
- customer communication content
- relay plan / reroute plan
- operator actions

### Dashboard Polish
Although the decision log screen is not in the referenced Figma file, the shell and screen transitions should still satisfy the polish goals from the PRD:
- stable shell
- no layout jumps
- intentional transitions
- presentation-ready experience

Decision log itself is deferred from this implementation unless a later design source is provided.

## Data Strategy
Mock data should be realistic and domain-shaped.

Recommended fixtures:
- Morning metrics and summary cards
- Driver roster with names, units, equipment, availability, and score values
- Load metadata including route, pickup window, revenue, and weight
- Backhaul economics values
- Monitoring incident package with urgency, message drafts, and relay recommendation

Mock data should live in dedicated modules and not be embedded directly inside component files.

## Verification Strategy
Frontend verification should include:
- local app boot
- route-by-route visual inspection
- screenshot comparison against the Figma screens
- responsive sanity check for laptop widths used in the design
- interaction checks:
  - sidebar navigation
  - dispatch CTA
  - assignment flow
  - backhaul state transition
  - monitoring state display

## Risks
- The repo has no existing app scaffold, so the frontend build includes setup work
- Figma-generated structure is verbose and must be normalized carefully
- The Figma file does not include a decision log screen, so P2 coverage is partial by design
- Asset URLs from Figma MCP are temporary and should not be depended on as permanent production assets

## Decisions
- Build a real app shell, not disconnected mockups
- Use route-driven screens with shared mock state
- Implement the 4 Figma workflow screens only
- Defer decision log until a matching design source exists
- Optimize irregular design details only when they improve maintainability without changing the visual result
