import type { BackhaulOption, Driver, Load } from "@/shared/contracts";
import { findLoadById, searchLoadsNearRoute } from "@/server/core/load-board";
import { buildBackhaulOption } from "@/features/backhaul/server/backhaul-economics";

export async function findBackhauls(input: {
  outbound: Load;
  driver: Driver;
  returnWindowHours: number;
}): Promise<BackhaulOption[]> {
  const outbound = input.outbound;
  const demoCandidateIds = ["TL-BH-01", "TL-BH-02", "TL-BH-03"];
  const candidates =
    outbound.loadId === "TL-DEMO-01"
      ? demoCandidateIds
          .map((loadId) => findLoadById(loadId))
          .filter((load): load is Load => Boolean(load))
      : searchLoadsNearRoute(
          outbound.destination,
          input.driver.homeBase,
          outbound.pickupEndMs,
          {
            maxResults: 10,
            destinationNear: { ...input.driver.homeBase, radiusMiles: 100 },
            excludeLoadIds: [outbound.loadId],
            pickupWithinHours: input.returnWindowHours
          }
        );

  return candidates
    .map((returnLoad) =>
      buildBackhaulOption({
        outbound,
        returnLoad,
        homeBase: input.driver.homeBase,
        hosRemainingMin: input.driver.hosRemainingMin
      })
    )
    .sort((left, right) => right.roundTripProfitUsd - left.roundTripProfitUsd)
    .slice(0, 3);
}

export async function getBackhaulOptions(input: { outboundLoadId: string; driverId: number }) {
  const outbound = findLoadById(input.outboundLoadId);
  if (!outbound) {
    throw new Error(`Unknown outbound load: ${input.outboundLoadId}`);
  }

  const { getFleetSnapshot } = await import("@/features/fleet/server/get-fleet-snapshot");
  const snapshot = await getFleetSnapshot();
  const driver = snapshot.drivers.find((item) => item.driverId === input.driverId);

  if (!driver) {
    throw new Error(`Unknown driver: ${input.driverId}`);
  }

  return findBackhauls({ outbound, driver, returnWindowHours: 48 });
}
