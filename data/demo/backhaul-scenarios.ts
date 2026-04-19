export type SeededBackhaulScenario = {
  outboundLoadId: string;
  returnLoadId: string;
  oneWayProfitUsd: number;
  roundTripProfitUsd: number;
  totalDeadheadMiles: number;
  narrative: string;
};

export const seededBackhaulScenarios: SeededBackhaulScenario[] = [
  {
    outboundLoadId: "TL-DEMO-01",
    returnLoadId: "TL-BH-01",
    oneWayProfitUsd: 2100,
    roundTripProfitUsd: 4800,
    totalDeadheadMiles: 85,
    narrative: "SFO -> Las Vegas -> Phoenix, 85 total deadhead miles"
  }
];
