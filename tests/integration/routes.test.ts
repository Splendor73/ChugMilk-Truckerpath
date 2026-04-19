import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetServerEnvForTests } from "@/config/env.server";
import {
  fleetSnapshotSchema,
  assignmentResponseSchema,
  interventionDraftSchema,
  routeDeskItemSchema,
  routeDeskResponseSchema
} from "@/shared/schemas/contracts";
import { getDb } from "@/server/db/client";
import { GET as getFleetSnapshotRoute } from "@/app/api/fleet/snapshot/route";
import { POST as createAssignmentRoute } from "@/app/api/fleet/assignments/route";
import { GET as getRoutesRoute, POST as createRouteDeskRoute } from "@/app/api/routes/route";
import { DELETE as deleteRouteDeskRoute, PATCH as patchRouteDeskRoute } from "@/app/api/routes/[tripId]/route";
import { POST as simulateRoute } from "@/app/api/dev/simulate/route";
import { GET as monitorFeedRoute } from "@/app/api/monitor/feed/route";
import { POST as executeInterventionRoute } from "@/app/api/monitor/interventions/execute/route";
import { POST as monitorTickRoute } from "@/app/api/monitor/tick/route";
import { POST as agentRoute } from "@/app/api/agent/route";
import { POST as voiceSpeakRoute } from "@/app/api/voice/speak/route";
import { resetDemoRuntimeForTests } from "@/server/runtime/demo-runtime";

import { bootstrapBackendTests, closeDatabase, readJson, readSse } from "../helpers/backend";

describe.sequential("backend routes", () => {
  beforeAll(async () => {
    await bootstrapBackendTests();
  });

  beforeEach(async () => {
    await bootstrapBackendTests();
    resetDemoRuntimeForTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("returns a schema-valid fleet snapshot", async () => {
    const response = await getFleetSnapshotRoute();
    const payload = await readJson<unknown>(response);
    const snapshot = fleetSnapshotSchema.parse(payload);
    const mike = snapshot.drivers.find((driver) => driver.driverId === 101);
    const samTrip = snapshot.activeTrips.find((trip) => trip.tripId === "TRIP-ACT3");

    expect(snapshot.drivers.length).toBeGreaterThanOrEqual(15);
    expect(snapshot.pendingLoads.length).toBeGreaterThan(0);
    expect(snapshot.sourceMode).toBe("synthetic");
    expect(snapshot.morningBrief.readyCount).toBe(14);
    expect(snapshot.morningBrief.restSoonCount).toBe(3);
    expect(snapshot.morningBrief.complianceFlagCount).toBe(2);
    expect(snapshot.morningBrief.inMaintenanceCount).toBe(1);
    expect(mike?.currentMarket).toMatchObject({ city: "Phoenix", state: "AZ" });
    expect(mike?.operationalStatus).toBe("available");
    expect(mike?.performanceScore).toBeGreaterThan(90);
    expect(mike?.recentTrips).toEqual([]);
    expect(samTrip?.destination).toMatchObject({ city: "Phoenix", state: "AZ" });
    expect(samTrip?.routeContext).toContain("Los Angeles");
    expect(samTrip?.remainingMiles).toBeGreaterThan(150);
  });

  it("creates a round-trip assignment and persists audit rows", async () => {
    const request = new Request("http://localhost/api/fleet/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId: 101,
        loadId: "TL-DEMO-01",
        returnLoadId: "TL-BH-01"
      })
    });

    const response = await createAssignmentRoute(request);
    const payload = assignmentResponseSchema.parse(await readJson<unknown>(response));
    const db = getDb();
    const assignments = await db.loadAssignment.findMany();
    const logs = await db.decisionLog.findMany();
    const mirroredTrips = await db.activeTripMirror.findMany();

    expect(payload.tripId).toBeTruthy();
    expect(payload.returnTripId).toBeTruthy();
    expect(payload.navProMode).toBe("synthetic");
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.scoreSnapshotJson).toBeTruthy();
    expect(assignments[0]?.backhaulNarrative).toContain("85 total deadhead miles");
    expect(assignments[0]?.profitDeltaUsd).toBeGreaterThan(0);
    expect(logs.some((row) => row.actionType === "dispatch_round_trip")).toBe(true);
    expect(logs.some((row) => (row.revenueRecoveredUsd ?? 0) > 0)).toBe(true);
    expect(mirroredTrips.some((trip) => trip.tripId === payload.tripId)).toBe(true);
    expect(mirroredTrips.some((trip) => trip.tripId === payload.returnTripId)).toBe(true);
  });

  it("creates, lists, and deletes db-backed routes from the route desk api", async () => {
    const createRequest = new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId: 101,
        loadId: "TL-DEMO-01",
        status: "on_track"
      })
    });

    const createResponse = await createRouteDeskRoute(createRequest);
    const createdRoute = routeDeskItemSchema.parse(await readJson<unknown>(createResponse));

    expect(createdRoute.driverId).toBe(101);
    expect(createdRoute.loadId).toBe("TL-DEMO-01");
    expect(createdRoute.routeContext).toContain("Phoenix");

    const listResponse = await getRoutesRoute();
    const listPayload = routeDeskResponseSchema.parse(await readJson<unknown>(listResponse));

    expect(listPayload.routes.some((route) => route.tripId === createdRoute.tripId)).toBe(true);

    const snapshotResponse = await getFleetSnapshotRoute();
    const snapshot = fleetSnapshotSchema.parse(await readJson<unknown>(snapshotResponse));

    expect(snapshot.activeTrips.some((trip) => trip.tripId === createdRoute.tripId)).toBe(true);

    const deleteResponse = await deleteRouteDeskRoute(new Request(`http://localhost/api/routes/${createdRoute.tripId}`, {
      method: "DELETE"
    }), {
      params: { tripId: createdRoute.tripId }
    });
    const deletePayload = await readJson<{ ok: boolean; tripId: string }>(deleteResponse);

    expect(deletePayload.ok).toBe(true);
    expect(deletePayload.tripId).toBe(createdRoute.tripId);
    expect(await getDb().activeTripMirror.findUnique({ where: { tripId: createdRoute.tripId } })).toBeNull();
  });

  it("patches an existing route's status, ETA and current GPS via the route desk api", async () => {
    const createResponse = await createRouteDeskRoute(
      new Request("http://localhost/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: 101,
          loadId: "TL-DEMO-01",
          status: "on_track"
        })
      })
    );
    const created = routeDeskItemSchema.parse(await readJson<unknown>(createResponse));

    const newEtaMs = created.etaMs + 90 * 60 * 1000;
    const patchResponse = await patchRouteDeskRoute(
      new Request(`http://localhost/api/routes/${created.tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "eta_slip",
          etaMs: newEtaMs,
          currentLoc: { lat: 34.5, lng: -112.1 }
        })
      }),
      { params: { tripId: created.tripId } }
    );

    const updated = routeDeskItemSchema.parse(await readJson<unknown>(patchResponse));

    expect(updated.tripId).toBe(created.tripId);
    expect(updated.status).toBe("eta_slip");
    expect(updated.etaMs).toBe(newEtaMs);
    expect(updated.currentLoc.lat).toBeCloseTo(34.5, 4);
    expect(updated.currentLoc.lng).toBeCloseTo(-112.1, 4);

    const persisted = await getDb().activeTripMirror.findUnique({ where: { tripId: created.tripId } });
    expect(persisted?.status).toBe("eta_slip");
    expect(Number(persisted?.etaMs)).toBe(newEtaMs);
    expect(persisted?.currentLat).toBeCloseTo(34.5, 4);
    expect(persisted?.currentLng).toBeCloseTo(-112.1, 4);
  });

  it("rejects empty PATCH bodies for the route desk api", async () => {
    const createResponse = await createRouteDeskRoute(
      new Request("http://localhost/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: 101, loadId: "TL-DEMO-01" })
      })
    );
    const created = routeDeskItemSchema.parse(await readJson<unknown>(createResponse));

    const patchResponse = await patchRouteDeskRoute(
      new Request(`http://localhost/api/routes/${created.tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }),
      { params: { tripId: created.tripId } }
    );

    expect(patchResponse.status).toBeGreaterThanOrEqual(400);
  });

  it("simulates an Act 3 breakdown and drafts one intervention", async () => {
    const simulateRequest = new Request("http://localhost/api/dev/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: "TRIP-ACT3",
        scenario: "breakdown"
      })
    });

    await simulateRoute(simulateRequest);
    const monitorResponse = await monitorTickRoute();
    const payload = await readJson<{ interventionsCreated: number }>(monitorResponse);
    const db = getDb();
    const drafts = await db.interventionDraft.findMany();

    // Baseline demo seed ships 2 non-on_track trips (TRIP-ACT3 long_idle
    // and TRIP-ACT5 eta_slip), so the first monitoring tick after reset
    // drafts an intervention for each. The simulate call above only
    // layers a `breakdown` override onto TRIP-ACT3 — both drafts still
    // show up because eta_slip is part of the baseline dataset.
    expect(payload.interventionsCreated).toBe(2);
    expect(drafts).toHaveLength(2);
    const act3Draft = drafts.find((draft) => draft.tripId === "TRIP-ACT3");
    expect(act3Draft).toBeDefined();
    expect(interventionDraftSchema.parse({
      tripId: act3Draft?.tripId,
      trigger: act3Draft?.trigger,
      customerSms: act3Draft?.customerSms,
      relayDriverId: act3Draft?.relayDriverId,
      relayDriverName: act3Draft?.relayDriverName,
      relayDistanceMi: act3Draft?.relayDistanceMi,
      rerouteNeeded: act3Draft?.rerouteNeeded,
      voiceScript: act3Draft?.voiceScript,
      createdAtMs: act3Draft?.createdAt.getTime()
    }).trigger).toBe("long_idle");
    const act5Draft = drafts.find((draft) => draft.tripId === "TRIP-ACT5");
    expect(act5Draft?.trigger).toBe("eta_slip");
    // The two drafts must use distinct copy styles so the "AI voice
    // variety" story stays visible in the UI.
    expect(act3Draft?.customerSms).not.toEqual(act5Draft?.customerSms);
    expect(act3Draft?.voiceScript).not.toEqual(act5Draft?.voiceScript);
  });

  it("surfaces monitoring feed rows and executes an intervention", async () => {
    const simulateRequest = new Request("http://localhost/api/dev/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: "TRIP-ACT3",
        scenario: "breakdown"
      })
    });

    await simulateRoute(simulateRequest);
    await monitorTickRoute();

    const feedResponse = await monitorFeedRoute();
    const feed = await readJson<{
      drafts: Array<{ id: string; tripId: string }>;
      decisionLog: Array<{ actionType: string }>;
      metrics: { deadheadSavedMi: number };
    }>(feedResponse);

    // Feed includes both baseline alerts (TRIP-ACT3 + TRIP-ACT5). The
    // voice + execute flow below is scoped to the TRIP-ACT3 breakdown
    // draft specifically.
    expect(feed.drafts).toHaveLength(2);
    const act3Draft = feed.drafts.find((draft) => draft.tripId === "TRIP-ACT3");
    expect(act3Draft).toBeDefined();
    expect(feed.drafts.some((draft) => draft.tripId === "TRIP-ACT5")).toBe(true);
    expect(feed.decisionLog[0]?.actionType).toBe("intervention_drafted");

    const voiceRequest = new Request("http://localhost/api/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: act3Draft?.id,
        text: "Maria, truck 14 has stopped outside Barstow."
      })
    });

    const voiceResponse = await voiceSpeakRoute(voiceRequest);
    const audioSource = voiceResponse.headers.get("X-Audio-Source");
    const draftAfterVoice = await getDb().interventionDraft.findUnique({ where: { id: act3Draft?.id } });

    const executeRequest = new Request("http://localhost/api/monitor/interventions/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: act3Draft?.id,
        matchedCommand: "execute"
      })
    });

    const executeResponse = await executeInterventionRoute(executeRequest);
    const executePayload = await readJson<{ ok: boolean; draftId: string }>(executeResponse);
    const db = getDb();
    const updatedDraft = await db.interventionDraft.findUnique({ where: { id: executePayload.draftId } });
    const logs = await db.decisionLog.findMany({ orderBy: { createdAt: "desc" } });
    const mirroredTrip = await db.activeTripMirror.findUnique({ where: { tripId: "TRIP-ACT3" } });

    expect(executePayload.ok).toBe(true);
    expect(audioSource).toBeTruthy();
    expect(draftAfterVoice?.audioSource).toBe(audioSource);
    expect(updatedDraft?.audioSource).toBe(audioSource);
    expect(updatedDraft?.status).toBe("executed");
    expect(updatedDraft?.matchedCommand).toBe("execute");
    expect(mirroredTrip?.status).toBe("on_track");
    expect(mirroredTrip?.overrideReason).toBe("relay_executed");
    expect(logs.some((row) => row.actionType === "voice_alert_played")).toBe(true);
    expect(logs.some((row) => row.actionType === "intervention_executed")).toBe(true);
    expect(logs.some((row) => (row.timeSavedMin ?? 0) > 0)).toBe(true);
  });

  it("resets persisted demo state when simulate reset is requested", async () => {
    const assignmentRequest = new Request("http://localhost/api/fleet/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId: 101,
        loadId: "TL-DEMO-01",
        returnLoadId: "TL-BH-01"
      })
    });

    await createAssignmentRoute(assignmentRequest);

    const resetRequest = new Request("http://localhost/api/dev/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset"
      })
    });

    const resetResponse = await simulateRoute(resetRequest);
    const payload = await readJson<{ ok: boolean }>(resetResponse);
    const db = getDb();

    expect(payload.ok).toBe(true);
    expect(await db.loadAssignment.count()).toBe(0);
    expect(await db.activeTripMirror.count()).toBe(0);
    expect(await db.decisionLog.count()).toBe(0);
    expect(await db.interventionDraft.count()).toBe(0);
  });

  it("clears synthetic demo persistence on the first api request after a restart", async () => {
    const assignmentRequest = new Request("http://localhost/api/fleet/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId: 101,
        loadId: "TL-DEMO-01",
        returnLoadId: "TL-BH-01"
      })
    });

    const assignmentResponse = await createAssignmentRoute(assignmentRequest);
    const assignment = assignmentResponseSchema.parse(await readJson<unknown>(assignmentResponse));

    const db = getDb();
    expect(await db.loadAssignment.count()).toBe(1);

    resetDemoRuntimeForTests();

    const snapshotResponse = await getFleetSnapshotRoute();
    const snapshot = fleetSnapshotSchema.parse(await readJson<unknown>(snapshotResponse));

    expect(snapshot.sourceMode).toBe("synthetic");
    expect(await db.loadAssignment.count()).toBe(0);
    expect(await db.decisionLog.count()).toBe(0);
    expect(await db.interventionDraft.count()).toBe(0);
    expect(snapshot.activeTrips.some((trip) => trip.tripId === assignment.tripId)).toBe(false);
  });

  it("streams SSE events in tool-call to final order", async () => {
    const request = new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage: "Need a load from PHX to SFO tomorrow 8am, dry van, $3200."
      })
    });

    const response = await agentRoute(request);
    const events = await readSse(response);
    const types = events.map((event) => event.type);

    expect(types[0]).toBe("tool_call");
    expect(types).toContain("tool_result");
    expect(types).toContain("token");
    expect(types.at(-1)).toBe("final");
  });

  it("wires LLM load extraction through the backend agent route when model keys exist", async () => {
    process.env.GROQ_API_KEY = "test-groq-key";
    process.env.GEMINI_API_KEY = "";
    resetServerEnvForTests();

    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("api.groq.com/openai/v1/chat/completions")) {
        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  origin_city: "Phoenix",
                  origin_state: "AZ",
                  destination_city: "Denver",
                  destination_state: "CO",
                  pickup_day_offset: 1,
                  pickup_hour_24: 8,
                  pickup_minute: 0,
                  pickup_window_hours: 4,
                  rate_usd: 3200,
                  weight_lbs: 38000,
                  commodity: "Dry Van",
                  customer: "Echo Global"
                })
              }
            }
          ]
        });
      }

      return originalFetch(input as RequestInfo | URL, init);
    };

    try {
      const request = new Request("http://localhost/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: "Echo Global can pay $3,200 on a dry van with 38,000 lbs from Phoenix over to Denver tomorrow at 8am."
        })
      });

      const response = await agentRoute(request);
      const events = await readSse(response);
      const final = events.at(-1);

      expect(final?.type).toBe("final");
      expect(final?.payload?.parsedLoad?.destination?.city).toBe("Denver");
      expect(final?.payload?.parsedLoad?.customer).toBe("Echo Global");
      expect(final?.payload?.parsedLoad?.commodity).toBe("Dry Van");
    } finally {
      global.fetch = originalFetch;
      process.env.GROQ_API_KEY = "";
      process.env.GEMINI_API_KEY = "";
      resetServerEnvForTests();
    }
  });

  it("returns a grounded refusal when no safe demo assignment exists", async () => {
    process.env.USE_SYNTHETIC_NAVPRO = "false";
    process.env.USE_NAVPRO_MOCK = "false";
    process.env.NAVPRO_CLIENT_ID = "live-demo";
    process.env.NAVPRO_JWT = "live-demo";
    resetServerEnvForTests();

    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/driver/query")) {
        return Response.json({
          data: [
            {
              driver_id: 1,
              basic_info: { driver_first_name: "V", driver_last_name: "J", driver_phone_number: "1111111111" },
              driver_location: { last_known_location: "Phoenix, Phoenix, AZ", latest_update: Date.now() }
            }
          ]
        });
      }
      if (url.includes("/api/driver/performance/query")) {
        return Response.json({ data: { hos_remaining_min: 480 } });
      }
      if (url.includes("/api/tracking/get/driver-dispatch")) {
        return Response.json({ data: { points: [{ lat: 33.4484, lng: -112.074, time: Date.now() }] } });
      }
      if (url.includes("/api/trip/query") || url.includes("/api/trip/list")) {
        return Response.json({ data: [] });
      }
      if (url.includes("/api/routing-profile/list")) {
        return Response.json({ data: [{ id: 123 }] });
      }
      return originalFetch(input as RequestInfo | URL, init);
    };

    try {
      const request = new Request("http://localhost/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: "Phoenix to San Francisco dry van load. Pickup today 1pm. Rate $3,200. Weight 38,000 lbs."
        })
      });

      const response = await agentRoute(request);
      const events = await readSse(response);
      const final = events.at(-1);

      expect(final?.type).toBe("final");
      expect(final?.payload.text).toContain("No safe driver is available");
      expect(final?.payload.text).toContain("V J:");
    } finally {
      global.fetch = originalFetch;
      process.env.USE_SYNTHETIC_NAVPRO = "true";
      process.env.USE_NAVPRO_MOCK = "true";
      process.env.NAVPRO_CLIENT_ID = "";
      process.env.NAVPRO_JWT = "";
      resetServerEnvForTests();
    }
  });
});
