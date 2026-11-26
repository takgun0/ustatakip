const TZ = "Europe/Istanbul";

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "numeric", month: "short" });
const longFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "numeric", month: "long", weekday: "long" });
const monthFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, month: "long", year: "numeric" });

function daysBetween(a: Date, b: Date) {
  const ka = Date.parse(dayKey.format(a));
  const kb = Date.parse(dayKey.format(b));
  return Math.round((ka - kb) / 86_400_000);
}

/** "Bugün 15:20", "Dün 18:30", "24 Kas, 17:45" */
export function formatRelative(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = daysBetween(now, d);
  if (diff === 0) return `Bugün ${timeFmt.format(d)}`;
  if (diff === 1) return `Dün ${timeFmt.format(d)}`;
  return `${shortFmt.format(d).replace(".", "")}, ${timeFmt.format(d)}`;
}

/** "27 Kas, 18:00" ya da bugünse "Bugün, 19:00" (E2 teslim satırı) */
export function formatDue(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = daysBetween(d, now);
  if (diff === 0) return `Bugün, ${timeFmt.format(d)}`;
  if (diff === 1) return `Yarın, ${timeFmt.format(d)}`;
  return `${shortFmt.format(d).replace(".", "")}, ${timeFmt.format(d)}`;
}

/** "27 Kasım Cuma, 18:00" (M2 tahmini teslim) */
export function formatLong(iso: string): string {
  const d = new Date(iso);
  return `${longFmt.format(d)}, ${timeFmt.format(d)}`;
}

/** "Kasım 2026" */
export function formatMonth(iso: string): string {
  return monthFmt.format(new Date(iso));
}

/** "26 Kasım Perşembe" (E2 alt başlık) */
export function formatToday(now = new Date()): string {
  return longFmt.format(now);
}

/** Süre: "2 sa 15 dk", "3 gün 4 sa" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const mins = Math.floor((s % 3_600) / 60);
  if (days > 0) return hours ? `${days} gün ${hours} sa` : `${days} gün`;
  if (hours > 0) return mins ? `${hours} sa ${mins} dk` : `${hours} sa`;
  return `${Math.max(mins, s > 0 ? 1 : 0)} dk`;
}

/** <input type="datetime-local"> değeri → ISO (yerel saat) */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
