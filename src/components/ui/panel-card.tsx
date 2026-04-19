import type { ReactNode } from "react";

type PanelCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PanelCard({ title, description, action, children, className }: PanelCardProps) {
  return (
    <section
      className={[
        "rounded-[28px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-6 shadow-[0_18px_60px_rgba(16,32,51,0.05)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[color:var(--color-shell-text)]">{title}</h2>
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{description}</p>
          ) : null}
        </div>

        {action ? <div className="flex flex-wrap items-center gap-3">{action}</div> : null}
      </div>

      {children}
    </section>
  );
}
