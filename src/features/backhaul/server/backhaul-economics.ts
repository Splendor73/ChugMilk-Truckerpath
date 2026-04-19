import { seededBackhaulScenarios } from "../../../../data/demo/backhaul-scenarios";
import type { BackhaulOption, Load } from "@/shared/contracts";
import { haversineMiles } from "@/shared/utils/geo";

const COST_PER_MILE = 0.65;

type Coordinates = { lat: number; lng: number; city?: string };

function routeMiles(load: Load) {
  return haversineMiles(load.origin.lat, load.origin.lng, load.destination.lat, load.destination.lng);
}

function getSeededScenario(outboundLoadId: string, returnLoadId: string) {
  return (
    seededBackhaulScenarios.find(
      (scenario) => scenario.outboundLoadId === outboundLoadId && scenario.returnLoadId === returnLoadId
    ) ?? null
  );
}

export function buildBackhaulOption(input: {
  outbound: Load;
  returnLoad: Load;
  homeBase: Coordinates;
  hosRemainingMin: number;
}): BackhaulOption {
  const deadheadToReturn = haversineMiles(
    input.outbound.destination.lat,
    input.outbound.destination.lng,
    input.returnLoad.origin.lat,
    input.returnLoad.origin.lng
  );
  const deadheadHome = haversineMiles(
    input.returnLoad.destination.lat,
    input.returnLoad.destination.lng,
    input.homeBase.lat,
    input.homeBase.lng
  );
  const totalDeadheadMiles = deadheadToReturn + deadheadHome;
  const outboundMiles = routeMiles(input.outbound);
  const returnMiles = routeMiles(input.returnLoad);
  const oneWayProfitUsd = input.outbound.rateUsd - outboundMiles * COST_PER_MILE;
  const roundTripProfitUsd =
    input.outbound.rateUsd +
    input.returnLoad.rateUsd -
    (outboundMiles + returnMiles + totalDeadheadMiles) * COST_PER_MILE;
  const combinedRequiredMin = ((outboundMiles + returnMiles + totalDeadheadMiles) / 60) * 60;

  const scenario = getSeededScenario(input.outbound.loadId, input.returnLoad.loadId);

  return {
    outbound: input.outbound,
    returnLoad: input.returnLoad,
    totalRevenueUsd: input.outbound.rateUsd + input.returnLoad.rateUsd,
    totalDeadheadMiles: scenario?.totalDeadheadMiles ?? Math.round(totalDeadheadMiles * 10) / 10,
    roundTripProfitUsd: scenario?.roundTripProfitUsd ?? Math.round(roundTripProfitUsd),
    oneWayProfitUsd: scenario?.oneWayProfitUsd ?? Math.round(oneWayProfitUsd),
    hosFeasible: input.hosRemainingMin >= combinedRequiredMin,
    narrative:
      scenario?.narrative ??
      `${input.outbound.destination.city} -> ${input.returnLoad.destination.city} -> ${input.homeBase.city ?? "home base"}, ${Math.round(totalDeadheadMiles)} total deadhead miles`
  };
}
