/**
 * Açık / koyu tema. Seçim localStorage'da tutulur; seçim yoksa cihazın ayarı izlenir.
 * Sayfa statik dışa aktarıldığı için tema, ilk boyamadan önce <head>'deki THEME_SCRIPT ile
 * <html data-theme> özniteliğine yazılır (beyaz parlama olmasın).
 */
export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "ut-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Kayıtlı seçim (yoksa null: cihaz ayarı geçerli) */
export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(stored: Theme | null, system: Theme): Theme {
  return stored ?? system;
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

/** Kullanıcı seçimi; cihaz ayarıyla aynıysa kayıt silinir ki ayar değişince tema da izlesin */
export function saveTheme(theme: Theme): void {
  try {
    if (theme === systemTheme()) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* gizli sekme: yalnızca bu sayfa için uygulanır */
  }
  applyTheme(theme);
}

/** Kayıtlı seçim yokken cihaz ayarı değişirse temayı izler; aboneliği kaldıran fonksiyon döner */
export function watchSystemTheme(onChange: (t: Theme) => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const mq = matchMedia(DARK_QUERY);
  const handler = () => {
    if (storedTheme()) return;
    const t = systemTheme();
    applyTheme(t);
    onChange(t);
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

/** İlk boyamadan önce çalışan satır içi betik (bağımlılıksız, hata yutar) */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("${DARK_QUERY}").matches?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t}catch(e){}})()`;

/** Koyu zeminde kaybolan aşama renkleri (lacivert, gri) globals.css'te temaya göre açılır */
const THEMED_STAGE_COLORS = new Set(["1e3a5f", "6b7280"]);

/** Aşama rengini CSS değerine çevirir: temalı renkler değişkene, diğerleri olduğu gibi */
export function stageColor(hex: string): string {
  const key = hex.replace(/^#/, "").toLowerCase();
  return THEMED_STAGE_COLORS.has(key) ? `var(--ut-stage-${key}, ${hex})` : hex;
}
