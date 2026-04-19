import rawLoads from "../../../data/loads/seed.json";
import type { Load } from "@/shared/contracts";
import { pointToSegmentMiles, haversineMiles } from "@/shared/utils/geo";

type SeedLoad = (typeof rawLoads)[number];

const normalizedLoads: Load[] = rawLoads.map((load) => ({
  loadId: load.load_id,
  source: "broker_mock",
  origin: {
    city: load.origin.city,
    state: load.origin.state,
    lat: load.origin.lat,
    lng: load.origin.lng
  },
  destination: {
    city: load.destination.city,
    state: load.destination.state,
    lat: load.destination.lat,
    lng: load.destination.lng
  },
  pickupStartMs: new Date(load.pickup_window.start).getTime(),
  pickupEndMs: new Date(load.pickup_window.end).getTime(),
  rateUsd: load.rate_usd,
  weightLbs: load.weight_lbs,
  commodity: load.commodity,
  customer: load.broker?.name
}));

export function listLoads() {
  return normalizedLoads;
}

export function findLoadById(loadId: string) {
  return normalizedLoads.find((load) => load.loadId === loadId) ?? null;
}

export function findSeedLoad(loadId: string) {
  return (rawLoads as SeedLoad[]).find((load) => load.load_id === loadId) ?? null;
}

export function searchLoadsNearRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  pickupWindowStartMs?: number,
  options?: {
    maxResults?: number;
    destinationNear?: { lat: number; lng: number; radiusMiles: number };
    excludeLoadIds?: string[];
    pickupWithinHours?: number;
  }
) {
  const maxResults = options?.maxResults ?? 10;
  const excludedIds = new Set(options?.excludeLoadIds ?? []);
  const pickupLatest = pickupWindowStartMs && options?.pickupWithinHours
    ? pickupWindowStartMs + options.pickupWithinHours * 60 * 60 * 1000
    : null;

  return normalizedLoads
    .filter((load) => !excludedIds.has(load.loadId))
    .filter((load) => pointToSegmentMiles(load.origin, origin, destination) <= 50)
    .filter((load) => {
      if (!options?.destinationNear) {
        return true;
      }
      return (
        haversineMiles(
          load.destination.lat,
          load.destination.lng,
          options.destinationNear.lat,
          options.destinationNear.lng
        ) <= options.destinationNear.radiusMiles
      );
    })
    .filter((load) => {
      if (!pickupWindowStartMs || !pickupLatest) {
        return true;
      }
      return load.pickupStartMs >= pickupWindowStartMs && load.pickupStartMs <= pickupLatest;
    })
    .sort((a, b) => {
      const aDistance = pointToSegmentMiles(a.origin, origin, destination);
      const bDistance = pointToSegmentMiles(b.origin, origin, destination);
      return aDistance - bDistance;
    })
    .slice(0, maxResults);
}
