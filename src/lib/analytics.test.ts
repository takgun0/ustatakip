import { describe, expect, it } from "vitest";
import { acceptanceRate, bottleneck, median, periodStart, stageStats, type DurationRow } from "./analytics";

const H = 3600;
let n = 0;
const row = (stage: string, position: number, seconds: number, opts: Partial<DurationRow> = {}): DurationRow => ({
  event_id: `e${++n}`,
  job_id: `j${n}`,
  template_id: "t1",
  stage_id: stage,
  stage_name: stage.toUpperCase(),
  stage_position: position,
  stage_color: "#1E3A5F",
  entered_at: "2026-11-20T10:00:00Z",
  left_at: "2026-11-20T12:00:00Z",
  is_open: false,
  seconds,
  ...opts,
});

describe("median", () => {
  it("tek ve çift uzunlukta doğru", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("stageStats", () => {
  const rows = [
    row("b", 1, 2 * H),
    row("b", 1, 2 * H),
    row("b", 1, 10 * H), // medyan 2 sa → 8 sa kayıp
    row("a", 0, 1 * H),
    row("a", 0, 1 * H),
    row("a", 0, 3 * H, { is_open: true, left_at: null }), // açık: medyana dahil değil, kayba dahil (2 sa)
    row("c", 2, 5 * H, { is_open: true, left_at: null }), // yalnızca açık ziyaret: medyan yok, kayıp 0
  ];
  const stats = stageStats(rows);

  it("aşama sırasına göre ve doğru metriklerle", () => {
    expect(stats.map((s) => s.stageId)).toEqual(["a", "b", "c"]);
    const a = stats[0]!;
    expect(a).toMatchObject({ visits: 3, openNow: 1, avgSeconds: H, medianSeconds: H, maxSeconds: 3 * H, lostSeconds: 2 * H });
    const b = stats[1]!;
    expect(b).toMatchObject({ visits: 3, openNow: 0, medianSeconds: 2 * H, lostSeconds: 8 * H, totalSeconds: 14 * H });
    const c = stats[2]!;
    expect(c).toMatchObject({ avgSeconds: null, medianSeconds: null, lostSeconds: 0, openNow: 1 });
  });

  it("darboğaz en çok kaybedilen aşama", () => {
    expect(bottleneck(stats)?.stageId).toBe("b");
    expect(bottleneck([])).toBeNull();
    expect(bottleneck(stageStats([row("x", 0, H), row("x", 0, H)]))).toBeNull();
  });

  it("dönem filtresi eski kapalı ziyaretleri dışarıda bırakır, açıkları tutar", () => {
    const since = new Date("2026-11-25T00:00:00Z");
    const r = stageStats(
      [
        row("a", 0, H, { entered_at: "2026-11-01T10:00:00Z" }),
        row("a", 0, 2 * H, { entered_at: "2026-11-25T10:00:00Z" }),
        row("a", 0, 9 * H, { entered_at: "2026-11-01T10:00:00Z", is_open: true, left_at: null }),
      ],
      since,
    );
    expect(r[0]).toMatchObject({ visits: 2, openNow: 1, medianSeconds: 2 * H });
  });
});

describe("periodStart ve acceptanceRate", () => {
  it("dönem başlangıcı", () => {
    const now = new Date("2026-11-26T00:00:00Z");
    expect(periodStart("7", now)?.toISOString()).toBe("2026-11-19T00:00:00.000Z");
    expect(periodStart("all", now)).toBeNull();
  });
  it("kabul oranı", () => {
    expect(acceptanceRate(3, 1)).toBe(75);
    expect(acceptanceRate(0, 0)).toBeNull();
  });
});
