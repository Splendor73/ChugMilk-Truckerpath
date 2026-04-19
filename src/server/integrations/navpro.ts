import { getFlags } from "@/config/flags";
import { getServerEnv } from "@/config/env.server";
import { AppError } from "@/server/core/errors";
import {
  controlSyntheticNavPro,
  resetSyntheticNavProState,
  syntheticCreateTrip,
  syntheticGetDriverDispatch,
  syntheticGetRoutingProfiles,
  syntheticQueryDriverPerformance,
  syntheticQueryDrivers,
  syntheticQueryTrips
} from "@/server/integrations/navpro-synthetic";
import { defaultTimeRange } from "@/shared/utils/time";

interface NavProEnvelope<T> {
  code?: number;
  success?: boolean;
  msg?: string;
  data?: T;
  total?: number;
}

async function navProRequest<T>(path: string, init: RequestInit = {}) {
  const env = getServerEnv();
  if (!env.NAVPRO_CLIENT_ID || !env.NAVPRO_JWT) {
    throw new AppError("NavPro credentials are missing.", 503, "navpro_credentials_missing");
  }

  const response = await fetch(`${env.NAVPRO_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NAVPRO_JWT}`,
      "X-Client-Id": env.NAVPRO_CLIENT_ID,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as NavProEnvelope<T>) : ({} as NavProEnvelope<T>);

  if (!response.ok || (parsed.code && parsed.code >= 400)) {
    const detailMessage =
      typeof parsed.msg === "string"
        ? parsed.msg
        : typeof (parsed as Record<string, unknown>).message === "string"
          ? ((parsed as Record<string, unknown>).message as string)
          : `NavPro request failed for ${path}`;
    throw new AppError(detailMessage, response.status || parsed.code || 500, "navpro_request_failed", parsed);
  }

  return parsed;
}

export async function queryDrivers() {
  if (shouldUseNavProMock()) {
    return syntheticQueryDrivers();
  }
  return navProRequest<any[]>("/api/driver/query", {
    method: "POST",
    body: JSON.stringify({})
  });
}

async function requestWithTimeRange<T>(path: string, driverId: number) {
  const range = defaultTimeRange(7);
  const candidates = [
    { driver_id: driverId, time_range: { start_time: range.startTime, end_time: range.endTime } },
    { driver_id: driverId, time_range: { from: range.startTime, to: range.endTime } },
    { driver_id: driverId, time_range: [range.startTime, range.endTime] }
  ];

  let lastError: unknown;
  for (const payload of candidates) {
    try {
      return await navProRequest<T>(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new AppError(`Unable to query ${path}`);
}

export async function queryDriverPerformance(driverId: number) {
  if (shouldUseNavProMock()) {
    return syntheticQueryDriverPerformance(driverId);
  }
  return requestWithTimeRange<any>(`/api/driver/performance/query`, driverId);
}

export async function getDriverDispatch(driverId: number) {
  if (shouldUseNavProMock()) {
    return syntheticGetDriverDispatch(driverId);
  }
  return requestWithTimeRange<any>(`/api/tracking/get/driver-dispatch`, driverId);
}

export async function queryTrips() {
  if (shouldUseNavProMock()) {
    return syntheticQueryTrips();
  }
  const candidates = [
    { path: "/api/trip/query", method: "POST", body: {} },
    { path: "/api/trip/list", method: "POST", body: {} }
  ];

  for (const candidate of candidates) {
    try {
      return await navProRequest<any[]>(candidate.path, {
        method: candidate.method,
        body: JSON.stringify(candidate.body)
      });
    } catch {
      // Try next candidate.
    }
  }

  return { data: [], code: 200, success: true };
}

export async function createTrip(payload: Record<string, unknown>) {
  if (shouldUseNavProMock()) {
    return syntheticCreateTrip(payload);
  }
  return navProRequest<Record<string, unknown>>("/api/trip/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function queryPOI(payload: Record<string, unknown>) {
  return navProRequest<any[]>("/api/poi/query", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getRoutingProfiles() {
  if (shouldUseNavProMock()) {
    return syntheticGetRoutingProfiles();
  }
  return navProRequest<any[]>("/api/routing-profile/list", {
    method: "GET"
  });
}

export function shouldUseNavProMock() {
  const flags = getFlags();
  return flags.useSyntheticNavPro || flags.useNavProMock || !flags.hasLiveNavPro;
}

export function controlNavProScenario(input: Parameters<typeof controlSyntheticNavPro>[0]) {
  return controlSyntheticNavPro(input);
}

export function resetNavProScenario() {
  return resetSyntheticNavProState();
}
