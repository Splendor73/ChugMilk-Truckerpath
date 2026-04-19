"use client";

import type { ReactNode } from "react";

type InterventionPackageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  status?: ReactNode;
  summaryLabel: string;
  summary: string;
  supportingStats: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  steps: Array<{
    label: string;
    detail: string;
  }>;
  className?: string;
};

export function InterventionPackageCard({
  eyebrow,
  title,
  description,
  status,
  summaryLabel,
  summary,
  supportingStats,
  steps,
  className,
}: InterventionPackageCardProps) {
  return (
    <section
      className={[
        "rounded-[28px] border border-[color:var(--color-shell-border)] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] p-6 shadow-[0_18px_60px_rgba(16,32,51,0.05)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
              {eyebrow}
            </p>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[color:var(--color-shell-text)]">{title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                {description}
              </p>
            </div>
          </div>

          {status ? <div className="shrink-0">{status}</div> : null}
        </div>

        <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
            {summaryLabel}
          </p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--color-shell-text)]">{summary}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {supportingStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[22px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-shell-text-muted)]">
                  {stat.label}
                </p>
                <p className="mt-3 text-base font-semibold text-[color:var(--color-shell-text)]">{stat.value}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className="flex gap-4 rounded-[22px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-shell-brand-soft)] font-semibold text-[color:var(--color-shell-brand)]">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[color:var(--color-shell-text)]">{step.label}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
