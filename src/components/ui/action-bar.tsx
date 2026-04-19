import type { ReactNode } from "react";

import { StatusPill } from "./status-pill";

type ActionBarProps = {
  eyebrow?: string;
  title: string;
  description: string;
  status?: ReactNode;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  feedback?: ReactNode;
  className?: string;
};

export function ActionBar({
  eyebrow,
  title,
  description,
  status,
  primaryAction,
  secondaryAction,
  feedback,
  className,
}: ActionBarProps) {
  return (
    <section
      className={[
        "rounded-[26px] border border-[color:var(--color-shell-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,243,249,0.96))] px-5 py-5 shadow-[0_18px_60px_rgba(16,32,51,0.05)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
              {eyebrow}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-[color:var(--color-shell-text)]">{title}</h3>
            {status ? (
              <span className="shrink-0">
                {typeof status === "string" ? <StatusPill>{status}</StatusPill> : status}
              </span>
            ) : null}
          </div>

          <p className="text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{description}</p>
          {feedback ? (
            <div
              role="status"
              aria-live="polite"
              className="pt-1 text-sm font-medium text-[color:var(--color-shell-text)]"
            >
              {feedback}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">{secondaryAction}{primaryAction}</div>
      </div>
    </section>
  );
}
