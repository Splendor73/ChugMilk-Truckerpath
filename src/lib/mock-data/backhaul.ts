export type BackhaulRecord = {
  id: string;
  lane: string;
  origin: string;
  destination: string;
  pickupWindow: string;
  revenue: string;
  deadheadMiles: number;
  estimatedMargin: string;
  matchScore: number;
  status: "Recommended" | "Available" | "Reserved";
  notes: string;
};

export const backhaul: BackhaulRecord[] = [
  {
    id: "backhaul-stl",
    lane: "St. Louis, MO -> Indianapolis, IN",
    origin: "St. Louis, MO",
    destination: "Indianapolis, IN",
    pickupWindow: "Today, 19:30 CST",
    revenue: "$2,100",
    deadheadMiles: 28,
    estimatedMargin: "$780",
    matchScore: 96,
    status: "Recommended",
    notes: "Dense freight corridor with minimal repositioning and a clean return to the Midwest network.",
  },
  {
    id: "backhaul-kc",
    lane: "Dallas, TX -> Oklahoma City, OK",
    origin: "Dallas, TX",
    destination: "Oklahoma City, OK",
    pickupWindow: "Today, 21:00 CST",
    revenue: "$1,680",
    deadheadMiles: 17,
    estimatedMargin: "$640",
    matchScore: 89,
    status: "Available",
    notes: "Solid fuel efficiency, but the window is tighter than the top recommendation.",
  },
  {
    id: "backhaul-mem",
    lane: "Orlando, FL -> Savannah, GA",
    origin: "Orlando, FL",
    destination: "Savannah, GA",
    pickupWindow: "Tomorrow, 08:30 EST",
    revenue: "$2,450",
    deadheadMiles: 53,
    estimatedMargin: "$905",
    matchScore: 92,
    status: "Reserved",
    notes: "High-value refrigerated return load tied to a premium grocery account.",
  },
];
