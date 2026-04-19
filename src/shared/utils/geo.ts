import loads from "../../../data/loads/seed.json";

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function projectPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return { x: ax, y: ay };
  }
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return {
    x: ax + clamped * dx,
    y: ay + clamped * dy
  };
}

export function pointToSegmentMiles(
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
) {
  const projection = projectPointOnSegment(point.lng, point.lat, start.lng, start.lat, end.lng, end.lat);
  return haversineMiles(point.lat, point.lng, projection.y, projection.x);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const cityMap = new Map<string, { lat: number; lng: number; city: string; state: string }>();

for (const item of loads) {
  cityMap.set(`${item.origin.city.toLowerCase()}-${item.origin.state.toLowerCase()}`, {
    lat: item.origin.lat,
    lng: item.origin.lng,
    city: item.origin.city,
    state: item.origin.state
  });
  cityMap.set(`${item.destination.city.toLowerCase()}-${item.destination.state.toLowerCase()}`, {
    lat: item.destination.lat,
    lng: item.destination.lng,
    city: item.destination.city,
    state: item.destination.state
  });
}

export function findCityCoordinates(city: string, state?: string) {
  const normalizedCity = city.trim().toLowerCase();
  if (state) {
    const direct = cityMap.get(`${normalizedCity}-${state.trim().toLowerCase()}`);
    if (direct) {
      return direct;
    }
  }
  for (const entry of cityMap.values()) {
    if (entry.city.toLowerCase() === normalizedCity) {
      return entry;
    }
  }
  return null;
}
