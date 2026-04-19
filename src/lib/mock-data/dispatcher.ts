export type DispatcherProfile = {
  id: string;
  name: string;
  role: string;
  hub: string;
  shift: string;
  status: string;
  activeLoads: number;
  unreadAlerts: number;
  lastSyncedAt: string;
};

export const dispatcher: DispatcherProfile = {
  id: "dispatcher-mia",
  name: "Mia Torres",
  role: "Senior Dispatcher",
  hub: "Kansas City Hub",
  shift: "Day Shift",
  status: "Monitoring five live lanes",
  activeLoads: 12,
  unreadAlerts: 2,
  lastSyncedAt: "7:02 AM",
};
