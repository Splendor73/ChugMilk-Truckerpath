import type { BackhaulRecord } from "@/lib/mock-data/backhaul";

import { StatusPill } from "@/components/ui/status-pill";

type EconomicsBlock = {
  label: string;
  revenue: string;
  deadheadMiles: string;
  margin: string;
  note: string;
};

type TripComparisonCardProps = {
  backhaul: BackhaulRecord;
  standard: EconomicsBlock;
  optimized: EconomicsBlock;
  lift: string;
  selected?: boolean;
  onPick: () => void;
  className?: string;
};

export function TripComparisonCard({
  backhaul,
  standard,
  optimized,
  lift,
  selected = false,
  onPick,
  className,
}: TripComparisonCardProps) {
  return (
    <article
      className={[
        "rounded-[26px] border p-5 shadow-[0_14px_48px_rgba(16,32,51,0.05)] transition-colors",
        selected
          ? "border-[color:var(--color-shell-brand)] bg-[linear-gradient(180deg,rgba(30,78,216,0.08),rgba(255,255,255,0.96))]"
          : "border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-[color:var(--color-shell-text)]">
              {backhaul.lane}
            </h3>
            <StatusPill tone={backhaul.status === "Recommended" ? "info" : backhaul.status === "Reserved" ? "warning" : "neutral"}>
              {backhaul.status}
            </StatusPill>
            {selected ? <StatusPill tone="success">Selected</StatusPill> : null}
          </div>

          <p className="text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
            {backhaul.origin} to {backhaul.destination} • {backhaul.pickupWindow}
          </p>
        </div>

        <button
          type="button"
          onClick={onPick}
          disabled={selected}
          className="rounded-full bg-[color:var(--color-shell-brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[color:var(--color-shell-surface-muted)] disabled:text-[color:var(--color-shell-text-muted)] disabled:opacity-100"
        >
          {selected ? "Selected" : "Pick backhaul"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[22px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
            {standard.label}
          </p>
          <div className="mt-4 space-y-3 text-sm text-[color:var(--color-shell-text-muted)]">
            <div className="flex items-center justify-between gap-3">
              <span>Revenue</span>
              <span className="font-semibold text-[color:var(--color-shell-text)]">{standard.revenue}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Empty miles</span>
              <span className="font-semibold text-[color:var(--color-shell-text)]">{standard.deadheadMiles}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Net margin</span>
              <span className="font-semibold text-[color:var(--color-shell-text)]">{standard.margin}</span>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{standard.note}</p>
        </div>

        <div className="rounded-[22px] border border-[color:var(--color-shell-border)] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
            {optimized.label}
          </p>
          <div className="mt-4 space-y-3 text-sm text-[color:var(--color-shell-text-muted)]">
            <div className="flex items-center justify-between gap-3">
              <span>Revenue</span>
              <span className="font-semibold text-[color:var(--color-shell-text)]">{optimized.revenue}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Deadhead miles</span>
              <span className="font-semibold text-[color:var(--color-shell-text)]">{optimized.deadheadMiles}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Net margin</span>
              <span className="font-semibold text-[color:var(--color-shell-text)]">{optimized.margin}</span>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{optimized.note}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-shell-text-muted)]">
            Uplift
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--color-shell-text)]">
            {lift} additional margin from a paired return leg
          </p>
        </div>
        <p className="text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{backhaul.notes}</p>
      </div>
    </article>
  );
}
