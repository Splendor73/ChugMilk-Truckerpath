import type { DriverRecord } from "@/lib/mock-data/drivers";

import { StatusPill } from "@/components/ui/status-pill";

type DriverRankCardProps = {
  rank: number;
  driver: DriverRecord;
  fitScore: number;
  focusLoadReference: string;
  assignmentLoadReference: string | null;
  isRecommended?: boolean;
  className?: string;
};

export function DriverRankCard({
  rank,
  driver,
  fitScore,
  focusLoadReference,
  assignmentLoadReference,
  isRecommended,
  className,
}: DriverRankCardProps) {
  const assignmentTone = assignmentLoadReference
    ? assignmentLoadReference === focusLoadReference
      ? "success"
      : "warning"
    : "neutral";

  return (
    <article
      className={[
        "rounded-[24px] border p-4 shadow-[0_12px_40px_rgba(16,32,51,0.04)] transition-colors",
        isRecommended
          ? "border-[color:var(--color-shell-brand)] bg-[color:var(--color-shell-brand-soft)]/35"
          : "border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-shell-surface)] text-base font-semibold text-[color:var(--color-shell-text)]">
            {rank}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[color:var(--color-shell-text)]">{driver.name}</h3>
              {isRecommended ? <StatusPill tone="info">Best fit</StatusPill> : null}
              {assignmentLoadReference ? (
                <StatusPill tone={assignmentTone}>
                  {assignmentLoadReference === focusLoadReference ? "Assigned" : "Busy"}
                </StatusPill>
              ) : null}
            </div>

            <p className="text-sm text-[color:var(--color-shell-text-muted)]">
              {driver.unit} • {driver.equipment} • {driver.location}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-shell-text-muted)]">
            Fit score
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--color-shell-text)]">{fitScore}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-shell-text-muted)]">
            Hours remaining
          </p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--color-shell-text)]">
            {driver.hoursRemaining.toFixed(driver.hoursRemaining % 1 === 0 ? 0 : 1)}h
          </p>
        </div>

        <div className="rounded-[18px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-shell-text-muted)]">
            Current load
          </p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--color-shell-text)]">
            {assignmentLoadReference ?? "Open for assignment"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusPill tone="neutral">{driver.availability}</StatusPill>
        {assignmentLoadReference ? (
          <StatusPill tone={assignmentLoadReference === focusLoadReference ? "success" : "warning"}>
            {assignmentLoadReference === focusLoadReference
              ? `Assigned to ${assignmentLoadReference}`
              : `Busy with ${assignmentLoadReference}`}
          </StatusPill>
        ) : null}
      </div>
    </article>
  );
}
