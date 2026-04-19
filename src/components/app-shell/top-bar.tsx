"use client";

import { workstationTopBarStages, workstationStageLabels, type WorkstationStage } from "@/lib/navigation/workstation";

type TopBarProps = {
  currentStage: WorkstationStage;
  currentDeskPanel: "drivers" | "routes";
  activeNavItem: WorkstationStage | "drivers" | "routes";
  liveSummary: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onDeskPanelChange: (panel: "drivers" | "routes") => void;
  onStageChange: (stage: WorkstationStage) => void;
};

export function TopBar({
  currentStage,
  currentDeskPanel,
  activeNavItem,
  liveSummary,
  isRefreshing,
  onRefresh,
  onDeskPanelChange,
  onStageChange
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)]/96 px-3 py-4 backdrop-blur sm:px-4 lg:px-5">
      <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--color-shell-text-muted)]">
            co-dispach
          </div>
          <div className="mt-1 text-2xl font-semibold text-[color:var(--color-shell-text)]">
            {activeNavItem === "drivers"
              ? "Drivers"
              : activeNavItem === "routes"
                ? "Routes"
                : workstationStageLabels[currentStage]}
          </div>
          <div className="mt-1 text-sm text-[color:var(--color-shell-text-muted)]">{liveSummary}</div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 lg:col-start-2">
          {workstationTopBarStages.map((stage) => {
            const active = activeNavItem === stage;

            return (
              <button
                key={stage}
                type="button"
                onClick={() => onStageChange(stage)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-shell-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-shell-surface)]",
                  active
                    ? "border-[color:var(--color-shell-brand)] bg-[color:var(--color-shell-brand-soft)] text-[color:var(--color-shell-brand)] shadow-[0_10px_24px_rgba(30,78,216,0.08)]"
                    : "border-transparent text-[color:var(--color-shell-text-muted)] hover:border-[color:var(--color-shell-border)] hover:bg-[color:var(--color-shell-surface-muted)] hover:text-[color:var(--color-shell-text)]"
                ].join(" ")}
              >
                {workstationStageLabels[stage]}
              </button>
            );
          })}

          <div className="mx-1 h-8 w-px bg-[color:var(--color-shell-border)]" />

          {[
            { key: "drivers" as const, label: "Drivers" },
            { key: "routes" as const, label: "Routes" }
          ].map((panel) => {
            const active = activeNavItem === panel.key;

            return (
              <button
                key={panel.key}
                type="button"
                onClick={() => onDeskPanelChange(panel.key)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-shell-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-shell-surface)]",
                  active
                    ? "border-[color:var(--color-shell-brand)] bg-[color:var(--color-shell-brand-soft)] text-[color:var(--color-shell-brand)] shadow-[0_10px_24px_rgba(30,78,216,0.08)]"
                    : "border-transparent text-[color:var(--color-shell-text-muted)] hover:border-[color:var(--color-shell-border)] hover:bg-[color:var(--color-shell-surface-muted)] hover:text-[color:var(--color-shell-text)]"
                ].join(" ")}
              >
                {panel.label}
              </button>
            );
          })}
        </div>

        <div className="flex justify-start lg:justify-end lg:col-start-3">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--color-shell-text)] transition-colors hover:bg-[color:var(--color-shell-surface-muted)]"
          >
            {isRefreshing ? "Syncing..." : "Refresh"}
          </button>
        </div>
      </div>
    </header>
  );
}
