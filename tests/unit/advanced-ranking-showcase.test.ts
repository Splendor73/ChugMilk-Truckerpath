import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { advancedRankingShowcaseResponseSchema } from "@/shared/schemas/contracts";
import { getAdvancedRankingShowcase } from "@/features/dispatch/server/advanced-ranking-showcase";
import { GET as advancedRankingRoute } from "@/app/api/demo/advanced-ranking/route";

import { bootstrapBackendTests, closeDatabase, readJson } from "../helpers/backend";

describe.sequential("advanced ranking showcase", () => {
  beforeAll(async () => {
    await bootstrapBackendTests();
  });

  beforeEach(async () => {
    await bootstrapBackendTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("ranks Mike first and exposes the extra showcase parameters", async () => {
    const payload = await getAdvancedRankingShowcase();

    expect(payload.rankedDrivers[0]?.driverName).toBe("Mike Chen");
    expect(payload.rankedDrivers[0]?.recommended).toBe(true);

    const jake = payload.rankedDrivers.find((driver) => driver.driverName === "Jake Morrison");
    expect(jake?.eliminated).toBe(true);
    expect(jake?.eliminationReason).toContain("HOS shortfall");

    const luis = payload.rankedDrivers.find((driver) => driver.driverName === "Luis Ortega");
    expect(luis?.breakdown.some((item) => item.key === "poi")).toBe(true);
    expect(luis?.breakdown.some((item) => item.key === "pod")).toBe(true);
    expect(luis?.breakdown.some((item) => item.key === "bol")).toBe(true);
    expect(luis?.breakdown.some((item) => item.key === "eld")).toBe(true);
  });

  it("serves the showcase through the public demo route", async () => {
    const response = await advancedRankingRoute();
    const payload = advancedRankingShowcaseResponseSchema.parse(await readJson<unknown>(response));

    expect(payload.load.loadId).toBe("TL-DEMO-01");
    expect(payload.rankedDrivers).toHaveLength(6);
    expect(payload.rankedDrivers[1]?.driverName).toBe("Kevin Walsh");
  });
});
