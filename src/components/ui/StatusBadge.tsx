import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * StatusBadge — "Renk noktada, metin her zaman --ut-text".
 * Aktif aşama tek dolu amber rozettir; diğer durumlar %10–12 renk tonu üzerinde koyu metin kullanır.
 */
export type BadgeTone = "active" | "success" | "queued" | "warning" | "info" | "danger";

const toneClass: Record<BadgeTone, { wrap: string; dot: string }> = {
  active: { wrap: "bg-ut-accent text-ut-text", dot: "bg-ut-text" },
  success: { wrap: "bg-ut-success-tint text-ut-text", dot: "bg-ut-success" },
  queued: { wrap: "border border-ut-border bg-ut-bg text-ut-text-muted", dot: "bg-ut-border" },
  warning: { wrap: "bg-ut-warning-tint text-ut-text", dot: "bg-ut-warning" },
  info: { wrap: "bg-ut-info-tint text-ut-text", dot: "bg-ut-info" },
  danger: { wrap: "bg-ut-danger-tint text-ut-text", dot: "bg-ut-danger" },
};

export function StatusBadge({
  tone,
  children,
  size = "md",
  className,
}: {
  tone: BadgeTone;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = toneClass[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold",
        size === "md" ? "h-7 px-3 text-[13px]" : "h-[26px] px-2.5 text-[13px]",
        t.wrap,
        className,
      )}
    >
      <span className={cn("rounded-full", size === "md" ? "size-2" : "size-[7px]", t.dot)} aria-hidden="true" />
      {children}
    </span>
  );
}
