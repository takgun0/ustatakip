import { cn } from "@/lib/cn";
import { IconWrench } from "./icons";

/** UstaTakip logosu: anahtar ikonu + amber nokta (design/E2 üst bar, Main başlık) */
export function BrandMark({ tone = "onDark", size = 36, className }: { tone?: "onDark" | "onLight"; size?: number; className?: string }) {
  const onDark = tone === "onDark";
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-[10px]",
        onDark ? "bg-white/15 text-white" : "bg-ut-primary text-white",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <IconWrench size={Math.round(size * 0.56)} />
      <span
        className={cn(
          "absolute -top-[3px] -right-[3px] size-[11px] rounded-full border-2 bg-ut-accent",
          onDark ? "border-ut-primary" : "border-ut-bg",
        )}
      />
    </span>
  );
}
