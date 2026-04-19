import { z } from "zod";

export const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number()
});

export const complianceFlagSchema = z.object({
  kind: z.enum(["inspection_expiring", "fatigue_pattern", "missed_inspection"]),
  severity: z.enum(["info", "warn", "critical"]),
  message: z.string()
});

export const driverPerformanceSummarySchema = z.object({
  actualMiles: z.number(),
  scheduleMiles: z.number(),
  oorMiles: z.number(),
  actualTimeMin: z.number(),
  scheduleTimeMin: z.number()
});

const tripStatusSchema = z.enum(["on_track", "route_deviation", "long_idle", "hos_risk", "eta_slip"]);

export const driverMarketSchema = coordinatesSchema.extend({
  city: z.string(),
  state: z.string(),
  label: z.string().optional()
});

export const loadStopSchema = coordinatesSchema.extend({
  city: z.string(),
  state: z.string()
});

export const driverTripSummarySchema = z.object({
  tripId: z.string(),
  loadId: z.string(),
  status: tripStatusSchema,
  origin: loadStopSchema.nullable(),
  destination: loadStopSchema.nullable(),
  etaMs: z.number().nullable(),
  routeContext: z.string(),
  remainingMiles: z.number().nullable()
});

export const driverSchema = z.object({
  driverId: z.number(),
  name: z.string(),
  phone: z.string(),
  homeBase: coordinatesSchema.extend({ city: z.string(), state: z.string().optional() }),
  currentLocation: coordinatesSchema.extend({ updatedAtMs: z.number() }),
  currentMarket: driverMarketSchema.optional(),
  hosRemainingMin: z.number(),
  hosStatus: z.enum(["fresh", "low", "must_rest"]),
  operationalStatus: z.enum(["available", "driving", "resting", "maintenance", "unknown"]).optional(),
  complianceFlags: z.array(complianceFlagSchema),
  performance: driverPerformanceSummarySchema.optional(),
  performanceScore: z.number().optional(),
  activeTripId: z.string().nullable(),
  activeTrip: driverTripSummarySchema.nullable().optional(),
  recentTrips: z.array(driverTripSummarySchema).optional()
});

export const loadSchema = z.object({
  loadId: z.string(),
  source: z.enum(["paste", "pdf", "broker_mock", "navpro"]),
  origin: loadStopSchema,
  destination: loadStopSchema,
  pickupStartMs: z.number(),
  pickupEndMs: z.number(),
  rateUsd: z.number(),
  weightLbs: z.number().optional(),
  commodity: z.string().optional(),
  customer: z.string().optional()
});

export const activeTripSchema = z.object({
  tripId: z.string(),
  driverId: z.number(),
  loadId: z.string(),
  currentLoc: coordinatesSchema,
  etaMs: z.number(),
  status: tripStatusSchema,
  plannedRoute: z.array(coordinatesSchema),
  origin: loadStopSchema.nullable().optional(),
  destination: loadStopSchema.nullable().optional(),
  routeContext: z.string().optional(),
  remainingMiles: z.number().nullable().optional()
});

export const fleetSnapshotSchema = z.object({
  fetchedAtMs: z.number(),
  drivers: z.array(driverSchema),
  activeTrips: z.array(activeTripSchema),
  pendingLoads: z.array(loadSchema),
  morningBrief: z.object({
    readyCount: z.number(),
    restSoonCount: z.number(),
    complianceFlagCount: z.number(),
    inMaintenanceCount: z.number(),
    headline: z.string()
  })
});

export const driverScoreSchema = z.object({
  driverId: z.number(),
  driverName: z.string(),
  score: z.number(),
  deadheadMiles: z.number(),
  hosCheck: z.object({
    requiredMin: z.number(),
    availableMin: z.number(),
    pass: z.boolean()
  }),
  fuelCostUsd: z.number(),
  etaConfidence: z.number(),
  rippleImpact: z.object({
    affectedLoads: z.number(),
    deltaUsd: z.number()
  }),
  rationale: z.string(),
  eliminated: z.boolean(),
  eliminationReason: z.string().optional()
});

export const showcaseDriverSignalsSchema = z.object({
  deadheadMiles: z.number(),
  etaBufferMin: z.number(),
  fuelEfficiencyMpg: z.number(),
  fuelCostUsd: z.number(),
  podOnTimeRate: z.number(),
  bolAccuracyRate: z.number(),
  eldComplianceScore: z.number(),
  eldViolationCount: z.number(),
  poiFuelStopMiles: z.number(),
  poiSafeParkingMiles: z.number(),
  poiRepairMiles: z.number(),
  poiCoverageScore: z.number(),
  driverPerformanceScore: z.number()
});

export const showcaseRankingBreakdownItemSchema = z.object({
  key: z.enum(["deadhead", "hos", "eta", "fuel", "performance", "poi", "pod", "bol", "eld"]),
  label: z.string(),
  rawValue: z.string(),
  contribution: z.number(),
  detail: z.string()
});

export const showcaseDriverRankingSchema = z.object({
  driverId: z.number(),
  driverName: z.string(),
  rank: z.number(),
  score: z.number(),
  recommended: z.boolean(),
  eliminated: z.boolean(),
  eliminationReason: z.string().optional(),
  summary: z.string(),
  signals: showcaseDriverSignalsSchema,
  breakdown: z.array(showcaseRankingBreakdownItemSchema)
});

export const advancedRankingShowcaseResponseSchema = z.object({
  load: loadSchema,
  explanation: z.string(),
  rankedDrivers: z.array(showcaseDriverRankingSchema)
});

export const backhaulOptionSchema = z.object({
  outbound: loadSchema,
  returnLoad: loadSchema,
  totalRevenueUsd: z.number(),
  totalDeadheadMiles: z.number(),
  roundTripProfitUsd: z.number(),
  oneWayProfitUsd: z.number(),
  hosFeasible: z.boolean(),
  narrative: z.string()
});

export const interventionDraftSchema = z.object({
  tripId: z.string(),
  trigger: z.enum(["route_deviation", "long_idle", "hos_risk", "eta_slip"]),
  customerSms: z.string(),
  relayDriverId: z.number().nullable(),
  relayDriverName: z.string().nullable(),
  relayDistanceMi: z.number().nullable(),
  rerouteNeeded: z.boolean(),
  voiceScript: z.string(),
  createdAtMs: z.number()
});

export const agentRequestSchema = z.object({
  userMessage: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional()
});

export const assignmentRequestSchema = z.object({
  driverId: z.number(),
  loadId: z.string(),
  returnLoadId: z.string().optional()
});

export const assignmentResponseSchema = z.object({
  tripId: z.string(),
  returnTripId: z.string().optional(),
  navProMode: z.enum(["synthetic", "live", "fallback"]),
  warnings: z.array(z.string()).optional()
});

export const agentScoreRequestSchema = z.object({
  load: loadSchema
});

export const agentBackhaulRequestSchema = z.object({
  outboundLoadId: z.string(),
  driverId: z.number()
});

export const monitorTickResponseSchema = z.object({
  interventionsCreated: z.number()
});

export const monitorDraftViewSchema = interventionDraftSchema.extend({
  id: z.string(),
  status: z.string(),
  audioSource: z.string().nullable().optional(),
  executedAtMs: z.number().nullable().optional(),
  matchedCommand: z.string().nullable().optional()
});

export const monitorFeedResponseSchema = z.object({
  drafts: z.array(monitorDraftViewSchema),
  decisionLog: z.array(
    z.object({
      id: z.string(),
      createdAtMs: z.number(),
      actionType: z.string(),
      summary: z.string(),
      mathSummary: z.string().optional(),
      outcome: z.string()
    })
  ),
  metrics: z.object({
    deadheadSavedMi: z.number(),
    revenueRecoveredUsd: z.number(),
    timeSavedMin: z.number()
  })
});

export const interventionExecuteRequestSchema = z.object({
  draftId: z.string(),
  matchedCommand: z.string().optional()
});

export const interventionExecuteResponseSchema = z.object({
  ok: z.literal(true),
  draftId: z.string()
});

export const devSimulateRequestSchema = z.object({
  tripId: z.string().optional(),
  scenario: z.enum(["breakdown", "route_deviation", "eta_slip"]).optional(),
  action: z.enum(["reset", "set_stage", "trigger_trip", "freeze"]).optional(),
  stage: z.enum(["morning_triage", "load_assignment", "backhaul_pairing", "in_transit_monitoring"]).optional(),
  freezeHeroValues: z.boolean().optional()
});

export const voiceSpeakRequestSchema = z.object({
  text: z.string().min(1),
  voiceId: z.string().optional(),
  draftId: z.string().optional()
});

export const voiceListenRequestSchema = z.object({
  audioBase64: z.string().min(1)
});

export const voiceListenResponseSchema = z.object({
  transcript: z.string(),
  matchedCommand: z.string().nullable()
});
