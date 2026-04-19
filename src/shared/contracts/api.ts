import type { AdvancedRankingShowcaseResponse, BackhaulOption, DriverScore, FleetSnapshot, Load } from "@/shared/contracts/domain";
import type { InterventionDraft } from "@/shared/contracts/domain";

export interface FleetAssignmentRequest {
  driverId: number;
  loadId: string;
  returnLoadId?: string;
}

export interface FleetAssignmentResponse {
  tripId: string;
  returnTripId?: string;
  navProMode: "synthetic" | "live" | "fallback";
  warnings?: string[];
}

export interface DevSimulateRequest {
  tripId?: string;
  scenario?: "breakdown" | "route_deviation" | "eta_slip";
  action?: "reset" | "set_stage" | "trigger_trip" | "freeze";
  stage?: "morning_triage" | "load_assignment" | "backhaul_pairing" | "in_transit_monitoring";
  freezeHeroValues?: boolean;
}

export interface DevSimulateResponse {
  ok: true;
}

export interface AgentRequest {
  userMessage: string;
  context?: Record<string, unknown>;
}

export interface AgentScoreRequest {
  load: Load;
}

export interface AgentBackhaulRequest {
  outboundLoadId: string;
  driverId: number;
}

export interface MonitorTickResponse {
  interventionsCreated: number;
}

export interface MonitorDraftView extends InterventionDraft {
  id: string;
  status: string;
  audioSource?: string | null;
  executedAtMs?: number | null;
  matchedCommand?: string | null;
}

export interface MonitorFeedResponse {
  drafts: MonitorDraftView[];
  decisionLog: DecisionLogViewModel[];
  metrics: DecisionMetrics;
}

export interface InterventionExecuteRequest {
  draftId: string;
  matchedCommand?: string;
}

export interface InterventionExecuteResponse {
  ok: true;
  draftId: string;
}

export interface VoiceSpeakRequest {
  text: string;
  voiceId?: string;
  draftId?: string;
}

export interface VoiceListenRequest {
  audioBase64: string;
}

export interface VoiceListenResponse {
  transcript: string;
  matchedCommand: string | null;
}

export interface DecisionMetrics {
  deadheadSavedMi: number;
  revenueRecoveredUsd: number;
  timeSavedMin: number;
}

export interface DecisionLogViewModel {
  id: string;
  createdAtMs: number;
  actionType: string;
  summary: string;
  mathSummary?: string;
  outcome: string;
}

export type AgentScoreResponse = DriverScore[];
export type AgentBackhaulResponse = BackhaulOption[];
export type FleetSnapshotResponse = FleetSnapshot;
export type DemoAdvancedRankingResponse = AdvancedRankingShowcaseResponse;
