"use client";

import type { ReactNode } from "react";

import type { WorkstationStage } from "@/lib/navigation/workstation";

import { TopBar } from "./top-bar";

type AppShellProps = {
  currentStage: WorkstationStage;
  currentDeskPanel: "drivers" | "routes";
  activeNavItem: WorkstationStage | "drivers" | "routes";
  liveSummary: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onDeskPanelChange: (panel: "drivers" | "routes") => void;
  onStageChange: (stage: WorkstationStage) => void;
  children: ReactNode;
};

export function AppShell({
  currentStage,
  currentDeskPanel,
  activeNavItem,
  liveSummary,
  isRefreshing,
  onRefresh,
  onDeskPanelChange,
  onStageChange,
  children
}: AppShellProps) {
  return (
    <div className="bg-shell h-screen overflow-hidden">
      <div className="flex h-screen w-full flex-col">
        <TopBar
          currentStage={currentStage}
          currentDeskPanel={currentDeskPanel}
          activeNavItem={activeNavItem}
          liveSummary={liveSummary}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          onDeskPanelChange={onDeskPanelChange}
          onStageChange={onStageChange}
        />

        <main className="min-h-0 flex-1 overflow-hidden px-3 py-4 sm:px-4 lg:px-5 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
