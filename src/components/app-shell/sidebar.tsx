import Link from "next/link";

import { getWorkflow, type WorkflowId, workflows } from "@/lib/navigation/workflows";

type SidebarProps = {
  currentWorkflow: WorkflowId;
};

export function Sidebar({ currentWorkflow }: SidebarProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-6 py-6 shadow-[0_24px_80px_rgba(16,32,51,0.06)]">
      <div className="mb-8">
        <div className="text-sm font-semibold tracking-[0.24em] text-[color:var(--color-shell-brand)] uppercase">
          Co-Dispatch
        </div>
        <div className="mt-2 text-lg font-semibold text-[color:var(--color-shell-text)]">
          Fleet Operations
        </div>
      </div>

      <nav aria-label="Workflow navigation" className="flex flex-1 flex-col gap-2">
        {workflows.map((workflow) => {
          const active = workflow.id === currentWorkflow;

          return (
            <Link
              key={workflow.id}
              aria-current={active ? "page" : undefined}
              href={workflow.href}
              className={[
                "rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                active
                  ? "bg-[color:var(--color-shell-brand-soft)] text-[color:var(--color-shell-brand)]"
                  : "text-[color:var(--color-shell-text-muted)] hover:bg-[color:var(--color-shell-surface-muted)] hover:text-[color:var(--color-shell-text)]",
              ].join(" ")}
            >
              {workflow.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href={getWorkflow("load-assignment")?.href ?? "/load-assignment"}
        className="mt-8 rounded-2xl bg-[color:var(--color-shell-brand)] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        Dispatch New Load
      </Link>
    </aside>
  );
}
