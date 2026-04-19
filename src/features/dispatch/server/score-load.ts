import type { Driver, DriverScore, FleetSnapshot, Load } from "@/shared/contracts";
import { getFleetSnapshot } from "@/features/fleet/server/get-fleet-snapshot";
import { clamp, haversineMiles } from "@/shared/utils/geo";
import { nowMs } from "@/shared/utils/time";

const AVG_SPEED_MPH = 70;
const COST_PER_MILE = 0.65;
const MAX_DEADHEAD_MILES = 300;
const MAX_HOS_SLACK_MIN = 360;
const MAX_PICKUP_BUFFER_MIN = 12 * 60;
const MAX_HOME_RETURN_MILES = 750;
const MAX_NETWORK_LOADS = 6;
const NETWORK_RADIUS_MILES = 120;
const NETWORK_LOOKAHEAD_HOURS = 24;

function formatHours(minutes: number) {
  return `${Math.round((minutes / 60) * 10) / 10}`;
}

function estimateRequiredMinutes(driver: Driver, load: Load) {
  const deadheadMiles = haversineMiles(
    driver.currentLocation.lat,
    driver.currentLocation.lng,
    load.origin.lat,
    load.origin.lng
  );
  const routeMiles = haversineMiles(load.origin.lat, load.origin.lng, load.destination.lat, load.destination.lng);
  const totalMiles = deadheadMiles + routeMiles;

  return {
    deadheadMiles,
    routeMiles,
    requiredMin: (totalMiles / AVG_SPEED_MPH) * 60
  };
}

function criticalCompliance(driver: Driver) {
  return driver.complianceFlags.find((flag) => flag.severity === "critical") ?? null;
}

function countNearbyLoads(driver: Driver, load: Load, fleetState: FleetSnapshot) {
  const latestRelevantPickupMs = load.pickupEndMs + NETWORK_LOOKAHEAD_HOURS * 60 * 60 * 1000;

  return fleetState.pendingLoads.filter((candidate) => {
    if (candidate.loadId === load.loadId) {
      return false;
    }

    if (candidate.pickupStartMs > latestRelevantPickupMs) {
      return false;
    }

    return (
      haversineMiles(
        driver.currentLocation.lat,
        driver.currentLocation.lng,
        candidate.origin.lat,
        candidate.origin.lng
      ) <= NETWORK_RADIUS_MILES
    );
  }).length;
}

function compliancePenalty(driver: Driver) {
  return driver.complianceFlags.reduce((total, flag) => {
    if (flag.severity === "warn") {
      return total + 4;
    }
    if (flag.severity === "info") {
      return total + 2;
    }
    return total;
  }, 0);
}

function driverPerformanceScore(driver: Driver) {
  if (!driver.performance) {
    return 0;
  }

  const routeDiscipline = 1 - clamp(driver.performance.oorMiles / Math.max(driver.performance.actualMiles, 1), 0, 1);
  const scheduleAdherence =
    1 -
    clamp(
      (driver.performance.actualTimeMin - driver.performance.scheduleTimeMin) /
        Math.max(driver.performance.scheduleTimeMin, 1),
      0,
      1
    );
  const utilization = clamp(driver.performance.actualMiles / Math.max(driver.performance.scheduleMiles, 1), 0, 1);

  return 10 * (routeDiscipline * 0.45 + scheduleAdherence * 0.35 + utilization * 0.2);
}

function buildRationale(input: {
  driver: Driver;
  deadheadMiles: number;
  hosSlackMin: number;
  netRevenueUsd: number;
  affectedLoads: number;
  homeReturnMiles: number;
  performanceScore: number;
}) {
  return `${input.driver.name} is ${Math.round(input.deadheadMiles)} deadhead miles from pickup, keeps about ${formatHours(Math.max(input.hosSlackMin, 0))} hours of HOS cushion after the run, projects roughly $${Math.round(input.netRevenueUsd)} net after fuel, and leaves ${input.affectedLoads} nearby load${input.affectedLoads === 1 ? "" : "s"} uncovered. The delivery finishes about ${Math.round(input.homeReturnMiles)} miles from the driver's home market, and the driver-performance component adds ${input.performanceScore.toFixed(1)} points from route discipline and schedule adherence.`;
}

export function scoreDriverForLoad(driver: Driver, load: Load, fleetState: FleetSnapshot): DriverScore {
  const { deadheadMiles, routeMiles, requiredMin } = estimateRequiredMinutes(driver, load);
  const totalMiles = deadheadMiles + routeMiles;
  const hosPass = driver.hosRemainingMin >= requiredMin;
  const hosSlackMin = driver.hosRemainingMin - requiredMin;
  const fuelCostUsd = totalMiles * COST_PER_MILE;
  const netRevenueUsd = load.rateUsd - fuelCostUsd;
  const affectedLoads = countNearbyLoads(driver, load, fleetState);
  const rippleDeltaUsd = -affectedLoads * 175;
  const homeReturnMiles = haversineMiles(
    load.destination.lat,
    load.destination.lng,
    driver.homeBase.lat,
    driver.homeBase.lng
  );
  const deadheadTravelMin = (deadheadMiles / AVG_SPEED_MPH) * 60;
  const pickupBufferMin = (load.pickupEndMs - (fleetState.fetchedAtMs || nowMs()) - deadheadTravelMin * 60 * 1000) / (60 * 1000);
  const missedPickup = pickupBufferMin < 0;
  const complianceIssue = criticalCompliance(driver);
  const eliminated = !hosPass || missedPickup || Boolean(complianceIssue);
  const eliminationReason = !hosPass
    ? `HOS: needs ${formatHours(requiredMin)} hours, has ${formatHours(driver.hosRemainingMin)} hours`
    : missedPickup
      ? `Pickup window: arrival misses the window by ${formatHours(Math.abs(pickupBufferMin))} hours`
    : complianceIssue
      ? `Compliance: ${complianceIssue.message}`
      : undefined;
  const proximityScore = 35 * (1 - clamp(deadheadMiles / MAX_DEADHEAD_MILES, 0, 1));
  const hosScore = 20 * clamp(hosSlackMin / MAX_HOS_SLACK_MIN, 0, 1);
  const timingScore = 15 * clamp(pickupBufferMin / MAX_PICKUP_BUFFER_MIN, 0, 1);
  const economicsScore = 15 * clamp(netRevenueUsd / Math.max(load.rateUsd, 1), 0, 1);
  const destinationFitScore = 5 * (1 - clamp(homeReturnMiles / MAX_HOME_RETURN_MILES, 0, 1));
  const performanceScore = driverPerformanceScore(driver);
  const networkPenalty = clamp(affectedLoads, 0, MAX_NETWORK_LOADS) * 2;
  const rawScore =
    proximityScore +
    hosScore +
    timingScore +
    economicsScore +
    destinationFitScore +
    performanceScore -
    networkPenalty -
    compliancePenalty(driver);
  const etaConfidenceBase =
    0.45 +
    clamp((MAX_DEADHEAD_MILES - deadheadMiles) / MAX_DEADHEAD_MILES, 0, 1) * 0.3 +
    clamp(pickupBufferMin / MAX_PICKUP_BUFFER_MIN, 0, 1) * 0.2 -
    affectedLoads * 0.03;

  return {
    driverId: driver.driverId,
    driverName: driver.name,
    score: clamp(Math.round(rawScore), 0, 100),
    deadheadMiles: Math.round(deadheadMiles * 10) / 10,
    hosCheck: {
      requiredMin: Math.round(requiredMin),
      availableMin: driver.hosRemainingMin,
      pass: hosPass
    },
    fuelCostUsd: Math.round(fuelCostUsd * 100) / 100,
    etaConfidence: clamp(Number(etaConfidenceBase.toFixed(2)), 0.35, 0.99),
    rippleImpact: {
      affectedLoads,
      deltaUsd: rippleDeltaUsd
    },
    rationale: buildRationale({
      driver,
      deadheadMiles,
      hosSlackMin,
      netRevenueUsd,
      affectedLoads,
      homeReturnMiles,
      performanceScore
    }),
    eliminated,
    eliminationReason
  };
}

export async function scoreLoad(load: Load): Promise<DriverScore[]> {
  const fleetState = await getFleetSnapshot();
  return fleetState.drivers
    .filter((driver) => !driver.activeTripId)
    .map((driver) => scoreDriverForLoad(driver, load, fleetState))
    .sort((left, right) => {
      if (left.eliminated !== right.eliminated) {
        return left.eliminated ? 1 : -1;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.deadheadMiles !== right.deadheadMiles) {
        return left.deadheadMiles - right.deadheadMiles;
      }
      if (left.hosCheck.availableMin !== right.hosCheck.availableMin) {
        return right.hosCheck.availableMin - left.hosCheck.availableMin;
      }
      return left.driverName.localeCompare(right.driverName);
    });
}
