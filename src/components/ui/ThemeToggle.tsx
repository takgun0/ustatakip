"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { saveTheme, watchSystemTheme, type Theme } from "@/lib/theme";
import { IconMoon, IconSun } from "./icons";

/** <html data-theme> değişimlerine abone olur (aynı sayfadaki birden çok düğme eş kalsın) */
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/**
 * Açık / koyu tema düğmesi. İkon CSS ile seçilir (dark: varyantı), böylece sunucu çıktısıyla
 * ilk boyama uyuşur; aria-pressed hidrasyondan sonra gerçek değeri alır.
 * tone="onDark": mor hero / koyu başlık üzerinde.
 */
export function ThemeToggle({ tone = "default", className }: { tone?: "default" | "onDark"; className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  useEffect(() => watchSystemTheme(() => {}), []);
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => saveTheme(dark ? "light" : "dark")}
      aria-pressed={dark}
      aria-label="Koyu mod"
      title={dark ? "Açık temaya geç" : "Koyu temaya geç"}
      className={cn(
        "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 transition",
        tone === "onDark"
          ? "bg-white/10 text-white hover:bg-white/20"
          : "bg-transparent text-ut-text-muted hover:bg-ut-primary-soft hover:text-ut-primary",
        className,
      )}
    >
      <IconMoon size={20} className="dark:hidden" />
      <IconSun size={20} className="hidden dark:block" />
    </button>
  );
}
