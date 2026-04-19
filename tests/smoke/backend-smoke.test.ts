import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { driverScoreSchema, backhaulOptionSchema, voiceListenResponseSchema } from "@/shared/schemas/contracts";
import { POST as scoreRoute } from "@/app/api/agent/score/route";
import { POST as backhaulRoute } from "@/app/api/agent/backhaul/route";
import { POST as speakRoute } from "@/app/api/voice/speak/route";
import { POST as listenRoute } from "@/app/api/voice/listen/route";
import { queryDrivers, queryDriverPerformance, getDriverDispatch, createTrip, getRoutingProfiles } from "@/server/integrations/navpro";
import { findLoadById } from "@/server/core/load-board";

import { bootstrapBackendTests, closeDatabase, readJson } from "../helpers/backend";

describe.sequential("backend smoke flows", () => {
  beforeAll(async () => {
    await bootstrapBackendTests();
  });

  beforeEach(async () => {
    await bootstrapBackendTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("scores the demo load through the public route contract", async () => {
    const load = findLoadById("TL-DEMO-01");
    expect(load).toBeTruthy();

    const request = new Request("http://localhost/api/agent/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ load })
    });

    const response = await scoreRoute(request);
    const payload = await readJson<unknown[]>(response);
    const scores = payload.map((item) => driverScoreSchema.parse(item));

    expect(scores[0]?.driverName).toBe("Mike Chen");
    expect(scores.find((score) => score.driverName === "Jake Morrison")?.eliminated).toBe(true);
  });

  it("returns three backhaul options through the public route contract", async () => {
    const request = new Request("http://localhost/api/agent/backhaul", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outboundLoadId: "TL-DEMO-01",
        driverId: 101
      })
    });

    const response = await backhaulRoute(request);
    const payload = await readJson<unknown[]>(response);
    const options = payload.map((item) => backhaulOptionSchema.parse(item));

    expect(options).toHaveLength(3);
    // With Mike's HOS bumped to 23h for the demo, BH-02 (shortest home
    // leg) wins the HOS-cushion tiebreak over the seeded BH-01. Assert
    // that the three expected loads are returned regardless of order so
    // the smoke check stays stable even if the tiebreak flips again.
    expect(options.map((option) => option.returnLoad.loadId).sort()).toEqual(["TL-BH-01", "TL-BH-02", "TL-BH-03"]);
  });

  it("falls back to cached audio and parses execute commands", async () => {
    const speakRequest = new Request("http://localhost/api/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Dispatch the relay plan."
      })
    });
    const speakResponse = await speakRoute(speakRequest);
    const audio = await speakResponse.arrayBuffer();

    expect(speakResponse.headers.get("X-Audio-Source")).toBe("fallback");
    expect(audio.byteLength).toBeGreaterThan(0);

    const listenRequest = new Request("http://localhost/api/voice/listen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: Buffer.from("Execute the relay plan now").toString("base64")
      })
    });
    const listenResponse = await listenRoute(listenRequest);
    const parsed = voiceListenResponseSchema.parse(await readJson<unknown>(listenResponse));

    expect(parsed.matchedCommand).toBe("execute");
    expect(parsed.transcript).toContain("Execute");
  });

  it("returns NavPro-shaped synthetic contracts for driver, performance, dispatch, routing, and trip create", async () => {
    const drivers = await queryDrivers();
    expect(drivers.code).toBe(200);
    expect(Array.isArray(drivers.data)).toBe(true);
    expect(drivers.data?.length).toBeGreaterThanOrEqual(15);
    expect(drivers.data?.[0]).toHaveProperty("driver_id");
    expect(drivers.data?.[0]).toHaveProperty("basic_info");

    const performance = await queryDriverPerformance(101);
    expect(performance.code).toBe(200);
    expect(performance.data?.[0]).toHaveProperty("actual_time");
    expect(performance.data?.[0]).toHaveProperty("schedule_miles");

    const dispatch = await getDriverDispatch(104);
    expect(dispatch.code).toBe(200);
    expect(dispatch.data?.points?.[0]).toHaveProperty("latitude");
    expect(dispatch.data?.active_trip).toHaveProperty("trip_id");

    const profiles = await getRoutingProfiles();
    expect(profiles.code).toBe(200);
    expect(profiles.data?.[0]).toHaveProperty("id");

    const trip = await createTrip({
      scheduled_start_time: "2026-04-19T16:00:00Z",
      driver_id: 101,
      routing_profile_id: 6831,
      trip_name: "TL-DEMO-01",
      stop_points: [
        {
          latitude: 33.4484,
          longitude: -112.074,
          address_name: "Phoenix, AZ",
          appointment_time: "2026-04-19T16:00:00Z",
          dwell_time: 30
        },
        {
          latitude: 37.7749,
          longitude: -122.4194,
          address_name: "San Francisco, CA",
          appointment_time: "2026-04-19T20:00:00Z",
          dwell_time: 0
        }
      ]
    });
    expect(trip.code).toBe(200);
    const tripId = typeof trip === "object" && trip !== null && "trip_id" in trip ? trip.trip_id : null;
    expect(typeof tripId).toBe("string");
  });
});
