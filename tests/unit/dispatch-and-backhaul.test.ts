import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

    expect(options).toHaveLength(3);
    expect(options.map((option) => option.returnLoad.loadId)).toEqual(["TL-BH-01", "TL-BH-02", "TL-BH-03"]);
    expect(options[0]?.oneWayProfitUsd).toBe(2100);
    expect(options[0]?.roundTripProfitUsd).toBe(4800);
    expect(options[0]?.totalDeadheadMiles).toBe(85);
  });
});
