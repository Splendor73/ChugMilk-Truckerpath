import type { ActiveTrip, ComplianceFlag, Driver, FleetSnapshot } from "@/shared/contracts";
import { createRepositories } from "@/server/repositories";
import { findCityCoordinates } from "@/shared/utils/geo";
import { nowMs } from "@/shared/utils/time";
import { listLoads } from "@/server/core/load-board";
import { getDriverDispatch, queryDriverPerformance, queryDrivers, queryTrips, shouldUseNavProMock } from "@/server/integrations/navpro";

export function computeHOSStatus(hosRemainingMin: number): Driver["hosStatus"] {
  if (hosRemainingMin < 120) {
    return "must_rest";
  }
  if (hosRemainingMin < 360) {
    return "low";
  }
  return "fresh";
}

export function buildMorningBrief(drivers: Driver[], activeTrips: ActiveTrip[]): FleetSnapshot["morningBrief"] {
  const readyCount = drivers.filter((driver) => driver.hosStatus === "fresh").length;
  const restSoonCount = drivers.filter((driver) => driver.hosRemainingMin < 120).length;
  const complianceFlagCount = drivers.reduce((sum, driver) => sum + driver.complianceFlags.length, 0);
  const inMaintenanceCount = activeTrips.filter((trip) => trip.status === "long_idle").length;

  return {
    readyCount,
    restSoonCount,
    complianceFlagCount,
    inMaintenanceCount,
    headline: `${readyCount} drivers ready to run, ${restSoonCount} need rest within 2 hours, ${complianceFlagCount} have compliance flags, ${inMaintenanceCount} truck(s) in maintenance.`
  };
}

function parseDriverName(driver: any) {
  const first = driver?.basic_info?.driver_first_name ?? "Driver";
  const last = driver?.basic_info?.driver_last_name ?? `${driver?.driver_id ?? ""}`;
  return `${first} ${last}`.trim();
}

function parseHomeBase(driver: any) {
  const homeCity = driver?.contact_detail_info?.driver_city;
  const homeState = driver?.contact_detail_info?.driver_state;
  const resolved = typeof homeCity === "string" ? findCityCoordinates(homeCity, homeState) : null;

  if (resolved) {
    return {
      lat: resolved.lat,
      lng: resolved.lng,
      city: resolved.city
    };
  }

  const fallback = findCityCoordinates("Tempe", "AZ") ?? { lat: 33.4152, lng: -111.8315, city: "Tempe", state: "AZ" };
  return {
    lat: fallback.lat,
    lng: fallback.lng,
    city: fallback.city
  };
}

function parseLocation(driver: any, dispatch: any) {
  const latestPoint = dispatch?.data?.points?.at?.(-1) ?? dispatch?.data?.at?.(-1) ?? null;
  const lat = latestPoint?.lat ?? latestPoint?.latitude;
  const lng = latestPoint?.lng ?? latestPoint?.longitude;
  if (latestPoint && typeof lat === "number" && typeof lng === "number") {
    return {
      lat,
      lng,
      updatedAtMs: latestPoint.time ? new Date(latestPoint.time).getTime() : driver?.driver_location?.latest_update ?? nowMs()
    };
  }

  const locationText = String(driver?.driver_location?.last_known_location ?? "");
  const match = locationText.match(/,\s*([^,]+),\s*([A-Za-z]{2})/);
  if (match) {
    const cityCoords = findCityCoordinates(match[1], match[2]);
    if (cityCoords) {
      return {
        lat: cityCoords.lat,
        lng: cityCoords.lng,
        updatedAtMs: driver?.driver_location?.latest_update ?? nowMs()
      };
    }
  }

  return {
    lat: 33.4484,
    lng: -112.074,
    updatedAtMs: driver?.driver_location?.latest_update ?? nowMs()
  };
}

function parsePerformanceMinutes(performance: any) {
  const row = Array.isArray(performance?.data) ? performance.data[0] : performance?.data;
  const candidates = [
    row?.hos_remaining_min,
    row?.drive_remaining_min,
    row?.remaining_drive_min,
    row?.remaining_minutes,
    typeof row?.actual_time === "number" ? Math.max(0, 660 - row.actual_time) : null,
    performance?.hos_remaining_min,
    performance?.drive_remaining_min
  ];
  const valid = candidates.find((value) => typeof value === "number" && Number.isFinite(value));
  return valid ?? 480;
}

function parsePerformanceSummary(performance: any) {
  const row = Array.isArray(performance?.data) ? performance.data[0] : performance?.data;

  return {
    hosRemainingMin: parsePerformanceMinutes(performance),
    actualMiles: Number(row?.actual_miles ?? 0),
    scheduleMiles: Number(row?.schedule_miles ?? row?.actual_miles ?? 0),
    oorMiles: Number(row?.oor_miles ?? 0),
    actualTimeMin: Number(row?.actual_time ?? 0),
    scheduleTimeMin: Number(row?.schedule_time ?? row?.actual_time ?? 0)
  };
}

function buildComplianceFlags(driver: any) {
  const flags: ComplianceFlag[] = [];
  const expiration = driver?.license_detail_info?.license_expiration;
  if (typeof expiration === "string") {
    const diffDays = Math.round((new Date(expiration).getTime() - nowMs()) / (24 * 60 * 60 * 1000));
    if (diffDays <= 7) {
      flags.push({
        kind: "inspection_expiring",
        severity: "warn",
        message: `Inspection expires ${diffDays <= 0 ? "today" : `in ${diffDays} day${diffDays === 1 ? "" : "s"}`}.`
      });
    }
  }
  if (driver?.risk_flags?.fatigue_pattern) {
    flags.push({
      kind: "fatigue_pattern",
      severity: "warn",
      message: "Fatigue pattern observed in recent driving activity."
    });
  }
  return flags;
}

async function buildLiveDrivers() {
  const driversResponse = await queryDrivers();
  const rows = Array.isArray(driversResponse.data) ? driversResponse.data : [];

  return Promise.all(
    rows.map(async (driver): Promise<Driver> => {
      const [performanceResult, dispatchResult] = await Promise.allSettled([
        queryDriverPerformance(driver.driver_id),
        getDriverDispatch(driver.driver_id)
      ]);

      const performanceValue = performanceResult.status === "fulfilled" ? performanceResult.value : null;
      const dispatchValue = dispatchResult.status === "fulfilled" ? dispatchResult.value : null;
      const currentLocation = parseLocation(driver, dispatchValue);
      const homeBaseCoords = parseHomeBase(driver);
      const performanceSummary = parsePerformanceSummary(performanceValue);
      const hosRemainingMin = performanceSummary.hosRemainingMin;

      return {
        driverId: driver.driver_id,
        name: parseDriverName(driver),
        phone: driver?.basic_info?.driver_phone_number ?? "0000000000",
        homeBase: {
          lat: homeBaseCoords.lat,
          lng: homeBaseCoords.lng,
          city: homeBaseCoords.city
        },
        currentLocation,
        hosRemainingMin,
        hosStatus: computeHOSStatus(hosRemainingMin),
        complianceFlags: buildComplianceFlags(driver),
        performance: {
          actualMiles: performanceSummary.actualMiles,
          scheduleMiles: performanceSummary.scheduleMiles,
          oorMiles: performanceSummary.oorMiles,
          actualTimeMin: performanceSummary.actualTimeMin,
          scheduleTimeMin: performanceSummary.scheduleTimeMin
        },
        activeTripId:
          driver?.active_trip_id ??
          driver?.loads?.driver_current_load?.trip_id ??
          null
      };
    })
  );
}

async function buildLiveActiveTrips(): Promise<ActiveTrip[]> {
  const repositories = createRepositories();
  const mirrorTrips = await repositories.activeTripMirror.listAll();
  const liveTrips = await queryTrips();
  const fromMirror: ActiveTrip[] = mirrorTrips.map((trip) => ({
    tripId: trip.tripId,
    driverId: trip.driverId,
    loadId: trip.loadId,
    currentLoc: { lat: trip.currentLat, lng: trip.currentLng },
    etaMs: Number(trip.etaMs),
    status: (trip.status as ActiveTrip["status"]) ?? "on_track",
    plannedRoute: trip.plannedRouteJson ? (JSON.parse(trip.plannedRouteJson) as ActiveTrip["plannedRoute"]) : []
  }));

  const liveRows = Array.isArray(liveTrips.data) ? liveTrips.data : [];
  const fromLive = liveRows.flatMap((trip: any) => {
    if (!trip?.trip_id || !trip?.driver_id) {
      return [];
    }
    return [
      {
        tripId: String(trip.trip_id),
        driverId: Number(trip.driver_id),
        loadId: String(trip.load_id ?? trip.reference_number ?? "unknown-load"),
        currentLoc: {
          lat: Number(trip.current_lat ?? trip.lat ?? 33.4484),
          lng: Number(trip.current_lng ?? trip.lng ?? -112.074)
        },
        etaMs: Number(trip.eta_ms ?? (trip.eta ? new Date(trip.eta).getTime() : nowMs() + 2 * 60 * 60 * 1000)),
        status: (trip.status as ActiveTrip["status"]) ?? "on_track",
        plannedRoute: Array.isArray(trip.planned_route) ? trip.planned_route as ActiveTrip["plannedRoute"] : []
      }
    ];
  });

  const deduped = new Map<string, ActiveTrip>();
  [...fromMirror, ...fromLive].forEach((trip: ActiveTrip) => deduped.set(trip.tripId, trip));
  return [...deduped.values()];
}

export async function getFleetSnapshot(): Promise<FleetSnapshot> {
  const repositories = createRepositories();
  const pendingLoads = listLoads();

  try {
    const [drivers, activeTrips] = await Promise.all([buildLiveDrivers(), buildLiveActiveTrips()]);
    await repositories.activeTripMirror.upsertMany(activeTrips);
    return {
      fetchedAtMs: nowMs(),
      drivers,
      activeTrips,
      pendingLoads,
      morningBrief: buildMorningBrief(drivers, activeTrips)
    };
  } catch {
    const [drivers, activeTrips] = await Promise.all([buildLiveDrivers(), buildLiveActiveTrips()]);
    await repositories.activeTripMirror.upsertMany(activeTrips);
    return {
      fetchedAtMs: nowMs(),
      drivers,
      activeTrips,
      pendingLoads,
      morningBrief: buildMorningBrief(drivers, activeTrips)
    };
  }
}
