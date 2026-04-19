"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type MockDataStore = {
  assignedDriverId: string | null;
  selectedBackhaulId: string | null;
  assignDriver: (driverId: string) => void;
  selectBackhaul: (backhaulId: string) => void;
};

const MockDataContext = createContext<MockDataStore | null>(null);

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [assignedDriverId, setAssignedDriverId] = useState<string | null>("driver-marcus");
  const [selectedBackhaulId, setSelectedBackhaulId] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      assignedDriverId,
      selectedBackhaulId,
      assignDriver: setAssignedDriverId,
      selectBackhaul: setSelectedBackhaulId,
    }),
    [assignedDriverId, selectedBackhaulId],
  );

  return <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>;
}

export function useMockData() {
  const value = useContext(MockDataContext);

  if (!value) {
    throw new Error("useMockData must be used within MockDataProvider");
  }

  return value;
}

export type { MockDataStore };
