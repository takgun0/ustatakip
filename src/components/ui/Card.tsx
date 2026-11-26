import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Kart yüzeyi: beyaz, 1 px --ut-border, köşe 16 px, yumuşak katmanlı gölge. */
export function Card({
  as: Tag = "section",
  padding = "md",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" | "form"; padding?: "none" | "sm" | "md" | "lg" }) {
  return (
    <Tag
      className={cn(
        "rounded-ut-lg border border-ut-border/80 bg-ut-surface shadow-ut",
        padding === "sm" && "p-4",
        padding === "md" && "p-[18px]",
        padding === "lg" && "p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Kart başlığı: mobilde 17/700, esnaf ekranlarında 18–20/700 */
export function CardTitle({ children, size = "md", as: Tag = "h2", className }: { children: ReactNode; size?: "sm" | "md" | "lg"; as?: "h2" | "h3"; className?: string }) {
  return (
    <Tag className={cn("m-0 font-bold", size === "sm" && "text-[17px]", size === "md" && "text-lg", size === "lg" && "text-xl", className)}>
      {children}
    </Tag>
  );
}

/** "TAKİP KODU" gibi küçük büyük harf etiket */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("text-xs font-semibold tracking-[0.06em] text-ut-text-muted uppercase", className)}>{children}</span>
  );
}
