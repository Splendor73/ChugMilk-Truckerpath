import Link from "next/link";

import { getWorkflow, type WorkflowId, workflows } from "@/lib/navigation/workflows";

type SidebarProps = {
  currentWorkflow: WorkflowId;
};

export function Sidebar({ currentWorkflow }: SidebarProps) {
  return (
    <aside className="sticky top-0 z-40 flex w-full shrink-0 flex-col border-b border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)]/96 px-4 py-4 shadow-[0_24px_80px_rgba(16,32,51,0.06)] backdrop-blur lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
      <div className="mb-4 lg:mb-8">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-brand)]">
          Co-Dispatch
        </div>
        <div className="mt-2 text-lg font-semibold text-[color:var(--color-shell-text)]">Fleet Operations</div>
        <p className="mt-2 hidden text-sm leading-6 text-[color:var(--color-shell-text-muted)] lg:block">
          Keep the morning flow, load decisions, and return leg planning on one shared desk.
        </p>
      </div>

      <nav
        aria-label="Workflow navigation"
        className="flex flex-1 gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        {workflows.map((workflow) => {
          const active = workflow.id === currentWorkflow;

          return (
            <Link
              key={workflow.id}
              aria-current={active ? "page" : undefined}
              href={workflow.href}
              className={[
                "flex min-w-max items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-shell-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-shell-surface)] lg:min-w-0",
                active
                  ? "border-[color:var(--color-shell-brand)] bg-[linear-gradient(180deg,rgba(219,231,255,0.95),rgba(238,244,252,0.9))] text-[color:var(--color-shell-brand)] shadow-[0_12px_32px_rgba(30,78,216,0.08)]"
                  : "border-transparent text-[color:var(--color-shell-text-muted)] hover:border-[color:var(--color-shell-border)] hover:bg-[color:var(--color-shell-surface-muted)] hover:text-[color:var(--color-shell-text)]",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                  active ? "bg-[color:var(--color-shell-brand)]" : "bg-[color:var(--color-shell-border)]",
                ].join(" ")}
              />
              {workflow.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href={getWorkflow("load-assignment")?.href ?? "/load-assignment"}
        className="mt-4 rounded-2xl bg-[color:var(--color-shell-brand)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_32px_rgba(30,78,216,0.18)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-shell-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-shell-surface)] lg:mt-8"
      >
        Dispatch New Load
      </Link>
    </aside>
  );
}
