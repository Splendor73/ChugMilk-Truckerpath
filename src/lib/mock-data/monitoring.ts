export type MonitoringSeverity = "Critical" | "Warning" | "Watch";

export type MonitoringRecord = {
  id: string;
  severity: MonitoringSeverity;
  title: string;
  route: string;
  eta: string;
  driverId: string;
  loadId: string;
  customer: string;
  status: string;
  recommendedAction: string;
  detail: string;
};

export const monitoring: MonitoringRecord[] = [
  {
    id: "monitor-8492",
    severity: "Critical",
    title: "Route Deviation Detected",
    route: "Phoenix, AZ -> Las Vegas, NV",
    eta: "ETA risk: +48 min",
    driverId: "driver-lexi",
    loadId: "load-phx-las-9014",
    customer: "Silverline Retail",
    status: "Intervention package ready",
    recommendedAction: "Dispatch relay support before the driver reaches the next weigh station.",
    detail: "Lexi Carter is drifting off the planned Phoenix-to-Las Vegas corridor, putting the retail appointment window at risk.",
  },
  {
    id: "monitor-8810",
    severity: "Warning",
    title: "Temperature Drift Watch",
    route: "Chicago, IL -> Dallas, TX",
    eta: "ETA risk: +12 min",
    driverId: "driver-marcus",
    loadId: "load-chi-dal-7841",
    customer: "Northline Foods",
    status: "Cooling trend observed",
    recommendedAction: "Ask the driver to verify reefer setpoint on the next stop.",
    detail: "The reefer telematics on the Chicago-to-Dallas produce run show a mild swing but not yet a customer-facing failure.",
  },
  {
    id: "monitor-9055",
    severity: "Watch",
    title: "Customer Appointment Tightening",
    route: "Memphis, TN -> Denver, CO",
    eta: "ETA risk: +20 min",
    driverId: "driver-sarah",
    loadId: "load-mem-den-5129",
    customer: "Delta Paper",
    status: "Appointment moved up",
    recommendedAction: "Confirm dock availability and prep the consignee for a narrow arrival window.",
    detail: "A receiving clerk called ahead to request an earlier check-in if the truck clears the scale house.",
  },
];
