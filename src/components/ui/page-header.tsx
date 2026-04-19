import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <section
      className={[
        "rounded-[32px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-6 py-6 shadow-[0_24px_80px_rgba(16,32,51,0.06)] sm:px-8",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--color-shell-text-muted)]">
            <span className="rounded-full bg-[color:var(--color-shell-brand-soft)] px-3 py-1 text-[color:var(--color-shell-brand)]">
              {eyebrow}
            </span>
            {meta ? <span>{meta}</span> : null}
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--color-shell-text)] sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--color-shell-text-muted)] sm:text-base">
              {description}
            </p>
          </div>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
