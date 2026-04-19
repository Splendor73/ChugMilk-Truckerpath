export type HOSStatus = "fresh" | "low" | "must_rest";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DriverLocation extends Coordinates {
  updatedAtMs: number;
}

export interface ComplianceFlag {
  kind: "inspection_expiring" | "fatigue_pattern" | "missed_inspection";
  severity: "info" | "warn" | "critical";
  message: string;
}

export interface DriverPerformanceSummary {
  actualMiles: number;
  scheduleMiles: number;
  oorMiles: number;
  actualTimeMin: number;
  scheduleTimeMin: number;
}

export interface Driver {
  driverId: number;
  name: string;
  phone: string;
  homeBase: Coordinates & { city: string };
  currentLocation: DriverLocation;
  hosRemainingMin: number;
  hosStatus: HOSStatus;
  complianceFlags: ComplianceFlag[];
  performance?: DriverPerformanceSummary;
  activeTripId: string | null;
}

export interface LoadStop extends Coordinates {
  city: string;
  state: string;
}

export interface Load {
  loadId: string;
  source: "paste" | "pdf" | "broker_mock" | "navpro";
  origin: LoadStop;
  destination: LoadStop;
  pickupStartMs: number;
  pickupEndMs: number;
  rateUsd: number;
  weightLbs?: number;
  commodity?: string;
  customer?: string;
}

export interface ActiveTrip {
  tripId: string;
  driverId: number;
  loadId: string;
  currentLoc: Coordinates;
  etaMs: number;
  status: "on_track" | "route_deviation" | "long_idle" | "hos_risk" | "eta_slip";
  plannedRoute: Coordinates[];
}

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
    headline: string;
  };
}

export interface DriverScore {
  driverId: number;
  driverName: string;
  score: number;
  deadheadMiles: number;
  hosCheck: { requiredMin: number; availableMin: number; pass: boolean };
  fuelCostUsd: number;
  etaConfidence: number;
  rippleImpact: { affectedLoads: number; deltaUsd: number };
  rationale: string;
  eliminated: boolean;
  eliminationReason?: string;
}

export interface ShowcaseDriverSignals {
  deadheadMiles: number;
  etaBufferMin: number;
  fuelEfficiencyMpg: number;
  fuelCostUsd: number;
  podOnTimeRate: number;
  bolAccuracyRate: number;
  eldComplianceScore: number;
  eldViolationCount: number;
  poiFuelStopMiles: number;
  poiSafeParkingMiles: number;
  poiRepairMiles: number;
  poiCoverageScore: number;
  driverPerformanceScore: number;
}

export interface ShowcaseDriverProfile {
  driverId: number;
  driverName: string;
  homeBase: string;
  currentMarket: string;
  hosRemainingMin: number;
  summary: string;
  signals: ShowcaseDriverSignals;
}

export interface ShowcaseRankingBreakdownItem {
  key:
    | "deadhead"
    | "hos"
    | "eta"
    | "fuel"
    | "performance"
    | "poi"
    | "pod"
    | "bol"
    | "eld";
  label: string;
  rawValue: string;
  contribution: number;
  detail: string;
}

export interface ShowcaseDriverRanking {
  driverId: number;
  driverName: string;
  rank: number;
  score: number;
  recommended: boolean;
  eliminated: boolean;
  eliminationReason?: string;
  summary: string;
  signals: ShowcaseDriverSignals;
  breakdown: ShowcaseRankingBreakdownItem[];
}

export interface AdvancedRankingShowcaseResponse {
  load: Load;
  explanation: string;
  rankedDrivers: ShowcaseDriverRanking[];
}

export interface BackhaulOption {
  outbound: Load;
  returnLoad: Load;
  totalRevenueUsd: number;
  totalDeadheadMiles: number;
  roundTripProfitUsd: number;
  oneWayProfitUsd: number;
  hosFeasible: boolean;
  narrative: string;
}

export interface InterventionDraft {
  tripId: string;
  trigger: "route_deviation" | "long_idle" | "hos_risk" | "eta_slip";
  customerSms: string;
  relayDriverId: number | null;
  relayDriverName: string | null;
  relayDistanceMi: number | null;
  rerouteNeeded: boolean;
  voiceScript: string;
  createdAtMs: number;
}
