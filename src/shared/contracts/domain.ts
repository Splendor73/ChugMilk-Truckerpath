export type HOSStatus = "fresh" | "low" | "must_rest";
export type TripStatus = "on_track" | "route_deviation" | "long_idle" | "hos_risk" | "eta_slip";

export const routeDeskStatusOptions: ReadonlyArray<{ value: TripStatus; label: string }> = [
  { value: "on_track", label: "On track" },
  { value: "eta_slip", label: "ETA slip" },
  { value: "route_deviation", label: "Route deviation" },
  { value: "long_idle", label: "Long idle" },
  { value: "hos_risk", label: "HOS risk" }
] as const;

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

export type DriverOperationalStatus =
  | "available"
  | "driving"
  | "resting"
  | "maintenance"
  | "unknown";

export interface DriverMarket extends Coordinates {
  city: string;
  state: string;
  label?: string;
}

export interface DriverTripSummary {
  tripId: string;
  loadId: string;
  status: TripStatus;
  origin: LoadStop | null;
  destination: LoadStop | null;
  etaMs: number | null;
  routeContext: string;
  remainingMiles: number | null;
}

export interface Driver {
  driverId: number;
  name: string;
  phone: string;
  homeBase: Coordinates & { city: string; state?: string };
  currentLocation: DriverLocation;
  currentMarket?: DriverMarket;
  hosRemainingMin: number;
  hosStatus: HOSStatus;
  operationalStatus?: DriverOperationalStatus;
  complianceFlags: ComplianceFlag[];
  performance?: DriverPerformanceSummary;
  performanceScore?: number;
  activeTripId: string | null;
  activeTrip?: DriverTripSummary | null;
  recentTrips?: DriverTripSummary[];
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
  status: TripStatus;
  plannedRoute: Coordinates[];
  origin?: LoadStop | null;
  destination?: LoadStop | null;
  routeContext?: string;
  remainingMiles?: number | null;
}

export interface RouteDeskItem {
  tripId: string;
  driverId: number;
  loadId: string;
  status: ActiveTrip["status"];
  etaMs: number;
  currentLoc: Coordinates;
  plannedRoute: Coordinates[];
  routePointCount: number;
  lastSeenAtMs: number;
  sourceUpdatedAtMs: number | null;
  scenarioOverride?: string | null;
  overrideReason?: string | null;
  origin?: LoadStop | null;
  destination?: LoadStop | null;
  routeContext: string;
  remainingMiles?: number | null;
  customer?: string | null;
  commodity?: string | null;
  rateUsd?: number | null;
  pickupStartMs?: number | null;
  pickupEndMs?: number | null;
}

export interface RouteDeskResponse {
  routes: RouteDeskItem[];
}

export interface RouteDeskCreateRequest {
  driverId: number;
  loadId: string;
  status?: ActiveTrip["status"];
}

export interface FleetSnapshot {
  fetchedAtMs: number;
  sourceMode: "live" | "synthetic";
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
