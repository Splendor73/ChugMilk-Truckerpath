import { StatusPill } from "@/components/ui/status-pill";

type BreakdownItem = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "negative";
};

type ScoreBreakdownCardProps = {
  title: string;
  driverName: string;
  loadReference: string;
  score: number;
  breakdown: BreakdownItem[];
  className?: string;
};

const toneClasses: Record<BreakdownItem["tone"], string> = {
  neutral: "bg-[color:var(--color-shell-surface-muted)] text-[color:var(--color-shell-text)]",
  positive: "bg-[rgba(15,118,110,0.12)] text-[color:var(--color-shell-accent)]",
  negative: "bg-[rgba(190,24,93,0.12)] text-[#9f1239]",
};

export function ScoreBreakdownCard({
  title,
  driverName,
  loadReference,
  score,
  breakdown,
  className,
}: ScoreBreakdownCardProps) {
  return (
    <article
      className={[
        "rounded-[28px] border border-[color:var(--color-shell-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f3f7fc_100%)] p-6 shadow-[0_18px_60px_rgba(16,32,51,0.05)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
          {title}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-[color:var(--color-shell-text)]">
              {driverName}
            </h3>
            <p className="mt-1 text-sm text-[color:var(--color-shell-text-muted)]">Against {loadReference}</p>
          </div>

          <div className="rounded-[20px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-shell-text-muted)]">
              Total fit
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-[color:var(--color-shell-text)]">{score}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {breakdown.map((item) => (
          <div
            key={item.label}
            className="rounded-[22px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[color:var(--color-shell-text)]">{item.label}</p>
                <p className="text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{item.detail}</p>
              </div>
              <StatusPill tone={item.tone === "positive" ? "success" : item.tone === "negative" ? "critical" : "neutral"}>
                {item.value}
              </StatusPill>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--color-shell-surface-muted)]">
              <div
                className={[
                  "h-full rounded-full",
                  item.tone === "positive"
                    ? "bg-[color:var(--color-shell-accent)]"
                    : item.tone === "negative"
                      ? "bg-[#be185d]"
                      : "bg-[color:var(--color-shell-brand)]",
                ].join(" ")}
                style={{ width: item.tone === "neutral" ? "55%" : item.tone === "positive" ? "80%" : "38%" }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
