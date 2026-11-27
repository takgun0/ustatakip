import { cn } from "@/lib/cn";

/**
 * UstaTakip logosu: "U" biçiminde bir aşama yolu. Yolun geçilen kısmı beyaz, kalan kısmı soluk;
 * amber nokta işin şu an bulunduğu yer (kargo takibindeki "buradasınız"). Hem Usta'nın U'su
 * hem de aşamalı takip fikri. Sekme ikonu src/app/icon.svg ile aynı çizim.
 *
 * Gradyan zemin CSS'te, çizim satır içi SVG'de: sayfada birden fazla logo olduğunda
 * çakışan <defs> kimlikleri olmasın diye SVG'de gradyan tanımı yok.
 */
export function BrandMark({
  tone = "onDark",
  size = 36,
  className,
}: {
  tone?: "onDark" | "onLight";
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[28%] bg-linear-to-br from-[#6366F1] to-[#3730A3]",
        tone === "onDark"
          ? "shadow-[0_4px_14px_-2px_rgba(15,23,42,.45)] ring-1 ring-white/30"
          : "shadow-[0_4px_12px_-2px_rgba(79,70,229,.45)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        focusable="false"
      >
        <path
          d="M20 14v20a12 12 0 0 0 24 0V14"
          stroke="#fff"
          strokeOpacity=".32"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M20 14v20a12 12 0 0 0 20.49 8.49"
          stroke="#fff"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle
          cx="40.49"
          cy="42.49"
          r="7.5"
          fill="#F59E0B"
          stroke="#3F37C9"
          strokeWidth="3.5"
        />
      </svg>
    </span>
  );
}
