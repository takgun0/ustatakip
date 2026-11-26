/**
 * E6 analiz hesapları (saf fonksiyonlar). Kaynak: public.analytics_stage_durations görünümü
 * (her aşama kaydının süresi; RLS ile yalnızca esnafın kendi işleri).
 *
 * "Kaybedilen süre": bir aşamadaki her ziyarette, o aşamanın medyan süresinin üstünde geçen
 * kısmın toplamı. Tipik süreyi aşan bekleme, darboğazı gösterir; uzun ama hep aynı süren bir
 * aşama (ör. boya kuruması) kayıp sayılmaz.
 */

export type DurationRow = {
  event_id: string;
  job_id: string;
  template_id: string;
  stage_id: string;
  stage_name: string;
  stage_position: number;
  stage_color: string;
  entered_at: string;
  left_at: string | null;
  is_open: boolean;
  seconds: number;
};

export type StageStat = {
  stageId: string;
  name: string;
  position: number;
  color: string;
  visits: number;
  /** Şu an bu aşamada bekleyen iş sayısı */
  openNow: number;
  /** Tamamlanmış ziyaretlerin ortalaması; tamamlanan yoksa null */
  avgSeconds: number | null;
  medianSeconds: number | null;
  maxSeconds: number;
  totalSeconds: number;
  lostSeconds: number;
};

export const PERIODS = [
  { value: "7", label: "Son 7 gün", days: 7 },
  { value: "30", label: "Son 30 gün", days: 30 },
  { value: "90", label: "Son 90 gün", days: 90 },
  { value: "all", label: "Tüm zamanlar", days: null },
] as const;
export type PeriodValue = (typeof PERIODS)[number]["value"];

export function periodStart(value: PeriodValue, now: Date = new Date()): Date | null {
  const p = PERIODS.find((x) => x.value === value);
  return p?.days ? new Date(now.getTime() - p.days * 86_400_000) : null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Dönemdeki aşama istatistikleri (aşama sırasına göre). Dönem: aşamaya giriş zamanı `since`
 * sonrasında olan ziyaretler; şu an açık olan ziyaretler her zaman dahildir.
 */
export function stageStats(rows: DurationRow[], since: Date | null = null): StageStat[] {
  const inPeriod = rows.filter((r) => r.is_open || !since || new Date(r.entered_at) >= since);
  const groups = new Map<string, DurationRow[]>();
  for (const r of inPeriod) {
    const list = groups.get(r.stage_id) ?? [];
    list.push(r);
    groups.set(r.stage_id, list);
  }
  const out: StageStat[] = [];
  for (const [stageId, list] of groups) {
    const closed = list.filter((r) => !r.is_open).map((r) => r.seconds);
    const med = median(closed);
    const first = list[0]!;
    out.push({
      stageId,
      name: first.stage_name,
      position: first.stage_position,
      color: first.stage_color,
      visits: list.length,
      openNow: list.filter((r) => r.is_open).length,
      avgSeconds: closed.length ? Math.round(closed.reduce((a, b) => a + b, 0) / closed.length) : null,
      medianSeconds: med == null ? null : Math.round(med),
      maxSeconds: Math.max(...list.map((r) => r.seconds)),
      totalSeconds: list.reduce((a, r) => a + r.seconds, 0),
      lostSeconds: med == null ? 0 : Math.round(list.reduce((a, r) => a + Math.max(0, r.seconds - med), 0)),
    });
  }
  return out.sort((a, b) => a.position - b.position);
}

/** En çok süre kaybedilen aşama; kayıp yoksa null */
export function bottleneck(stats: StageStat[]): StageStat | null {
  return stats.reduce<StageStat | null>((best, s) => (s.lostSeconds > 0 && (!best || s.lostSeconds > best.lostSeconds) ? s : best), null);
}

/** Teklif kabul oranı (%) — sonuçlanan (kabul + ret) teklifler üzerinden; yoksa null */
export function acceptanceRate(accepted: number, rejected: number): number | null {
  const decided = accepted + rejected;
  return decided ? Math.round((accepted / decided) * 100) : null;
}
