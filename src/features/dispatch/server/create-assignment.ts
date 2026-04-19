import type { ActiveTrip, FleetAssignmentRequest, FleetAssignmentResponse } from "@/shared/contracts";
import { getFleetSnapshot } from "@/features/fleet/server/get-fleet-snapshot";
import { scoreDriverForLoad } from "@/features/dispatch/server/score-load";
import { buildBackhaulOption } from "@/features/backhaul/server/backhaul-economics";
import { findLoadById } from "@/server/core/load-board";
import { createTrip, getRoutingProfiles, shouldUseNavProMock } from "@/server/integrations/navpro";
import { createTripId } from "@/shared/utils/ids";
import { createRepositories } from "@/server/repositories";
import { appendDecisionLog } from "@/features/decision-log/server/append-decision-log";
import { haversineMiles } from "@/shared/utils/geo";

const COST_PER_MILE = 0.65;

function tripFromLoad(input: { tripId: string; driverId: number; loadId: string; load: NonNullable<ReturnType<typeof findLoadById>> }): ActiveTrip {
  return {
    tripId: input.tripId,
    driverId: input.driverId,
    loadId: input.loadId,
    currentLoc: {
      lat: input.load.origin.lat,
      lng: input.load.origin.lng
    },
    etaMs: input.load.pickupEndMs + 8 * 60 * 60 * 1000,
    status: "on_track",
    plannedRoute: [
      { lat: input.load.origin.lat, lng: input.load.origin.lng },
      { lat: input.load.destination.lat, lng: input.load.destination.lng }
    ]
  };
}

async function maybeCreateNavProTrip(payload: Record<string, unknown>) {
  if (shouldUseNavProMock()) {
    try {
      const response = await createTrip(payload);
      return {
        data: typeof response === "object" && response !== null && "data" in response
          ? (response as { data?: unknown }).data ?? response
          : response,
        error: null as string | null
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Synthetic trip create failed."
      };
    }
  }

  try {
    const response = await createTrip(payload);
    return {
      data: typeof response === "object" && response !== null && "data" in response
        ? (response as { data?: unknown }).data ?? response
        : response,
      error: null as string | null
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NavPro trip create failed."
    };
  }
}

function extractTripId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const value = record.trip_id ?? record.id ?? record.tripId;
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function routeMiles(load: NonNullable<ReturnType<typeof findLoadById>>) {
  return haversineMiles(load.origin.lat, load.origin.lng, load.destination.lat, load.destination.lng);
}

export async function createAssignment(input: FleetAssignmentRequest): Promise<FleetAssignmentResponse> {
  const repositories = createRepositories();
  const load = findLoadById(input.loadId);
  if (!load) {
    throw new Error(`Load ${input.loadId} not found.`);
  }

  const returnLoad = input.returnLoadId ? findLoadById(input.returnLoadId) : null;
  const fleetState = await getFleetSnapshot();
  const driver = fleetState.drivers.find((item) => item.driverId === input.driverId) ?? null;
  const scoreSnapshot = driver ? scoreDriverForLoad(driver, load, fleetState) : null;
  const useMock = shouldUseNavProMock();
  const routingProfiles = await getRoutingProfiles().catch(() => ({ data: [] }));
  const routingProfileId = Array.isArray(routingProfiles.data) && routingProfiles.data[0] ? routingProfiles.data[0].id : "mock-profile";

  const outboundPayload = {
    scheduled_start_time: new Date(load.pickupStartMs).toISOString().replace(/\.\d{3}Z$/, "Z"),
    driver_id: input.driverId,
    routing_profile_id: routingProfileId,
    trip_name: load.loadId,
    stop_points: [
      {
        latitude: load.origin.lat,
        longitude: load.origin.lng,
        address_name: `${load.origin.city}, ${load.origin.state}`,
        appointment_time: new Date(load.pickupStartMs).toISOString().replace(/\.\d{3}Z$/, "Z"),
        dwell_time: 30,
        notes: "Pickup window confirmed by dispatch."
      },
      {
        latitude: load.destination.lat,
        longitude: load.destination.lng,
        address_name: `${load.destination.city}, ${load.destination.state}`,
        appointment_time: new Date(load.pickupEndMs).toISOString().replace(/\.\d{3}Z$/, "Z"),
        dwell_time: 0,
        notes: "Deliver on booked window."
      }
    ]
  };

  const outboundNavPro = await maybeCreateNavProTrip(outboundPayload);
  const tripId = extractTripId(outboundNavPro.data) ?? createTripId("trip");

  let returnTripId: string | undefined;
  let returnPayload: Record<string, unknown> | undefined;
  let returnNavPro: Awaited<ReturnType<typeof maybeCreateNavProTrip>> | null = null;
  if (returnLoad) {
    returnPayload = {
      scheduled_start_time: new Date(returnLoad.pickupStartMs).toISOString().replace(/\.\d{3}Z$/, "Z"),
      driver_id: input.driverId,
      routing_profile_id: routingProfileId,
      trip_name: returnLoad.loadId,
      stop_points: [
        {
          latitude: returnLoad.origin.lat,
          longitude: returnLoad.origin.lng,
          address_name: `${returnLoad.origin.city}, ${returnLoad.origin.state}`,
          appointment_time: new Date(returnLoad.pickupStartMs).toISOString().replace(/\.\d{3}Z$/, "Z"),
          dwell_time: 20,
          notes: "Backhaul pickup inserted by copilot."
        },
        {
          latitude: returnLoad.destination.lat,
          longitude: returnLoad.destination.lng,
          address_name: `${returnLoad.destination.city}, ${returnLoad.destination.state}`,
          appointment_time: new Date(returnLoad.pickupEndMs).toISOString().replace(/\.\d{3}Z$/, "Z"),
          dwell_time: 0,
          notes: "Return leg closes the round trip."
        }
      ]
    };
    returnNavPro = await maybeCreateNavProTrip(returnPayload);
    returnTripId = extractTripId(returnNavPro.data) ?? createTripId("return");
  }

  const warnings = [
    ...(outboundNavPro.error ? [`Outbound NavPro trip creation failed: ${outboundNavPro.error}`] : []),
    ...(returnNavPro?.error ? [`Return NavPro trip creation failed: ${returnNavPro.error}`] : [])
  ];
  const navProMode =
    useMock
      ? "synthetic"
      : warnings.length === 0
        ? "live"
        : "fallback";

  const outboundMiles = routeMiles(load);
  const oneWayProfitUsd = Math.round(load.rateUsd - outboundMiles * COST_PER_MILE);
  const baselineReturnDeadheadMiles = driver
    ? haversineMiles(load.destination.lat, load.destination.lng, driver.homeBase.lat, driver.homeBase.lng)
    : null;
  const roundTripInsight = returnLoad && driver
    ? (() => {
        const option = buildBackhaulOption({
          outbound: load,
          returnLoad,
          homeBase: driver.homeBase,
          hosRemainingMin: driver.hosRemainingMin
        });
        const profitDeltaUsd = option.roundTripProfitUsd - option.oneWayProfitUsd;
        const deadheadSavedMi =
          baselineReturnDeadheadMiles == null
            ? null
            : Math.round((baselineReturnDeadheadMiles - option.totalDeadheadMiles) * 10) / 10;

        return {
          oneWayProfitUsd: option.oneWayProfitUsd,
          roundTripProfitUsd: option.roundTripProfitUsd,
          totalDeadheadMiles: option.totalDeadheadMiles,
          deadheadSavedMi,
          profitDeltaUsd,
          narrative: option.narrative
        };
      })()
    : null;

  await repositories.loadAssignments.create({
    ...input,
    tripId,
    returnTripId,
    metadata: {
      outboundPayload,
      returnPayload,
      navProMode,
      warnings,
      economics: roundTripInsight ?? { oneWayProfitUsd }
    },
    scoreSnapshot,
    backhaulNarrative: roundTripInsight?.narrative ?? null,
    profitDeltaUsd: roundTripInsight?.profitDeltaUsd ?? null
  });

  await repositories.activeTripMirror.upsertMany([
    tripFromLoad({ tripId, driverId: input.driverId, loadId: load.loadId, load }),
    ...(returnLoad && returnTripId
      ? [tripFromLoad({ tripId: returnTripId, driverId: input.driverId, loadId: returnLoad.loadId, load: returnLoad })]
      : [])
  ]);

  await appendDecisionLog({
    actionType: returnTripId ? "dispatch_round_trip" : "dispatch_assignment",
    summary: returnTripId
      ? `Assigned ${load.loadId} and ${returnLoad?.loadId} to driver ${input.driverId}.`
      : `Assigned ${load.loadId} to driver ${input.driverId}.`,
    mathSummary:
      navProMode === "live"
        ? returnTripId
          ? "Round-trip dispatch created in NavPro."
          : "Outbound dispatch created in NavPro."
        : returnTripId
          ? "Round-trip mirrored locally after NavPro fallback."
          : "Outbound trip mirrored locally after NavPro fallback.",
    outcome:
      navProMode === "live"
        ? returnTripId
          ? "Round-trip created"
          : "Trip created"
        : returnTripId
          ? "Round-trip fallback"
          : "Trip fallback",
    tripId,
    driverId: input.driverId,
    ...(roundTripInsight
      ? {
          deadheadSavedMi: roundTripInsight.deadheadSavedMi ?? undefined,
          revenueRecoveredUsd: roundTripInsight.profitDeltaUsd
        }
      : {}),
    entityType: returnTripId ? "backhaul" : "assignment",
    source: "backend"
  });

  return {
    tripId,
    ...(returnTripId ? { returnTripId } : {}),
    navProMode,
    ...(warnings.length > 0 ? { warnings } : {})
  };
}
