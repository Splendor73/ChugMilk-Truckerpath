"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { loads } from "./loads";

type MockDataStore = {
  assignedDriverId: string | null;
  selectedBackhaulId: string | null;
  loadAssignmentsById: Record<string, string | null>;
  assignDriver: (driverId: string) => void;
  assignLoad: (loadId: string, driverId: string) => void;
  selectBackhaul: (backhaulId: string) => void;
};

const MockDataContext = createContext<MockDataStore | null>(null);

function createInitialLoadAssignments() {
  return loads.reduce<Record<string, string | null>>((assignmentMap, load) => {
    assignmentMap[load.id] = load.assignedDriverId;
    return assignmentMap;
  }, {});
}

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [assignedDriverId, setAssignedDriverId] = useState<string | null>("driver-marcus");
  const [selectedBackhaulId, setSelectedBackhaulId] = useState<string | null>(null);
  const [loadAssignmentsById, setLoadAssignmentsById] = useState<Record<string, string | null>>(
    () => createInitialLoadAssignments(),
  );

  const assignLoad = useCallback((loadId: string, driverId: string) => {
    setLoadAssignmentsById((currentAssignments) => {
      const nextAssignments = { ...currentAssignments };

      for (const [currentLoadId, assignedDriverId] of Object.entries(nextAssignments)) {
        if (assignedDriverId === driverId) {
          nextAssignments[currentLoadId] = null;
        }
      }

      nextAssignments[loadId] = driverId;

      return nextAssignments;
    });
  }, []);

  const value = useMemo(
    () => ({
      assignedDriverId,
      selectedBackhaulId,
      loadAssignmentsById,
      assignDriver: setAssignedDriverId,
      assignLoad,
      selectBackhaul: setSelectedBackhaulId,
    }),
    [assignedDriverId, assignLoad, loadAssignmentsById, selectedBackhaulId],
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
