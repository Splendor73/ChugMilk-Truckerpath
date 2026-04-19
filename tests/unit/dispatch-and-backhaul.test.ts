import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetServerEnvForTests } from "@/config/env.server";
import { parseLoadInput } from "@/features/dispatch/server/parse-load";
import { scoreLoad } from "@/features/dispatch/server/score-load";
import { getBackhaulOptions } from "@/features/backhaul/server/find-backhauls";
import { computeHOSStatus } from "@/features/fleet/server/get-fleet-snapshot";

import { bootstrapBackendTests, closeDatabase } from "../helpers/backend";

describe.sequential("dispatch and backhaul", () => {
  beforeAll(async () => {
    await bootstrapBackendTests();
  });

  beforeEach(async () => {
    await bootstrapBackendTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("computes HOS threshold states", () => {
    expect(computeHOSStatus(119)).toBe("must_rest");
    expect(computeHOSStatus(120)).toBe("low");
    expect(computeHOSStatus(359)).toBe("low");
    expect(computeHOSStatus(360)).toBe("fresh");
  });

  it("parses the PHX to SFO demo load from pasted text", async () => {
    const load = await parseLoadInput({
      userMessage: "Need a load from PHX to SFO tomorrow 8am, dry van, $3200."
    });

    expect(load.loadId).toBe("TL-DEMO-01");
    expect(load.source).toBe("paste");
    expect(load.origin.city).toBe("Phoenix");
    expect(load.destination.city).toBe("San Francisco");
  });

  it("parses natural broker-style text without choking on trailing words", async () => {
    const load = await parseLoadInput({
      userMessage: "Phoenix to San Francisco dry van load. Pickup today 1pm. Rate $3,200. Weight 38,000 lbs."
    });

    expect(load.origin.city).toBe("Phoenix");
    expect(load.destination.city).toBe("San Francisco");
    expect(load.rateUsd).toBe(3200);
  });

  it("parses a pasted Phoenix to Denver load instead of falling back to the demo lane", async () => {
    const load = await parseLoadInput({
      userMessage: "Phoenix to Denver dry van load. Pickup tomorrow 8am. Rate $3,200. Weight 38,000 lbs."
    });

    expect(load.origin.city).toBe("Phoenix");
    expect(load.destination.city).toBe("Denver");
    expect(load.destination.state).toBe("CO");
    expect(load.loadId).toContain("PASTE-AZ-CO-");
  });

  it("throws when an explicit route contains an unsupported city", async () => {
    await expect(
      parseLoadInput({
        userMessage: "Phoenix to Atlantis dry van load. Pickup tomorrow 8am. Rate $3,200."
      })
    ).rejects.toThrow("Could not resolve Atlantis");
  });

  it("uses the configured LLM extractor to fill broker fields before scoring", async () => {
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
      const load = await parseLoadInput({
        userMessage: "Echo Global can pay $3,200 on a dry van with 38,000 lbs from Phoenix over to Denver tomorrow at 8am."
      });

      expect(load.origin.city).toBe("Phoenix");
      expect(load.destination.city).toBe("Denver");
      expect(load.customer).toBe("Echo Global");
      expect(load.commodity).toBe("Dry Van");
      expect(load.weightLbs).toBe(38000);
      expect(load.rateUsd).toBe(3200);
    } finally {
      global.fetch = originalFetch;
      process.env.GROQ_API_KEY = "";
      process.env.GEMINI_API_KEY = "";
      resetServerEnvForTests();
    }
  });

  it("ranks Mike first and eliminates Jake for the demo load", async () => {
    const load = await parseLoadInput({
      userMessage: "Need a load from PHX to SFO tomorrow 8am, dry van, $3200."
    });
    const scores = await scoreLoad(load);

    expect(scores[0]?.driverName).toBe("Mike Chen");
    expect(scores[0]?.eliminated).toBe(false);
    expect(scores[0]?.score).toBeGreaterThan(0);

    const jake = scores.find((score) => score.driverName === "Jake Morrison");
    expect(jake?.eliminated).toBe(true);
    expect(jake?.eliminationReason).toContain("HOS:");
  });

  it("returns the seeded demo backhaul options with stable math", async () => {
    const options = await getBackhaulOptions({
      outboundLoadId: "TL-DEMO-01",
      driverId: 101
    });

    // Mike's HOS is now high enough (23h) that both BH-01 and BH-02 are
    // HOS-feasible for the round trip. The sort promotes BH-02 over BH-01
    // because its PHX return leg leaves a slightly bigger HOS cushion than
    // BH-01's Vegas detour, while BH-03 (Reno) still fails the HOS check
    // and lands last. We still assert the seeded BH-01 scenario math is
    // stable by finding it explicitly.
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.returnLoad.loadId)).toEqual(["TL-BH-02", "TL-BH-01", "TL-BH-03"]);
    const seededBh01 = options.find((option) => option.returnLoad.loadId === "TL-BH-01");
    expect(seededBh01?.oneWayProfitUsd).toBe(2100);
    expect(seededBh01?.roundTripProfitUsd).toBe(4800);
    expect(seededBh01?.totalDeadheadMiles).toBe(85);
  });
});
