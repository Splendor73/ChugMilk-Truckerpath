import { describe, expect, it } from "vitest";

import * as fleetSnapshotRoute from "@/app/api/fleet/snapshot/route";
import * as monitorFeedRoute from "@/app/api/monitor/feed/route";

describe("dynamic api routes", () => {
  it("marks the fleet snapshot route as force-dynamic", () => {
    expect(fleetSnapshotRoute.dynamic).toBe("force-dynamic");
  });

  it("marks the monitor feed route as force-dynamic", () => {
    expect(monitorFeedRoute.dynamic).toBe("force-dynamic");
  });
});
