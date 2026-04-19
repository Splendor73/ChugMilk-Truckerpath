# PRD: Copilot Orchestration

**Priority:** P1
**Initiative:** [00-co-dispatch-overview.md](./00-co-dispatch-overview.md)
**Date:** 2026-04-18
**Status:** Ready for Implementation
**Tier:** Both
**Feature Flag:** `ENABLE_COPILOT_STREAM`
**Revenue Impact:** RETAIN

---

## 1. Summary
Implement the streaming AI copilot that orchestrates fleet snapshot, scoring, backhaul lookup, and intervention drafting through a fixed five-tool model. This PRD covers `POST /api/agent`, the tool loop, event streaming, the right-side copilot pane, and the rule that the LLM formats reasoning but does not invent or calculate operational numbers.

## 2. Problem & Vision
**Problem:** Without orchestration, the app is a collection of point endpoints and UI panels. The product promise is a co-dispatcher that explains its work and drives decisions, not a silent calculator.
**Vision:** The right panel streams short assistant messages and visible tool activity chips while the user works. The agent can show fleet state, parse loads, score assignments, fetch backhauls, and later draft interventions, all through the documented tool surface.
**Why this priority:** This is the glue layer that turns independent workflows into a cohesive product story.

## 3. User Stories

### Must Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As Maria, I want the copilot to stream its response as it works so the app feels alive and transparent | **Given** a copilot request **When** `/api/agent` runs **Then** the UI receives streamed `token`, `tool_call`, `tool_result`, and `final` events |
| US-2 | As Maria, I want the copilot to show which tools it is calling so I trust where the answer comes from | **Given** a tool-enabled response **When** the agent chooses a tool **Then** the UI renders a chip like `running: score_assignment` before the result arrives |
| US-3 | As a judge, I want the copilot to cite math, not vibes, so the ranking remains explainable | **Given** the agent recommends an assignment **When** it composes the final message **Then** the text references deadhead miles, HOS, and dollar impact from tool outputs |

### Should Have
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-4 | As Maria, I want the agent to refuse off-topic questions so the product stays focused | **Given** an off-domain user message **When** the agent responds **Then** it refuses briefly and does not call tools unnecessarily |

### Out of Scope
- Open-ended chatbot behavior outside dispatch workflows
- Adding tools beyond the five fixed tools from `docs/contracts.ts`

## 4. Requirements

### Functional (P0)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-1 | Implement `callLLM` with Groq primary and Gemini fallback | **Given** a tool-enabled or plain completion request **When** Groq returns 429 or 5xx **Then** the adapter retries once with Gemini and records `model: "gemini"` in the response metadata |
| FR-2 | Implement the fixed five-tool registry | **Given** the copilot runtime **When** it initializes **Then** only `get_fleet_snapshot`, `score_assignment`, `find_backhauls`, `monitor_trips`, and `draft_intervention` are registered |
| FR-3 | Implement `POST /api/agent` as SSE | **Given** `{userMessage, context?}` **When** the route is called **Then** it emits a valid SSE stream of `AgentStreamEvent` payloads |
| FR-4 | Preserve the locked system prompt behavior from README | **Given** any agent request **When** the model is invoked **Then** the system prompt enforces dispatch-only scope, math citation, no invented data, brief replies, and backhaul after assignment |
| FR-5 | Render the right-panel copilot stream in the dashboard | **Given** streamed events **When** the panel receives them **Then** tokens append to assistant text and tool activity chips render inline |

### Functional (P1)
| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-6 | End assignment recommendations with backhaul setup language | **Given** a dispatch recommendation **When** the final response is produced **Then** it ends with `shall I dispatch {top driver}? I'm also pulling backhaul options` or the same meaning with driver name substituted |

### Non-Functional
| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-1 | UX | First streamed token should arrive quickly | first event in < 1000 ms in demo mode |
| NFR-2 | Observability | Every tool call and result is visible in stream events | 100% of tool invocations emit paired events |
| NFR-3 | Safety | No unsupported tool names or off-topic capabilities | tool registry hard-coded and validated |

## 5. Design Direction

> **Design system: shadcn/ui + Tailwind CSS**
> For detailed implementation: invoke `/interface-design` with this section.

### Page Structure
- Rightmost dashboard panel dedicated to copilot
- Static message history with newest message near bottom
- Tool activity chips embedded between assistant/user messages

### Components
- **Primary:** `Card`, `ScrollArea`, `Badge`, `Separator`, `Skeleton`
- **Actions:** message submit input is optional in v1; panel can be system-driven from other workflows
- **Forms:** simple text input if exposed
- **Feedback:** streaming cursor, tool chips, error alert

### States
| State | Description | Component |
|-------|------------|-----------|
| Loading | awaiting first token | message skeleton + chip placeholders |
| Empty | no conversation yet | empty-state card `Ask Co-Dispatch about a load or fleet status` |
| Populated | streamed events visible | scrollable transcript |
| Error | stream broke or endpoint failed | destructive `Alert` with `Retry copilot` |
| Gated | None | None |

### Responsive
- **Mobile (< 768px):** unsupported-screen message inherited from dashboard shell
- **Desktop (> 1024px):** fixed-width right column with sticky transcript area

### Key Interactions
1. User submits or triggers a copilot request.
2. Tool chips appear as soon as tools are invoked.
3. Assistant text streams in.
4. Final recommendation remains concise and cites math.

## 6. Data Model

### Schema Changes
No new database tables are required for the streaming runtime in v1.

### New Tables (if any)
None.

### Existing Table Modifications (if any)
Optional for observability:
- `DecisionLog`
  - add `source`: string nullable (`copilot`, `ui`, `monitor`)

### Migration Notes
If `source` is added, default older rows to null.

## 7. Server Actions & API

### New Actions
| Action | Location | Signature | Purpose |
|--------|----------|-----------|---------|
| `callLLM` | `src/features/copilot/server/call-llm.ts` | `(messages: LLMMessage[], tools?: LLMTool[], opts?: { stream?: boolean; model?: "groq" | "gemini" }) => Promise<LLMResponse>` | Model adapter |
| `runCopilot` | `src/features/copilot/server/run-copilot.ts` | `(input: { userMessage: string; context?: Record<string, unknown> }) => AsyncGenerator<AgentStreamEvent>` | Tool loop and stream emitter |

### Modified Actions
| Action | Location | Change |
|--------|----------|--------|
| `scoreLoad` | `src/features/dispatch/server/score-load.ts` | Expose as tool-compatible use-case |
| `findBackhauls` | `src/features/backhaul/server/find-backhauls.ts` | Expose as tool-compatible use-case |

### Cache Invalidation
| Mutation | Tags/Paths |
|----------|------------|
| Copilot stream | none; read-only |

## 8. Error Handling
| Scenario | Condition | Toast | Recovery | Telemetry |
|----------|-----------|-------|----------|-----------|
| Stream setup failed | SSE route fails before first event | "Copilot unavailable. Try again." | Allow re-submit | `area='copilot', action='stream', status='error'` |
| Tool execution failed | a tool throws during run | "Copilot hit a tool error. Showing what succeeded so far." | Emit `error` event and keep transcript intact | `area='copilot', action='tool', status='error'` |
| LLM fallback engaged | Groq fails and Gemini takes over | None to user | Log fallback and include model in dev telemetry | `area='copilot', action='llm_fallback', status='ok'` |

## 9. Edge Cases
| # | Case | Behavior | Priority |
|---|------|----------|----------|
| 1 | Tool returns empty list | Agent says data is unavailable and does not invent values | P0 |
| 2 | User asks off-topic question | Agent refuses briefly without tool calls | P0 |
| 3 | Stream disconnects mid-response | UI shows partial transcript and retry action | P1 |

## 10. Dev Mode
- **Data:** use mock mode outputs from fleet, dispatch, and backhaul features
- **Auth:** none
- **External services:** allow a no-LLM test mode that emits deterministic stream fixtures for UI development

## 11. Monetization
| Capability | Free | Pro |
|-----------|------|-----|
| Copilot orchestration | Full access | Full access |

**Upgrade trigger:** None in hackathon scope.

## 12. AI Path
- **V1 (no AI):** deterministic canned orchestration for smoke tests
- **Future (AI):** stronger multi-step reasoning, richer structured parsing, and more nuanced intervention planning

## 13. Rollout
| Phase | Scope | Gate | Flag |
|-------|-------|------|------|
| 1 | Mock SSE and tool chips | UI renders full event lifecycle with fixtures | `ENABLE_COPILOT_STREAM=true`, `USE_NAVPRO_MOCK=true` |
| 2 | Real model-backed orchestration | Groq primary and Gemini fallback verified | `ENABLE_COPILOT_STREAM=true` |

## 14. Dependencies & Risks
| Item | Type | Impact | Mitigation |
|------|------|--------|------------|
| LLM key availability | Blocker | High | Support fixture stream mode for UI work |
| Streaming complexity | Risk | Medium | Keep route thin and isolate stream generator |
| Over-chatty assistant | Risk | Medium | Enforce max-4-sentence system prompt rule |

## 15. Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Stream lifecycle completeness | 0% | 100% | integration test over SSE |
| First event latency | 0 | < 1 second in demo mode | smoke timing |
| Off-topic refusal correctness | 0 | 100% | unit test prompt harness |

## 16. Assumptions
| # | Assumption | Rationale | Impact if Wrong |
|---|-----------|-----------|----------------|
| A1 | Copilot UI can share state with dispatch and backhaul flows instead of owning them | Aligns with domain-first structure | More duplicated fetch logic if not true |
| A2 | The five-tool model remains fixed | Locked in docs/contracts and README | Contract changes ripple across UI and routes |
| A3 | SSE is sufficient; websockets remain out of scope | README explicitly excludes real-time websockets | Transport changes would affect API design |

## 17. Implementation Notes
- **Key files to modify:** `src/app/api/agent/route.ts`, `src/features/copilot/**`, right-panel UI in `src/features/copilot/components/**`
- **Patterns to follow:** system prompt and tool list from README Phase 1/2; event union from `docs/contracts.ts`
- **Testing:** unit tests for fallback behavior; integration tests for SSE event order; manual smoke with `curl -N`
- **Design enrichment:** invoke `/interface-design` with Section 5
