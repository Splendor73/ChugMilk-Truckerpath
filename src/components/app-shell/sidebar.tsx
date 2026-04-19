"use client";

import {
  isWorkstationStageActive,
  workstationShellStages,
  type WorkstationStage
} from "@/lib/navigation/workstation";

type SidebarProps = {
  currentStage: WorkstationStage;
  onStageChange: (stage: WorkstationStage) => void;
  onPrimaryAction: () => void;
};

export function Sidebar({ currentStage, onStageChange, onPrimaryAction }: SidebarProps) {
  return (
    <aside className="sticky top-0 z-40 flex w-full shrink-0 flex-col border-b border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)]/96 px-4 py-4 shadow-[0_24px_80px_rgba(16,32,51,0.06)] backdrop-blur lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
      <nav
        aria-label="Workflow navigation"
        className="flex flex-1 gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pt-2 lg:pb-0"
      >
        {workstationShellStages.map((workflow) => {
          const active = isWorkstationStageActive(currentStage, workflow.stage);

          return (
            <button
              key={workflow.stage}
              type="button"
              aria-pressed={active}
              onClick={() => onStageChange(workflow.stage)}
              className={[
                "flex min-w-max items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-shell-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-shell-surface)] lg:min-w-0",
                active
                  ? "border-[color:var(--color-shell-brand)] bg-[linear-gradient(180deg,rgba(219,231,255,0.95),rgba(238,244,252,0.9))] text-[color:var(--color-shell-brand)] shadow-[0_12px_32px_rgba(30,78,216,0.08)]"
                  : "border-transparent text-[color:var(--color-shell-text-muted)] hover:border-[color:var(--color-shell-border)] hover:bg-[color:var(--color-shell-surface-muted)] hover:text-[color:var(--color-shell-text)]"
              ].join(" ")}
            >
              <span
                className={[
                  "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                  active ? "bg-[color:var(--color-shell-brand)]" : "bg-[color:var(--color-shell-border)]"
                ].join(" ")}
              />
              <span>{workflow.shellLabel}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onPrimaryAction}
        className="mt-4 rounded-2xl bg-[color:var(--color-shell-brand)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_32px_rgba(30,78,216,0.18)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-shell-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-shell-surface)] lg:mt-8"
      >
        Dispatch New Load
      </button>
    </aside>
  );
}
