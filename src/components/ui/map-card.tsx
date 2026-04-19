"use client";

import { useId } from "react";

type MapCardProps = {
  title: string;
  description: string;
  status: string;
  route: string;
  summary: string;
  mapId?: string;
  origin: {
    label: string;
    detail: string;
  };
  destination: {
    label: string;
    detail: string;
  };
  stats: Array<{
    label: string;
    value: string;
  }>;
  className?: string;
};

export function MapCard({
  title,
  description,
  status,
  route,
  summary,
  mapId,
  origin,
  destination,
  stats,
  className,
}: MapCardProps) {
  const generatedId = useId().replace(/:/g, "");
  const gradientId = `${mapId ?? generatedId}-route-line`;

  return (
    <section
      className={[
        "overflow-hidden rounded-[28px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] shadow-[0_18px_60px_rgba(16,32,51,0.05)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
              {title}
            </p>
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--color-shell-text)]">{route}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                {description}
              </p>
            </div>
          </div>

          <div className="rounded-full border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-brand-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--color-shell-brand)]">
            {status}
          </div>
        </div>

        <p className="max-w-3xl text-sm leading-6 text-[color:var(--color-shell-text)]">{summary}</p>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-[260px] overflow-hidden rounded-[26px] border border-[color:var(--color-shell-border)] bg-[linear-gradient(180deg,#f8fbff_0%,#edf4fb_100%)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,78,216,0.14),transparent_28%),radial-gradient(circle_at_75%_35%,rgba(15,118,110,0.11),transparent_24%),radial-gradient(circle_at_65%_80%,rgba(30,78,216,0.08),transparent_28%)]" />
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(16,32,51,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,32,51,0.04) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />

            <svg
              viewBox="0 0 480 240"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(30,78,216,0.55)" />
                  <stop offset="100%" stopColor="rgba(15,118,110,0.65)" />
                </linearGradient>
              </defs>
              <path
                d="M 72 170 C 132 134, 160 112, 215 116 S 321 126, 370 88 S 424 66, 428 56"
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M 72 170 C 132 134, 160 112, 215 116 S 321 126, 370 88 S 424 66, 428 56"
                fill="none"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.5"
                strokeDasharray="6 10"
              />
              <circle cx="72" cy="170" r="10" fill="white" />
              <circle cx="72" cy="170" r="5" fill="rgba(30,78,216,0.85)" />
              <circle cx="428" cy="56" r="10" fill="white" />
              <circle cx="428" cy="56" r="5" fill="rgba(15,118,110,0.9)" />
              <circle cx="214" cy="116" r="7" fill="rgba(16,32,51,0.18)" />
              <circle cx="318" cy="126" r="7" fill="rgba(16,32,51,0.18)" />
            </svg>

            <div className="absolute left-6 top-6 rounded-2xl border border-[color:var(--color-shell-border)] bg-[color:rgba(255,255,255,0.9)] px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                Origin
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--color-shell-text)]">{origin.label}</p>
              <p className="text-xs text-[color:var(--color-shell-text-muted)]">{origin.detail}</p>
            </div>

            <div className="absolute bottom-6 right-6 rounded-2xl border border-[color:var(--color-shell-border)] bg-[color:rgba(255,255,255,0.9)] px-4 py-3 text-right shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                Destination
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--color-shell-text)]">{destination.label}</p>
              <p className="text-xs text-[color:var(--color-shell-text-muted)]">{destination.detail}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                Situation
              </p>
              <p className="mt-3 text-base font-semibold text-[color:var(--color-shell-text)]">
                Route visibility for the morning desk
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{summary}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[22px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-shell-text-muted)]">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-base font-semibold text-[color:var(--color-shell-text)]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
