// shared/contracts.ts
// ============================================================================
// FROZEN after Phase 1 — any change requires explicit human approval in chat.
// All three agents (A=Data, B=Brain, C=Face) must code against these types.
// Do not add fields without announcing a "contract change" to all three agents.
// ============================================================================

// ============ Core domain types ============

export type HOSStatus = "fresh" | "low" | "must_rest";
// Thresholds (min of 11-hr drive, 14-hr on-duty, 70-hr/8-day — take the min):
//   fresh     >= 360 min
//   low       <  360 & >= 120
//   must_rest <  120

export interface Driver {
  driverId: number;
  name: string;
  phone: string;
  homeBase: { lat: number; lng: number; city: string };
  currentLocation: { lat: number; lng: number; updatedAtMs: number };
  hosRemainingMin: number;
  hosStatus: HOSStatus;
  complianceFlags: ComplianceFlag[];
  activeTripId: string | null;
}

export interface ComplianceFlag {
  kind: "inspection_expiring" | "fatigue_pattern" | "missed_inspection";
  severity: "info" | "warn" | "critical";
  message: string; // one human-readable line, UI renders verbatim
}

export interface Load {
  loadId: string; // "TL-00042" mock, NavPro load_id for real
  source: "paste" | "pdf" | "broker_mock" | "navpro";
  origin: { lat: number; lng: number; city: string; state: string };
  destination: { lat: number; lng: number; city: string; state: string };
  pickupStartMs: number;
  pickupEndMs: number;
  rateUsd: number;
  weightLbs?: number;
  commodity?: string;
  customer?: string;
}

// ============ Fleet snapshot (A produces, B + C consume) ============

export interface FleetSnapshot {
  fetchedAtMs: number;
  drivers: Driver[];
  activeTrips: ActiveTrip[];
  pendingLoads: Load[];
  morningBrief: {
    readyCount: number;
    restSoonCount: number;
    complianceFlagCount: number;
    inMaintenanceCount: number;
    headline: string; // UI renders verbatim
  };
}

export interface ActiveTrip {
  tripId: string; // NavPro trip_id
  driverId: number;
  loadId: string;
  currentLoc: { lat: number; lng: number };
  etaMs: number;
  status: "on_track" | "route_deviation" | "long_idle" | "hos_risk" | "eta_slip";
  plannedRoute: Array<{ lat: number; lng: number }>;
}

// ============ Scoring (B produces, C consumes) ============

export interface DriverScore {
  driverId: number;
  driverName: string;
  score: number; // 0..100 higher is better
  deadheadMiles: number;
  hosCheck: { requiredMin: number; availableMin: number; pass: boolean };
  fuelCostUsd: number;
  etaConfidence: number; // 0..1
  rippleImpact: { affectedLoads: number; deltaUsd: number };
  rationale: string; // 2-sentence prose from LLM (numbers already computed)
  eliminated: boolean; // true if HOS/compliance hard-fails
  eliminationReason?: string; // e.g. "HOS: needs 11.5 hours, has 4 hours"
}

// ============ Backhaul (B produces, C consumes) ============

export interface BackhaulOption {
  outbound: Load;
  returnLoad: Load;
  totalRevenueUsd: number;
  totalDeadheadMiles: number;
  roundTripProfitUsd: number;
  oneWayProfitUsd: number; // for the comparison bar
  hosFeasible: boolean;
  narrative: string; // e.g. "SFO → Vegas → Phoenix, 85 total deadhead miles"
}

// ============ Intervention for Act 3 (B produces, C consumes) ============

export interface InterventionDraft {
  tripId: string;
  trigger: "route_deviation" | "long_idle" | "hos_risk" | "eta_slip";
  customerSms: string;
  relayDriverId: number | null;
  relayDriverName: string | null;
  relayDistanceMi: number | null;
  rerouteNeeded: boolean;
  voiceScript: string; // verbatim ElevenLabs TTS input
  createdAtMs: number;
}

// ============ Agent streaming events (B produces, C consumes) ============

export type AgentTool =
  | "get_fleet_snapshot"
  | "score_assignment"
  | "find_backhauls"
  | "monitor_trips"
  | "draft_intervention";

export type AgentStreamEvent =
  | { type: "token"; payload: { text: string } }
  | { type: "tool_call"; payload: { tool: AgentTool; args: unknown } }
  | { type: "tool_result"; payload: { tool: AgentTool; result: unknown } }
  | { type: "final"; payload: { text: string; parsedLoad?: Load; scores?: DriverScore[]; backhauls?: BackhaulOption[] } }
  | { type: "error"; payload: { message: string } };

// ============ LLM adapter types (B internal, but typed for reuse) ============

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface LLMTool {
  name: AgentTool;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{ id: string; name: AgentTool; args: unknown }>;
  model: "groq" | "gemini";
  usage?: { promptTokens: number; completionTokens: number };
}
