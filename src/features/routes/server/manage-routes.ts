import type { RouteDeskCreateRequest, RouteDeskItem, RouteDeskUpdateRequest } from "@/shared/contracts";
import { findLoadById } from "@/server/core/load-board";
import { AppError } from "@/server/core/errors";
import { createRepositories } from "@/server/repositories";
import { createTripId } from "@/shared/utils/ids";
import { haversineMiles } from "@/shared/utils/geo";

function mapRouteItem(row: Awaited<ReturnType<ReturnType<typeof createRepositories>["activeTripMirror"]["listAll"]>>[number]): RouteDeskItem {
  const load = findLoadById(row.loadId);
  const plannedRoute = row.plannedRouteJson ? JSON.parse(row.plannedRouteJson) as RouteDeskItem["plannedRoute"] : [];
  const firstPoint = plannedRoute[0];
  const lastPoint = plannedRoute.at(-1);
  const origin = load?.origin ?? (firstPoint
    ? { lat: firstPoint.lat, lng: firstPoint.lng, city: "Unknown", state: "--" }
    : null);
  const destination = load?.destination ?? (lastPoint
    ? { lat: lastPoint.lat, lng: lastPoint.lng, city: "Unknown", state: "--" }
    : null);

  return {
    tripId: row.tripId,
    driverId: row.driverId,
    loadId: row.loadId,
    status: row.status as RouteDeskItem["status"],
    etaMs: Number(row.etaMs),
    currentLoc: { lat: row.currentLat, lng: row.currentLng },
    plannedRoute,
    routePointCount: plannedRoute.length,
    lastSeenAtMs: row.lastSeenAt.getTime(),
    sourceUpdatedAtMs: row.sourceUpdatedAt?.getTime() ?? null,
    scenarioOverride: row.scenarioOverride,
    overrideReason: row.overrideReason,
    origin,
    destination,
    routeContext: load
      ? `${load.origin.city}, ${load.origin.state} -> ${load.destination.city}, ${load.destination.state}`
      : destination
        ? `${origin?.lat.toFixed(2)}, ${origin?.lng.toFixed(2)} -> ${destination.lat.toFixed(2)}, ${destination.lng.toFixed(2)}`
        : `Trip ${row.tripId}`,
    remainingMiles: destination
      ? Math.round(haversineMiles(row.currentLat, row.currentLng, destination.lat, destination.lng) * 10) / 10
      : null,
    customer: load?.customer ?? null,
    commodity: load?.commodity ?? null,
    rateUsd: load?.rateUsd ?? null,
    pickupStartMs: load?.pickupStartMs ?? null,
    pickupEndMs: load?.pickupEndMs ?? null
  };
}

export async function listManagedRoutes() {
  const repositories = createRepositories();
  const rows = await repositories.activeTripMirror.listAll();
  return rows.map(mapRouteItem);
}

export async function createManagedRoute(input: RouteDeskCreateRequest) {
  const repositories = createRepositories();
  const load = findLoadById(input.loadId);
  if (!load) {
    throw new AppError(`Load ${input.loadId} was not found.`, 404, "load_not_found");
  }

  const tripId = createTripId("desk");
  const row = await repositories.activeTripMirror.createManual({
    tripId,
    driverId: input.driverId,
    loadId: input.loadId,
    status: input.status ?? "on_track",
    etaMs: load.pickupEndMs + 8 * 60 * 60 * 1000,
    currentLoc: {
      lat: load.origin.lat,
      lng: load.origin.lng
    },
    plannedRoute: [
      { lat: load.origin.lat, lng: load.origin.lng },
      { lat: load.destination.lat, lng: load.destination.lng }
    ]
  });

  return mapRouteItem(row);
}

export async function deleteManagedRoute(tripId: string) {
  const repositories = createRepositories();
  const existing = await repositories.activeTripMirror.findByTripId(tripId);
  if (!existing) {
    throw new AppError(`Trip ${tripId} was not found.`, 404, "trip_not_found");
  }

  await repositories.activeTripMirror.deleteByTripId(tripId);
  return { ok: true as const, tripId };
}

export async function updateManagedRoute(tripId: string, input: RouteDeskUpdateRequest) {
  const repositories = createRepositories();
  const existing = await repositories.activeTripMirror.findByTripId(tripId);
  if (!existing) {
    throw new AppError(`Trip ${tripId} was not found.`, 404, "trip_not_found");
  }

  const updated = await repositories.activeTripMirror.updateByTripId({
    tripId,
    status: input.status,
    etaMs: input.etaMs,
    currentLoc: input.currentLoc,
    driverId: input.driverId
  });

  return mapRouteItem(updated);
}
