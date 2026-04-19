import type {
  ActiveTrip,
  ComplianceFlag,
  Driver,
  DriverMarket,
  DriverTripSummary,
  FleetSnapshot,
  Load
} from "@/shared/contracts";
import { createRepositories } from "@/server/repositories";
import { clamp, findCityCoordinates, haversineMiles } from "@/shared/utils/geo";
import { nowMs } from "@/shared/utils/time";
import { listLoads } from "@/server/core/load-board";
import { getDriverDispatch, queryDriverPerformance, queryDrivers, queryTrips } from "@/server/integrations/navpro";

type PerformanceSummary = NonNullable<Driver["performance"]> & {
  hosRemainingMin: number;
};

const DEFAULT_MARKET: DriverMarket = {
  city: "Phoenix",
  state: "AZ",
  lat: 33.4484,
  lng: -112.074,
  label: "Phoenix, AZ"
};

function marketKey(city: string, state: string) {
  return `${city.trim().toLowerCase()}-${state.trim().toLowerCase()}`;
}

function buildKnownMarkets(loads: Load[]) {
  const markets = new Map<string, DriverMarket>();

  for (const load of loads) {
    const stops = [load.origin, load.destination];
    for (const stop of stops) {
      markets.set(marketKey(stop.city, stop.state), {
        city: stop.city,
        state: stop.state,
        lat: stop.lat,
        lng: stop.lng,
        label: `${stop.city}, ${stop.state}`
      });
    }
  }

  markets.set(marketKey(DEFAULT_MARKET.city, DEFAULT_MARKET.state), DEFAULT_MARKET);

  return [...markets.values()];
}

function inferMarketFromCoords(
  coords: { lat: number; lng: number },
  knownMarkets: DriverMarket[],
  maxDistanceMiles = 140
) {
  let nearest: DriverMarket | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const market of knownMarkets) {
    const distance = haversineMiles(coords.lat, coords.lng, market.lat, market.lng);
    if (distance < nearestDistance) {
      nearest = market;
      nearestDistance = distance;
    }
  }

  return nearest && nearestDistance <= maxDistanceMiles ? nearest : null;
}

function parseMarketFromText(locationText: string, knownMarkets: DriverMarket[]) {
  const normalizedText = locationText.trim().toLowerCase();
  if (!normalizedText) {
    return null;
  }

  for (const market of knownMarkets) {
    if (
      normalizedText.includes(market.city.toLowerCase()) &&
      normalizedText.includes(market.state.toLowerCase())
    ) {
      return market;
    }
  }

  const match = locationText.match(/(?:outside\s+)?([^,]+?)(?:\s+rest area)?(?:,\s*[^,]+)?,\s*([A-Za-z]{2})$/i);
  if (!match) {
    return null;
  }

  const resolved = findCityCoordinates(match[1], match[2]);
  if (!resolved) {
    return null;
  }

  return {
    city: resolved.city,
    state: resolved.state,
    lat: resolved.lat,
    lng: resolved.lng,
    label: `${resolved.city}, ${resolved.state}`
  };
}

function resolveCurrentMarket(input: {
  driver: any;
  currentLocation: Driver["currentLocation"];
  homeBase: Driver["homeBase"];
  knownMarkets: DriverMarket[];
}) {
  const fromCoords = inferMarketFromCoords(input.currentLocation, input.knownMarkets);
  if (fromCoords) {
    return fromCoords;
  }

  const locationText = String(input.driver?.driver_location?.last_known_location ?? "");
  const fromText = parseMarketFromText(locationText, input.knownMarkets);
  if (fromText) {
    return fromText;
  }

  if (input.homeBase.state) {
    return {
      city: input.homeBase.city,
      state: input.homeBase.state,
      lat: input.currentLocation.lat,
      lng: input.currentLocation.lng,
      label: `${input.homeBase.city}, ${input.homeBase.state}`
    };
  }

  return {
    ...DEFAULT_MARKET,
    lat: input.currentLocation.lat,
    lng: input.currentLocation.lng
  };
}

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
      city: resolved.city,
      state: resolved.state
    };
  }

  const fallback = findCityCoordinates("Tempe", "AZ") ?? { lat: 33.4152, lng: -111.8315, city: "Tempe", state: "AZ" };
  return {
    lat: fallback.lat,
    lng: fallback.lng,
    city: fallback.city,
    state: fallback.state
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
    lat: DEFAULT_MARKET.lat,
    lng: DEFAULT_MARKET.lng,
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

function parsePerformanceSummary(performance: any): PerformanceSummary {
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

function buildPerformanceScore(performance: Driver["performance"] | undefined) {
  if (!performance) {
    return undefined;
  }

  const routeDiscipline = 1 - clamp(performance.oorMiles / Math.max(performance.actualMiles, 1), 0, 1);
  const scheduleAdherence =
    1 -
    clamp(
      (performance.actualTimeMin - performance.scheduleTimeMin) /
        Math.max(performance.scheduleTimeMin, 1),
      0,
      1
    );
  const utilization = clamp(performance.actualMiles / Math.max(performance.scheduleMiles, 1), 0, 1);

  return Math.round((routeDiscipline * 0.45 + scheduleAdherence * 0.35 + utilization * 0.2) * 100);
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

function parseOperationalStatus(driver: any, activeTripId: string | null): Driver["operationalStatus"] {
  const rawStatus = String(driver?.basic_info?.work_status ?? "").toUpperCase();

  if (rawStatus === "AVAILABLE") {
    return "available";
  }
  if (rawStatus === "RESTING") {
    return "resting";
  }
  if (rawStatus === "MAINTENANCE") {
    return "maintenance";
  }
  if (rawStatus === "IN_TRANSIT" || activeTripId) {
    return "driving";
  }

  return "unknown";
}

async function buildLiveDrivers(knownMarkets: DriverMarket[]) {
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
      const performance = {
        actualMiles: performanceSummary.actualMiles,
        scheduleMiles: performanceSummary.scheduleMiles,
        oorMiles: performanceSummary.oorMiles,
        actualTimeMin: performanceSummary.actualTimeMin,
        scheduleTimeMin: performanceSummary.scheduleTimeMin
      };
      const hosRemainingMin = performanceSummary.hosRemainingMin;
      const activeTripId =
        driver?.active_trip_id ??
        driver?.loads?.driver_current_load?.trip_id ??
        null;

      return {
        driverId: driver.driver_id,
        name: parseDriverName(driver),
        phone: driver?.basic_info?.driver_phone_number ?? "0000000000",
        homeBase: {
          lat: homeBaseCoords.lat,
          lng: homeBaseCoords.lng,
          city: homeBaseCoords.city,
          state: homeBaseCoords.state
        },
        currentLocation,
        currentMarket: resolveCurrentMarket({
          driver,
          currentLocation,
          homeBase: homeBaseCoords,
          knownMarkets
        }),
        hosRemainingMin,
        hosStatus: computeHOSStatus(hosRemainingMin),
        operationalStatus: parseOperationalStatus(driver, activeTripId),
        complianceFlags: buildComplianceFlags(driver),
        performance,
        performanceScore: buildPerformanceScore(performance),
        activeTripId,
        activeTrip: null,
        recentTrips: []
      };
    })
  );
}

function buildTripSummary(trip: ActiveTrip): DriverTripSummary {
  const routeContext = trip.routeContext
    ?? (trip.origin && trip.destination
      ? `${trip.origin.city}, ${trip.origin.state} -> ${trip.destination.city}, ${trip.destination.state}`
      : `Trip ${trip.tripId}`);

  return {
    tripId: trip.tripId,
    loadId: trip.loadId,
    status: trip.status,
    origin: trip.origin ?? null,
    destination: trip.destination ?? null,
    etaMs: Number.isFinite(trip.etaMs) ? trip.etaMs : null,
    routeContext,
    remainingMiles: trip.remainingMiles ?? null
  };
}

function buildStopFromPoint(
  point: { lat: number; lng: number } | undefined,
  knownMarkets: DriverMarket[]
) {
  if (!point) {
    return null;
  }

  const market = inferMarketFromCoords(point, knownMarkets, 160);
  if (!market) {
    return null;
  }

  return {
    city: market.city,
    state: market.state,
    lat: point.lat,
    lng: point.lng
  };
}

function enrichActiveTrip(trip: ActiveTrip, load: Load | undefined, knownMarkets: DriverMarket[]) {
  if (!load) {
    const origin = buildStopFromPoint(trip.plannedRoute[0], knownMarkets);
    const destination = buildStopFromPoint(trip.plannedRoute.at(-1), knownMarkets);

    return {
      ...trip,
      origin,
      destination,
      routeContext:
        trip.routeContext
        ?? (origin && destination
          ? `${origin.city}, ${origin.state} -> ${destination.city}, ${destination.state}`
          : `Trip ${trip.tripId}`),
      remainingMiles:
        destination
          ? Math.round(haversineMiles(trip.currentLoc.lat, trip.currentLoc.lng, destination.lat, destination.lng) * 10) / 10
          : null
    } satisfies ActiveTrip;
  }

  return {
    ...trip,
    origin: load.origin,
    destination: load.destination,
    routeContext: `${load.origin.city}, ${load.origin.state} -> ${load.destination.city}, ${load.destination.state}`,
    remainingMiles: Math.round(haversineMiles(trip.currentLoc.lat, trip.currentLoc.lng, load.destination.lat, load.destination.lng) * 10) / 10
  } satisfies ActiveTrip;
}

async function buildLiveActiveTrips(loadsById: Map<string, Load>, knownMarkets: DriverMarket[]): Promise<ActiveTrip[]> {
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
          lat: Number(trip.current_lat ?? trip.lat ?? DEFAULT_MARKET.lat),
          lng: Number(trip.current_lng ?? trip.lng ?? DEFAULT_MARKET.lng)
        },
        etaMs: Number(trip.eta_ms ?? (trip.eta ? new Date(trip.eta).getTime() : nowMs() + 2 * 60 * 60 * 1000)),
        status: (trip.status as ActiveTrip["status"]) ?? "on_track",
        plannedRoute: Array.isArray(trip.planned_route) ? trip.planned_route as ActiveTrip["plannedRoute"] : []
      }
    ];
  });

  const deduped = new Map<string, ActiveTrip>();
  [...fromMirror, ...fromLive].forEach((trip: ActiveTrip) => {
    deduped.set(trip.tripId, enrichActiveTrip(trip, loadsById.get(trip.loadId), knownMarkets));
  });
  return [...deduped.values()];
}

function enrichDrivers(drivers: Driver[], activeTrips: ActiveTrip[]) {
  const tripsByDriver = new Map<number, ActiveTrip[]>();

  for (const trip of activeTrips) {
    tripsByDriver.set(trip.driverId, [...(tripsByDriver.get(trip.driverId) ?? []), trip]);
  }

  return drivers.map((driver) => {
    const driverTrips = (tripsByDriver.get(driver.driverId) ?? [])
      .sort((left, right) => right.etaMs - left.etaMs)
      .slice(0, 3);
    const activeTrip = driver.activeTripId
      ? driverTrips.find((trip) => trip.tripId === driver.activeTripId) ?? driverTrips[0] ?? null
      : driverTrips[0] ?? null;

    return {
      ...driver,
      activeTrip: activeTrip ? buildTripSummary(activeTrip) : null,
      recentTrips: driverTrips.map(buildTripSummary),
      operationalStatus:
        driver.operationalStatus === "unknown" && activeTrip
          ? "driving"
          : driver.operationalStatus
    };
  });
}

async function fetchFleetSnapshotData() {
  const repositories = createRepositories();
  const pendingLoads = listLoads();
  const knownMarkets = buildKnownMarkets(pendingLoads);
  const loadsById = new Map(pendingLoads.map((load) => [load.loadId, load]));
  const [drivers, activeTrips] = await Promise.all([
    buildLiveDrivers(knownMarkets),
    buildLiveActiveTrips(loadsById, knownMarkets)
  ]);
  const enrichedDrivers = enrichDrivers(drivers, activeTrips);

  await repositories.activeTripMirror.upsertMany(activeTrips);

  return {
    fetchedAtMs: nowMs(),
    drivers: enrichedDrivers,
    activeTrips,
    pendingLoads,
    morningBrief: buildMorningBrief(enrichedDrivers, activeTrips)
  } satisfies FleetSnapshot;
}

export async function getFleetSnapshot(): Promise<FleetSnapshot> {
  try {
    return await fetchFleetSnapshotData();
  } catch {
    return fetchFleetSnapshotData();
  }
}
