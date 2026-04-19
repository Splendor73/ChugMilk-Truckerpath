import Link from "next/link";

import { getShellTopBarWorkflows, getWorkflow, type WorkflowId } from "@/lib/navigation/workflows";

type TopBarProps = {
  currentWorkflow: WorkflowId;
};

export function TopBar({ currentWorkflow }: TopBarProps) {
  const currentWorkflowLabel = getWorkflow(currentWorkflow)?.label ?? "Fleet Command";
  const topBarLinks = getShellTopBarWorkflows();

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-4 border-b border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)]/96 px-4 py-4 backdrop-blur sm:px-6">
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
                    "rounded-full border px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-shell-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-shell-surface)]",
                    active
                      ? "border-[color:var(--color-shell-brand)] bg-[color:var(--color-shell-brand-soft)] text-[color:var(--color-shell-brand)] shadow-[0_10px_24px_rgba(30,78,216,0.08)]"
                      : "border-transparent text-[color:var(--color-shell-text-muted)] hover:border-[color:var(--color-shell-border)] hover:bg-[color:var(--color-shell-surface-muted)] hover:text-[color:var(--color-shell-text)]",
                  ].join(" ")}
                >
                  {workflow.label}
                </Link>
              );
            })}

          </div>

          <Link
            href="/proactive-monitoring"
            className="rounded-full border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--color-shell-text)] transition-colors hover:bg-[color:var(--color-shell-surface-muted)]"
          >
            Go Live
          </Link>
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] px-4 py-3 text-[color:var(--color-shell-text-muted)]">
        <span className="text-sm font-medium">Search loads, drivers</span>
        <input
          type="search"
          placeholder="Search loads, drivers"
          aria-label="Search loads and drivers"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[color:var(--color-shell-text)] outline-none placeholder:text-[color:var(--color-shell-text-muted)]"
        />
      </label>
    </header>
  );
}
