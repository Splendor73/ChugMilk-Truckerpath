import { describe, expect, it } from "vitest";

import { buildMapPresentationModel } from "@/components/workstation/map-presentation";
import type { BackhaulOption, Driver, DriverScore, FleetSnapshotResponse, MonitorDraftView } from "@/shared/contracts";

const baseDriver: Driver = {
  driverId: 101,
  name: "Mike Chen",
  phone: "6025550101",
  homeBase: { lat: 33.4152, lng: -111.8315, city: "Tempe" },
  currentLocation: { lat: 33.4353, lng: -112.3582, updatedAtMs: 1 },
  hosRemainingMin: 600,
  hosStatus: "fresh",
  complianceFlags: [],
  activeTripId: null
};

const flaggedDriver: Driver = {
  ...baseDriver,
  driverId: 105,
  name: "Sara Patel",
  currentLocation: { lat: 33.4484, lng: -112.074, updatedAtMs: 1 },
  hosRemainingMin: 105,
  hosStatus: "must_rest",
  complianceFlags: [{ kind: "fatigue_pattern", severity: "warn", message: "Fatigue pattern observed." }]
};

const snapshot: FleetSnapshotResponse = {
  fetchedAtMs: 1,
  sourceMode: "synthetic",
  drivers: [baseDriver, flaggedDriver],
  activeTrips: [
    {
      tripId: "TRIP-ACT3",
      driverId: 104,
      loadId: "TL-ACT3-01",
      currentLoc: { lat: 34.8958, lng: -117.0228 },
      etaMs: 2,
      status: "long_idle",
      plannedRoute: [
        { lat: 34.0522, lng: -118.2437 },
        { lat: 34.8958, lng: -117.0228 }
      ]
    }
  ],
  pendingLoads: [],
  morningBrief: {
    readyCount: 1,
    restSoonCount: 1,
    complianceFlagCount: 1,
    inMaintenanceCount: 1,
    headline: "1 driver ready, 1 at risk."
  }
};

const roundTripSnapshot: FleetSnapshotResponse = {
  ...snapshot,
  activeTrips: [
    ...snapshot.activeTrips,
    {
      tripId: "trip-outbound-1",
      driverId: 101,
      loadId: "TL-DEMO-01",
      currentLoc: { lat: 35.9132, lng: -120.1462 },
      etaMs: 3,
      status: "on_track",
      plannedRoute: [
        { lat: 33.4484, lng: -112.074 },
        { lat: 37.7749, lng: -122.4194 }
      ]
    },
    {
      tripId: "return-1",
      driverId: 101,
      loadId: "TL-BH-01",
      currentLoc: { lat: 36.1033, lng: -119.6816 },
      etaMs: 4,
      status: "on_track",
      plannedRoute: [
        { lat: 37.7749, lng: -122.4194 },
        { lat: 33.4484, lng: -112.074 }
      ]
    }
  ]
};

const parsedLoad = {
  loadId: "TL-DEMO-01",
  source: "paste" as const,
  origin: { city: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.074 },
  destination: { city: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194 },
  pickupStartMs: 1,
  pickupEndMs: 2,
  rateUsd: 3200
};

const selectedScore: DriverScore = {
  driverId: 101,
  driverName: "Mike Chen",
  score: 98,
  deadheadMiles: 18,
  hosCheck: { requiredMin: 600, availableMin: 600, pass: true },
  fuelCostUsd: 404,
  etaConfidence: 0.92,
  rippleImpact: { affectedLoads: 1, deltaUsd: -175 },
  rationale: "Best fit.",
  eliminated: false
};

const selectedBackhaul: BackhaulOption = {
  outbound: parsedLoad,
  returnLoad: {
    loadId: "TL-BH-01",
    source: "broker_mock",
    origin: { city: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194 },
    destination: { city: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.074 },
    pickupStartMs: 3,
    pickupEndMs: 4,
    rateUsd: 2400
  },
  totalRevenueUsd: 5600,
  totalDeadheadMiles: 85,
  roundTripProfitUsd: 4800,
  oneWayProfitUsd: 2100,
  hosFeasible: true,
  narrative: "SFO -> Phoenix closes the return."
};

const openDraft: MonitorDraftView = {
  id: "draft-1",
  tripId: "TRIP-ACT3",
  trigger: "long_idle",
  customerSms: "Delayed near Barstow.",
  relayDriverId: 101,
  relayDriverName: "Mike Chen",
  relayDistanceMi: 28,
  rerouteNeeded: true,
  voiceScript: "Execute to approve.",
  createdAtMs: 1,
  status: "drafted",
  audioSource: null,
  executedAtMs: null,
  matchedCommand: null
};

describe("map presentation", () => {
  it("emphasizes risk drivers in morning triage", () => {
    const model = buildMapPresentationModel({
      activeStage: "morning_triage",
      snapshot,
      activeTrip: snapshot.activeTrips[0] ?? null,
      openDraft: null,
      parsedLoad: null,
      selectedScore: null,
      selectedBackhaul: null,
      backhaulOpen: false,
      driverById: new Map(snapshot.drivers.map((driver) => [driver.driverId, driver]))
    });

    expect(model.markers.some((marker) => marker.id === "driver-105" && marker.emphasized)).toBe(true);
    expect(model.markers.some((marker) => marker.id === "trip-TRIP-ACT3" && marker.emphasized)).toBe(true);
    expect(model.viewport.zoom).toBeGreaterThan(3.2);
  });

  it("follows the selected assignment lane", () => {
    const model = buildMapPresentationModel({
      activeStage: "load_assignment",
      snapshot,
      activeTrip: snapshot.activeTrips[0] ?? null,
      openDraft: null,
      parsedLoad,
      selectedScore,
      selectedBackhaul: null,
      backhaulOpen: false,
      driverById: new Map(snapshot.drivers.map((driver) => [driver.driverId, driver]))
    });

    expect(model.routes.some((route) => route.id === "load-TL-DEMO-01")).toBe(true);
    expect(model.routes.some((route) => route.id === "deadhead-driver-101-load-TL-DEMO-01" && route.dashed)).toBe(true);
    expect(model.markers.some((marker) => marker.id === "driver-101" && marker.emphasized)).toBe(true);
    expect(model.markers.some((marker) => marker.id === "load-origin-TL-DEMO-01")).toBe(true);
  });

  it("supports a hovered driver preview without replacing the current UI contract", () => {
    const model = buildMapPresentationModel({
      activeStage: "load_assignment",
      snapshot,
      activeTrip: snapshot.activeTrips[0] ?? null,
      openDraft: null,
      parsedLoad,
      selectedScore,
      hoveredDriverId: 105,
      selectedBackhaul: null,
      backhaulOpen: false,
      driverById: new Map(snapshot.drivers.map((driver) => [driver.driverId, driver]))
    });

    expect(model.markers.find((marker) => marker.id === "driver-105")?.state).toBe("hovered");
    expect(model.routes.some((route) => route.id === "deadhead-driver-105-load-TL-DEMO-01")).toBe(true);
  });

  it("keeps outbound and return overlays visible after a committed round-trip refresh", () => {
    const model = buildMapPresentationModel({
      activeStage: "trip_monitoring",
      snapshot: roundTripSnapshot,
      activeTrip: roundTripSnapshot.activeTrips[1] ?? null,
      openDraft: null,
      parsedLoad,
      selectedScore,
      selectedBackhaul,
      backhaulOpen: false,
      driverById: new Map(roundTripSnapshot.drivers.map((driver) => [driver.driverId, driver]))
    });

    expect(model.routes.some((route) => route.id === "load-TL-DEMO-01")).toBe(true);
    expect(model.routes.some((route) => route.id === "backhaul-TL-BH-01")).toBe(true);
    expect(model.markers.some((marker) => marker.id === "backhaul-origin-TL-BH-01")).toBe(true);
    expect(model.viewport.zoom).toBeGreaterThanOrEqual(4);
  });

  it("shows relay context during monitoring", () => {
    const model = buildMapPresentationModel({
      activeStage: "trip_monitoring",
      snapshot,
      activeTrip: snapshot.activeTrips[0] ?? null,
      openDraft,
      parsedLoad,
      selectedScore,
      selectedBackhaul,
      backhaulOpen: true,
      driverById: new Map(snapshot.drivers.map((driver) => [driver.driverId, driver]))
    });

    expect(model.markers.some((marker) => marker.id === "relay-101" && marker.emphasized)).toBe(true);
    expect(model.routes.some((route) => route.id === "TRIP-ACT3" && route.dashed)).toBe(true);
    expect(model.viewport.zoom).toBeGreaterThanOrEqual(4);
  });
});
