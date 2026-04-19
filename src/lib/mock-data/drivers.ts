export type DriverAvailability = "Available Now" | "In Transit" | "Resting" | "Needs Review" | "Assigned";

export type DriverRecord = {
  id: string;
  name: string;
  unit: string;
  equipment: string;
  availability: DriverAvailability;
  score: number;
  location: string;
  hoursRemaining: number;
  homeTerminal: string;
  currentLoadId: string | null;
};

export const drivers: DriverRecord[] = [
  {
    id: "driver-marcus",
    name: "Marcus Johnson",
    unit: "#302",
    equipment: "Reefer",
    availability: "Assigned",
    score: 98,
    location: "Kansas City, MO",
    hoursRemaining: 9.5,
    homeTerminal: "Kansas City Hub",
    currentLoadId: "load-chi-dal-7841",
  },
  {
    id: "driver-sarah",
    name: "Sarah Jenkins",
    unit: "#118",
    equipment: "Dry Van",
    availability: "In Transit",
    score: 84,
    location: "Little Rock, AR",
    hoursRemaining: 6.75,
    homeTerminal: "Springfield Yard",
    currentLoadId: "load-mem-den-5129",
  },
  {
    id: "driver-omar",
    name: "Omar Ruiz",
    unit: "#421",
    equipment: "Reefer",
    availability: "Resting",
    score: 91,
    location: "Atlanta, GA",
    hoursRemaining: 11,
    homeTerminal: "Atlanta Crossdock",
    currentLoadId: null,
  },
  {
    id: "driver-lexi",
    name: "Lexi Carter",
    unit: "#205",
    equipment: "Dry Van",
    availability: "In Transit",
    score: 89,
    location: "Phoenix, AZ",
    hoursRemaining: 10.25,
    homeTerminal: "Phoenix Depot",
    currentLoadId: "load-phx-las-9014",
  },
];
