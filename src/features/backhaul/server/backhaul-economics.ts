import { seededBackhaulScenarios } from "../../../../data/demo/backhaul-scenarios";
import type { BackhaulOption, Load } from "@/shared/contracts";
import { haversineMiles } from "@/shared/utils/geo";

const COST_PER_MILE = 0.65;
// Same average highway speed assumption used by score-load.ts so HOS math stays
// consistent across single-leg dispatch and round-trip backhaul scoring.
const AVG_SPEED_MPH = 70;
// Per-stop dwell buffer (minutes) for pickup/drop on both the outbound and
// the return leg. 4 stops * 30 min = 120 min of non-driving on-duty time.
const STOP_BUFFER_MIN = 30;
const STOP_COUNT = 4;

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
  const totalRoundTripMiles = outboundMiles + returnMiles + totalDeadheadMiles;
  const oneWayProfitUsd = input.outbound.rateUsd - outboundMiles * COST_PER_MILE;
  const roundTripProfitUsd =
    input.outbound.rateUsd + input.returnLoad.rateUsd - totalRoundTripMiles * COST_PER_MILE;

  // Drive minutes for the full PHX -> SFO -> backhaul -> home loop, plus a
  // fixed dwell buffer for pickup/drop on each leg so HOS feasibility reflects
  // realistic on-duty time, not just steering-wheel time.
  const driveMin = (totalRoundTripMiles / AVG_SPEED_MPH) * 60;
  const hosRequiredMin = Math.round(driveMin + STOP_BUFFER_MIN * STOP_COUNT);
  const hosBufferMin = input.hosRemainingMin - hosRequiredMin;
  const hosFeasible = hosBufferMin >= 0;

  const scenario = getSeededScenario(input.outbound.loadId, input.returnLoad.loadId);

  return {
    outbound: input.outbound,
    returnLoad: input.returnLoad,
    totalRevenueUsd: input.outbound.rateUsd + input.returnLoad.rateUsd,
    totalDeadheadMiles: scenario?.totalDeadheadMiles ?? Math.round(totalDeadheadMiles * 10) / 10,
    roundTripProfitUsd: scenario?.roundTripProfitUsd ?? Math.round(roundTripProfitUsd),
    oneWayProfitUsd: scenario?.oneWayProfitUsd ?? Math.round(oneWayProfitUsd),
    hosFeasible,
    hosRequiredMin,
    hosAvailableMin: input.hosRemainingMin,
    hosBufferMin,
    narrative:
      scenario?.narrative ??
      `${input.outbound.destination.city} -> ${input.returnLoad.destination.city} -> ${input.homeBase.city ?? "home base"}, ${Math.round(totalDeadheadMiles)} total deadhead miles`
  };
}
