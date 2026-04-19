import Link from "next/link";

import { getShellTopBarWorkflows, getWorkflow, type WorkflowId } from "@/lib/navigation/workflows";

type TopBarProps = {
  currentWorkflow: WorkflowId;
};

export function TopBar({ currentWorkflow }: TopBarProps) {
  const currentWorkflowLabel = getWorkflow(currentWorkflow)?.label ?? "Fleet Command";
  const topBarLinks = getShellTopBarWorkflows();

  return (
    <header className="flex flex-col gap-4 border-b border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-6 py-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--color-shell-text-muted)]">
            Fleet Command
          </div>
          <div className="mt-1 text-2xl font-semibold text-[color:var(--color-shell-text)]">
            {currentWorkflowLabel}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="hidden items-center gap-2 md:flex">
            {topBarLinks.map((workflow) => {
              const active = workflow.id === currentWorkflow;

              return (
                <Link
                  key={workflow.id}
                  aria-current={active ? "page" : undefined}
                  href={workflow.href}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[color:var(--color-shell-brand-soft)] text-[color:var(--color-shell-brand)]"
                      : "text-[color:var(--color-shell-text-muted)] hover:bg-[color:var(--color-shell-surface-muted)] hover:text-[color:var(--color-shell-text)]",
                  ].join(" ")}
                >
                  {workflow.label}
                </Link>
              );
            })}

          </div>

          <button
            type="button"
            className="rounded-full border border-[color:var(--color-shell-border)] px-4 py-2 text-sm font-semibold text-[color:var(--color-shell-text)]"
          >
            Go Live
          </button>
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] px-4 py-3 text-[color:var(--color-shell-text-muted)]">
        <span className="text-sm font-medium">Search loads, drivers</span>
        <input
          type="search"
          placeholder="Search loads, drivers"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[color:var(--color-shell-text)] outline-none placeholder:text-[color:var(--color-shell-text-muted)]"
        />
      </label>
    </header>
  );
}
