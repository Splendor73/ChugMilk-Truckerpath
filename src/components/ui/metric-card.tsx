type MetricTone = "blue" | "teal" | "amber" | "rose";

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  delta?: string;
  tone?: MetricTone;
  className?: string;
};

const toneClasses: Record<MetricTone, string> = {
  blue: "bg-[linear-gradient(180deg,rgba(30,78,216,0.14),rgba(30,78,216,0.04))] text-[color:var(--color-shell-brand)]",
  teal: "bg-[linear-gradient(180deg,rgba(15,118,110,0.16),rgba(15,118,110,0.05))] text-[color:var(--color-shell-accent)]",
  amber: "bg-[linear-gradient(180deg,rgba(217,119,6,0.16),rgba(217,119,6,0.05))] text-[#9a5800]",
  rose: "bg-[linear-gradient(180deg,rgba(190,24,93,0.15),rgba(190,24,93,0.05))] text-[#9f1239]",
};

export function MetricCard({ label, value, detail, delta, tone = "blue", className }: MetricCardProps) {
  return (
    <article
      className={[
        "relative overflow-hidden rounded-[24px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`absolute inset-y-0 left-0 w-1.5 rounded-r-full ${toneClasses[tone]}`} />

      <div className="pl-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
              {label}
            </p>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--color-shell-text)]">
              {value}
            </div>
            {detail ? (
              <p className="mt-2 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{detail}</p>
            ) : null}
          </div>

          {delta ? (
            <div className="rounded-full border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--color-shell-text)]">
              {delta}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
