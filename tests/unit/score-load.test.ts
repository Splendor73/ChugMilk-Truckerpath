import { describe, expect, it } from "vitest";

import type { Driver, FleetSnapshot, Load } from "@/shared/contracts";
import { scoreDriverForLoad } from "@/features/dispatch/server/score-load";

const baseNowMs = Date.UTC(2026, 3, 18, 23, 0, 0);

function makeLoad(overrides: Partial<Load> = {}): Load {
  return {
    loadId: "LOAD-001",
    source: "broker_mock",
    origin: { city: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.074 },
    destination: { city: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194 },
    pickupStartMs: baseNowMs + 3 * 60 * 60 * 1000,
    pickupEndMs: baseNowMs + 5 * 60 * 60 * 1000,
    rateUsd: 3200,
    ...overrides
  };
}

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    driverId: 901,
    name: "Test Driver",
    phone: "555-0100",
    homeBase: { city: "Phoenix", lat: 33.4484, lng: -112.074 },
    currentLocation: { lat: 33.4484, lng: -112.074, updatedAtMs: baseNowMs },
    hosRemainingMin: 11 * 60,
    hosStatus: "fresh",
    complianceFlags: [],
    performance: {
      actualMiles: 300,
      scheduleMiles: 320,
      oorMiles: 8,
      actualTimeMin: 300,
      scheduleTimeMin: 330
    },
    activeTripId: null,
    ...overrides
  };
}

function makeSnapshot(overrides: Partial<FleetSnapshot> = {}): FleetSnapshot {
  const pendingLoads = overrides.pendingLoads ?? [];
  return {
    fetchedAtMs: baseNowMs,
    drivers: overrides.drivers ?? [],
    activeTrips: overrides.activeTrips ?? [],
    pendingLoads,
    morningBrief: overrides.morningBrief ?? {
      readyCount: 1,
      restSoonCount: 0,
      complianceFlagCount: 0,
      inMaintenanceCount: 0,
      headline: "Test snapshot"
    }
  };
}

describe("scoreDriverForLoad", () => {
  it("penalizes capacity loss when nearby loads compete for the same driver market", () => {
    const driver = makeDriver();
    const load = makeLoad();
    const quietSnapshot = makeSnapshot();
    const busySnapshot = makeSnapshot({
      pendingLoads: [
        load,
        makeLoad({
          loadId: "LOAD-NEARBY",
          origin: { city: "Mesa", state: "AZ", lat: 33.4152, lng: -111.8315 },
          pickupStartMs: baseNowMs + 4 * 60 * 60 * 1000,
          pickupEndMs: baseNowMs + 6 * 60 * 60 * 1000
        })
      ]
    });

    const quietScore = scoreDriverForLoad(driver, load, quietSnapshot);
    const busyScore = scoreDriverForLoad(driver, load, busySnapshot);

    expect(quietScore.rippleImpact.affectedLoads).toBe(0);
    expect(busyScore.rippleImpact.affectedLoads).toBe(1);
    expect(busyScore.score).toBeLessThan(quietScore.score);
  });

  it("eliminates drivers that cannot arrive before the pickup window closes", () => {
    const driver = makeDriver({
      currentLocation: { lat: 34.0522, lng: -118.2437, updatedAtMs: baseNowMs },
      hosRemainingMin: 20 * 60
    });
    const load = makeLoad({
      pickupStartMs: baseNowMs + 30 * 60 * 1000,
      pickupEndMs: baseNowMs + 60 * 60 * 1000
    });
    const snapshot = makeSnapshot();

    const score = scoreDriverForLoad(driver, load, snapshot);

    expect(score.eliminated).toBe(true);
    expect(score.eliminationReason).toContain("Pickup window:");
  });

  it("rewards stronger recent driver performance when operational fit is otherwise equal", () => {
    const load = makeLoad();
    const snapshot = makeSnapshot();
    const disciplinedDriver = makeDriver({
      driverId: 902,
      name: "Disciplined Driver",
      performance: {
        actualMiles: 320,
        scheduleMiles: 330,
        oorMiles: 4,
        actualTimeMin: 305,
        scheduleTimeMin: 330
      }
    });
    const sloppyDriver = makeDriver({
      driverId: 903,
      name: "Sloppy Driver",
      performance: {
        actualMiles: 320,
        scheduleMiles: 330,
        oorMiles: 45,
        actualTimeMin: 390,
        scheduleTimeMin: 330
      }
    });

    const disciplinedScore = scoreDriverForLoad(disciplinedDriver, load, snapshot);
    const sloppyScore = scoreDriverForLoad(sloppyDriver, load, snapshot);

    expect(disciplinedScore.score).toBeGreaterThan(sloppyScore.score);
    expect(disciplinedScore.rationale).toContain("driver-performance component");
  });
});
