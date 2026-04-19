export type LoadStatus = "Awaiting Assignment" | "Assigned" | "In Transit" | "Risk Flagged";

export type LoadRecord = {
  id: string;
  reference: string;
  customer: string;
  origin: string;
  destination: string;
  pickupWindow: string;
  equipment: string;
  weight: string;
  rate: string;
  margin: string;
  distanceMiles: number;
  status: LoadStatus;
  assignedDriverId: string | null;
  recommendedDriverId: string;
  notes: string;
};

export const loads: LoadRecord[] = [
  {
    id: "load-chi-dal-7841",
    reference: "CHI-DAL-7841",
    customer: "Northline Foods",
    origin: "Chicago, IL",
    destination: "Dallas, TX",
    pickupWindow: "Today, 14:00 CST",
    equipment: "Reefer",
    weight: "42,000 lbs",
    rate: "$4,800",
    margin: "$1,350",
    distanceMiles: 967,
    status: "Assigned",
    assignedDriverId: "driver-marcus",
    recommendedDriverId: "driver-marcus",
    notes: "High-priority produce load with a strict pickup window and dock detention risk.",
  },
  {
    id: "load-mem-den-5129",
    reference: "MEM-DEN-5129",
    customer: "Delta Paper",
    origin: "Memphis, TN",
    destination: "Denver, CO",
    pickupWindow: "Today, 16:30 CST",
    equipment: "Dry Van",
    weight: "38,500 lbs",
    rate: "$3,950",
    margin: "$1,020",
    distanceMiles: 1128,
    status: "Assigned",
    assignedDriverId: "driver-sarah",
    recommendedDriverId: "driver-sarah",
    notes: "Freight is flexible, but the receiving appointment is fixed for early morning.",
  },
  {
    id: "load-atl-mco-3382",
    reference: "ATL-MCO-3382",
    customer: "Fresh Harbor",
    origin: "Atlanta, GA",
    destination: "Orlando, FL",
    pickupWindow: "Tomorrow, 09:00 EST",
    equipment: "Reefer",
    weight: "35,000 lbs",
    rate: "$2,900",
    margin: "$860",
    distanceMiles: 438,
    status: "Risk Flagged",
    assignedDriverId: null,
    recommendedDriverId: "driver-omar",
    notes: "Weather watch on the southeast corridor could slow the delivery by one to two hours.",
  },
  {
    id: "load-phx-las-9014",
    reference: "PHX-LAS-9014",
    customer: "Silverline Retail",
    origin: "Phoenix, AZ",
    destination: "Las Vegas, NV",
    pickupWindow: "Today, 18:15 MST",
    equipment: "Dry Van",
    weight: "29,400 lbs",
    rate: "$2,150",
    margin: "$640",
    distanceMiles: 301,
    status: "In Transit",
    assignedDriverId: "driver-lexi",
    recommendedDriverId: "driver-lexi",
    notes: "Short-haul retail replenishment with an overnight dock check-in at destination.",
  },
];
