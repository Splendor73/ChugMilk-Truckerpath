import type {
  AdvancedRankingShowcaseResponse,
  Load,
  ShowcaseDriverProfile,
  ShowcaseDriverRanking,
  ShowcaseRankingBreakdownItem
} from "@/shared/contracts";
import { advancedRankingShowcaseResponseSchema } from "@/shared/schemas/contracts";
import { getDb } from "@/server/db/client";
import { clamp } from "@/shared/utils/geo";

const SCENARIO_ID = "advanced-engine-showcase-v1";
const AVG_SPEED_MPH = 70;
const DIESEL_PRICE_PER_GALLON = 4.35;

type SeedDriverRecord = Omit<ShowcaseDriverProfile, "signals"> & {
  displayOrder: number;
  signals: ShowcaseDriverProfile["signals"];
};

const showcaseLoad: Load = {
  loadId: "TL-DEMO-01",
  source: "broker_mock",
  origin: { city: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.074 },
  destination: { city: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194 },
  pickupStartMs: Date.UTC(2026, 3, 19, 15, 0, 0),
  pickupEndMs: Date.UTC(2026, 3, 19, 18, 0, 0),
  rateUsd: 3200,
  weightLbs: 38000,
  commodity: "General Freight",
  customer: "Echo Global"
};

const showcaseSeedDrivers: SeedDriverRecord[] = [
  {
    displayOrder: 1,
    driverId: 101,
    driverName: "Mike Chen",
    homeBase: "Tempe, AZ",
    currentMarket: "Goodyear, AZ",
    hosRemainingMin: 720,
    summary: "Best overall fit. Local to pickup, clean ELD profile, strong paperwork reliability, and healthy POI coverage for the run.",
    signals: {
      deadheadMiles: 18,
      etaBufferMin: 165,
      fuelEfficiencyMpg: 7.2,
      fuelCostUsd: 404,
      podOnTimeRate: 0.98,
      bolAccuracyRate: 0.99,
      eldComplianceScore: 0.97,
      eldViolationCount: 0,
      poiFuelStopMiles: 11,
      poiSafeParkingMiles: 14,
      poiRepairMiles: 22,
      poiCoverageScore: 0.95,
      driverPerformanceScore: 94
    }
  },
  {
    displayOrder: 2,
    driverId: 103,
    driverName: "Kevin Walsh",
    homeBase: "Victorville, CA",
    currentMarket: "Victorville, CA",
    hosRemainingMin: 840,
    summary: "Operationally disciplined with strong docs and ELD data, but he is materially farther from the Phoenix pickup than Mike.",
    signals: {
      deadheadMiles: 268,
      etaBufferMin: 54,
      fuelEfficiencyMpg: 7.6,
      fuelCostUsd: 451,
      podOnTimeRate: 0.97,
      bolAccuracyRate: 0.98,
      eldComplianceScore: 0.96,
      eldViolationCount: 0,
      poiFuelStopMiles: 9,
      poiSafeParkingMiles: 18,
      poiRepairMiles: 12,
      poiCoverageScore: 0.93,
      driverPerformanceScore: 92
    }
  },
  {
    displayOrder: 3,
    driverId: 110,
    driverName: "Priya Nair",
    homeBase: "Ontario, CA",
    currentMarket: "Ontario, CA",
    hosRemainingMin: 900,
    summary: "Very clean docs and route discipline, but the repositioning drag from Southern California still makes her a second-tier match.",
    signals: {
      deadheadMiles: 315,
      etaBufferMin: 32,
      fuelEfficiencyMpg: 7.8,
      fuelCostUsd: 446,
      podOnTimeRate: 0.96,
      bolAccuracyRate: 0.97,
      eldComplianceScore: 0.95,
      eldViolationCount: 0,
      poiFuelStopMiles: 8,
      poiSafeParkingMiles: 16,
      poiRepairMiles: 10,
      poiCoverageScore: 0.94,
      driverPerformanceScore: 91
    }
  },
  {
    displayOrder: 4,
    driverId: 105,
    driverName: "Sara Patel",
    homeBase: "Phoenix, AZ",
    currentMarket: "Phoenix, AZ",
    hosRemainingMin: 105,
    summary: "Perfect market placement, but she is still recovering HOS and her ELD readiness keeps her as backup only.",
    signals: {
      deadheadMiles: 7,
      etaBufferMin: 175,
      fuelEfficiencyMpg: 7.1,
      fuelCostUsd: 409,
      podOnTimeRate: 0.95,
      bolAccuracyRate: 0.96,
      eldComplianceScore: 0.68,
      eldViolationCount: 1,
      poiFuelStopMiles: 12,
      poiSafeParkingMiles: 12,
      poiRepairMiles: 27,
      poiCoverageScore: 0.9,
      driverPerformanceScore: 84
    }
  },
  {
    displayOrder: 5,
    driverId: 102,
    driverName: "Jake Morrison",
    homeBase: "Flagstaff, AZ",
    currentMarket: "Flagstaff, AZ",
    hosRemainingMin: 240,
    summary: "Reasonable deadhead but he fails the run on legal drive time and cannot cover the outbound safely.",
    signals: {
      deadheadMiles: 144,
      etaBufferMin: 116,
      fuelEfficiencyMpg: 6.8,
      fuelCostUsd: 428,
      podOnTimeRate: 0.9,
      bolAccuracyRate: 0.93,
      eldComplianceScore: 0.86,
      eldViolationCount: 1,
      poiFuelStopMiles: 20,
      poiSafeParkingMiles: 24,
      poiRepairMiles: 32,
      poiCoverageScore: 0.74,
      driverPerformanceScore: 76
    }
  },
  {
    displayOrder: 6,
    driverId: 106,
    driverName: "Luis Ortega",
    homeBase: "Las Vegas, NV",
    currentMarket: "Las Vegas, NV",
    hosRemainingMin: 780,
    summary: "Legally feasible, but his paperwork quality, ELD risk, and weak POI support make him a poor showcase recommendation.",
    signals: {
      deadheadMiles: 297,
      etaBufferMin: 45,
      fuelEfficiencyMpg: 6.1,
      fuelCostUsd: 487,
      podOnTimeRate: 0.82,
      bolAccuracyRate: 0.84,
      eldComplianceScore: 0.58,
      eldViolationCount: 3,
      poiFuelStopMiles: 31,
      poiSafeParkingMiles: 38,
      poiRepairMiles: 46,
      poiCoverageScore: 0.45,
      driverPerformanceScore: 71
    }
  }
];

const weights = {
  deadhead: 18,
  hos: 18,
  eta: 14,
  fuel: 10,
  performance: 12,
  poi: 10,
  pod: 6,
  bol: 4,
  eld: 8
} as const;

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatHours(minutes: number) {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

function formatMoney(value: number) {
  return `$${Math.round(value)}`;
}

async function ensureScenarioSeeded() {
  const db = getDb();
  await db.engineShowcaseScenario.upsert({
    where: { id: SCENARIO_ID },
    update: {
      title: "Advanced Driver Ranking Showcase",
      explanation:
        "This SQLite-backed showcase ranks seeded operational profiles using POI, POD, BOL, ELD, fuel, HOS, ETA, deadhead, and driver-performance signals from the same decision model used in the workstation.",
      loadJson: JSON.stringify(showcaseLoad)
    },
    create: {
      id: SCENARIO_ID,
      title: "Advanced Driver Ranking Showcase",
      explanation:
        "This SQLite-backed showcase ranks seeded operational profiles using POI, POD, BOL, ELD, fuel, HOS, ETA, deadhead, and driver-performance signals from the same decision model used in the workstation.",
      loadJson: JSON.stringify(showcaseLoad)
    }
  });

  await db.engineShowcaseDriver.deleteMany({
    where: { scenarioId: SCENARIO_ID }
  });

  await db.engineShowcaseDriver.createMany({
    data: showcaseSeedDrivers.map((driver) => ({
      scenarioId: SCENARIO_ID,
      displayOrder: driver.displayOrder,
      driverId: driver.driverId,
      driverName: driver.driverName,
      homeBase: driver.homeBase,
      currentMarket: driver.currentMarket,
      hosRemainingMin: driver.hosRemainingMin,
      summary: driver.summary,
      signalsJson: JSON.stringify(driver.signals)
    }))
  });
}

function buildBreakdown(driver: ShowcaseDriverProfile, requiredMin: number): ShowcaseRankingBreakdownItem[] {
  const hosSlackMin = driver.hosRemainingMin - requiredMin;
  const deadheadContribution = weights.deadhead * (1 - clamp(driver.signals.deadheadMiles / 320, 0, 1));
  const hosContribution = weights.hos * clamp(hosSlackMin / 360, 0, 1);
  const etaContribution = weights.eta * clamp(driver.signals.etaBufferMin / 180, 0, 1);
  const fuelContribution = weights.fuel * (1 - clamp(driver.signals.fuelCostUsd / 550, 0, 1));
  const performanceContribution = weights.performance * clamp(driver.signals.driverPerformanceScore / 100, 0, 1);
  const poiContribution = weights.poi * clamp(driver.signals.poiCoverageScore, 0, 1);
  const podContribution = weights.pod * clamp(driver.signals.podOnTimeRate, 0, 1);
  const bolContribution = weights.bol * clamp(driver.signals.bolAccuracyRate, 0, 1);
  const eldContribution = weights.eld * clamp(driver.signals.eldComplianceScore, 0, 1);

  return [
    {
      key: "deadhead",
      label: "Deadhead",
      rawValue: `${driver.signals.deadheadMiles} mi`,
      contribution: Number(deadheadContribution.toFixed(1)),
      detail: "Shorter pickup repositioning gets more weight because it preserves time and margin."
    },
    {
      key: "hos",
      label: "HOS / ELD drive time",
      rawValue: `${formatHours(driver.hosRemainingMin)} left vs ${formatHours(requiredMin)} needed`,
      contribution: Number(hosContribution.toFixed(1)),
      detail: "The engine rewards legal cushion, not just bare feasibility."
    },
    {
      key: "eta",
      label: "ETA buffer",
      rawValue: `${driver.signals.etaBufferMin} min`,
      contribution: Number(etaContribution.toFixed(1)),
      detail: "More pickup buffer means lower appointment risk."
    },
    {
      key: "fuel",
      label: "Fuel cost",
      rawValue: `${formatMoney(driver.signals.fuelCostUsd)} @ ${driver.signals.fuelEfficiencyMpg.toFixed(1)} mpg`,
      contribution: Number(fuelContribution.toFixed(1)),
      detail: "Fuel is treated as an operating margin input, not a cosmetic metric."
    },
    {
      key: "performance",
      label: "Driver performance",
      rawValue: `${driver.signals.driverPerformanceScore}/100`,
      contribution: Number(performanceContribution.toFixed(1)),
      detail: "Recent route discipline and schedule adherence remain part of the recommendation."
    },
    {
      key: "poi",
      label: "POI support",
      rawValue: `${driver.signals.poiFuelStopMiles}/${driver.signals.poiSafeParkingMiles}/${driver.signals.poiRepairMiles} mi`,
      contribution: Number(poiContribution.toFixed(1)),
      detail: "Nearby fuel, parking, and repair options improve resilience on the lane."
    },
    {
      key: "pod",
      label: "POD reliability",
      rawValue: formatPercent(driver.signals.podOnTimeRate),
      contribution: Number(podContribution.toFixed(1)),
      detail: "Higher POD completion reliability lowers customer-facing execution risk."
    },
    {
      key: "bol",
      label: "BOL accuracy",
      rawValue: formatPercent(driver.signals.bolAccuracyRate),
      contribution: Number(bolContribution.toFixed(1)),
      detail: "Cleaner BOL handling reduces admin friction and exception cleanup."
    },
    {
      key: "eld",
      label: "ELD compliance",
      rawValue: `${formatPercent(driver.signals.eldComplianceScore)} (${driver.signals.eldViolationCount} violations)`,
      contribution: Number(eldContribution.toFixed(1)),
      detail: "ELD readiness is scored directly because repeated violations degrade confidence."
    }
  ];
}

function rankDriver(driver: ShowcaseDriverProfile, routeMiles: number): ShowcaseDriverRanking {
  const requiredMin = ((routeMiles + driver.signals.deadheadMiles) / AVG_SPEED_MPH) * 60;
  const breakdown = buildBreakdown(driver, requiredMin);
  const eliminated =
    driver.hosRemainingMin < requiredMin ||
    driver.signals.etaBufferMin < 0 ||
    driver.signals.eldComplianceScore < 0.5;
  const eliminationReason =
    driver.hosRemainingMin < requiredMin
      ? `HOS shortfall: needs ${formatHours(requiredMin)}, has ${formatHours(driver.hosRemainingMin)}`
      : driver.signals.etaBufferMin < 0
        ? `ETA miss: pickup would be missed by ${Math.abs(driver.signals.etaBufferMin)} minutes`
        : driver.signals.eldComplianceScore < 0.5
          ? `ELD risk: compliance score ${formatPercent(driver.signals.eldComplianceScore)} is below dispatch threshold`
          : undefined;
  const score = breakdown.reduce((total, item) => total + item.contribution, 0);

  return {
    driverId: driver.driverId,
    driverName: driver.driverName,
    rank: 0,
    score: Math.round(clamp(score, 0, 100)),
    recommended: false,
    eliminated,
    eliminationReason,
    summary: driver.summary,
    signals: driver.signals,
    breakdown
  };
}

export async function getAdvancedRankingShowcase(): Promise<AdvancedRankingShowcaseResponse> {
  await ensureScenarioSeeded();
  const db = getDb();
  const scenario = await db.engineShowcaseScenario.findUnique({
    where: { id: SCENARIO_ID },
    include: {
      drivers: {
        orderBy: { displayOrder: "asc" }
      }
    }
  });

  if (!scenario) {
    throw new Error("Advanced ranking showcase scenario not found.");
  }

  const load = JSON.parse(scenario.loadJson) as Load;
  const routeMiles = 653;
  const rankedDrivers = scenario.drivers
    .map((driver): ShowcaseDriverProfile => ({
      driverId: driver.driverId,
      driverName: driver.driverName,
      homeBase: driver.homeBase,
      currentMarket: driver.currentMarket,
      hosRemainingMin: driver.hosRemainingMin,
      summary: driver.summary,
      signals: JSON.parse(driver.signalsJson) as ShowcaseDriverProfile["signals"]
    }))
    .map((driver) => rankDriver(driver, routeMiles))
    .sort((left, right) => {
      if (left.eliminated !== right.eliminated) {
        return left.eliminated ? 1 : -1;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.signals.deadheadMiles - right.signals.deadheadMiles;
    })
    .map((driver, index) => ({
      ...driver,
      rank: index + 1,
      recommended: index === 0 && !driver.eliminated
    }));

  return advancedRankingShowcaseResponseSchema.parse({
    load,
    explanation: scenario.explanation,
    rankedDrivers
  });
}
