import type { ReactNode } from "react";

type StatusTone = "neutral" | "info" | "success" | "warning" | "critical";

type StatusPillProps = {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
};

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-[color:var(--color-shell-surface-muted)] text-[color:var(--color-shell-text)]",
  info: "bg-[color:var(--color-shell-brand-soft)] text-[color:var(--color-shell-brand)]",
  success: "bg-[rgba(15,118,110,0.12)] text-[color:var(--color-shell-accent)]",
  warning: "bg-[rgba(217,119,6,0.12)] text-[#9a5800]",
  critical: "bg-[rgba(190,24,93,0.12)] text-[#9f1239]",
};

export function StatusPill({ tone = "neutral", children, className }: StatusPillProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]",
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
