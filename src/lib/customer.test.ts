import { describe, expect, it } from "vitest";
import { buildCustomerView, type BuildInput } from "./customer-view";
import { checkLookup } from "./tracking";
import { ratingSchema, trackLookupSchema } from "./validation";

describe("checkLookup (kod + son 4 hane)", () => {
  const job = { customer_phone: "+905321112233", token_expires_at: null, status: "active" };
  const now = new Date("2026-11-26T12:00:00Z");

  it("doğru son 4 hanede ok", () => {
    expect(checkLookup(job, "2233", now)).toBe("ok");
  });
  it("yanlış hanede ve bulunamayan kodda aynı sonuç", () => {
    expect(checkLookup(job, "2234", now)).toBe("no_match");
    expect(checkLookup(null, "2233", now)).toBe("no_match");
    expect(checkLookup(null, "0000", now)).toBe("no_match");
  });
  it("4 haneden farklı girdiyi reddeder", () => {
    expect(checkLookup(job, "233", now)).toBe("no_match");
    expect(checkLookup(job, "12233", now)).toBe("no_match");
  });
  it("teslimden 30 gün sonra süresi dolar", () => {
    expect(checkLookup({ ...job, status: "delivered", token_expires_at: "2026-11-26T11:59:59Z" }, "2233", now)).toBe("expired");
    expect(checkLookup({ ...job, status: "delivered", token_expires_at: "2026-12-20T00:00:00Z" }, "2233", now)).toBe("ok");
  });
  it("iptal edilen iş açılmaz", () => {
    expect(checkLookup({ ...job, status: "cancelled" }, "2233", now)).toBe("expired");
  });
});

describe("trackLookupSchema", () => {
  it("kodu normalize eder, son 4 haneyi doğrular", () => {
    const r = trackLookupSchema.safeParse({ code: "ut-7k4m-29", last4: " 2233 " });
    expect(r.success && r.data).toEqual({ code: "UT-7K4M29", last4: "2233" });
  });
  it("hatalı girdilerde Türkçe mesaj verir", () => {
    const r = trackLookupSchema.safeParse({ code: "XYZ", last4: "22a3" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toEqual(["code", "last4"]);
  });
});

describe("ratingSchema", () => {
  const token = "a".repeat(43);
  it("1–5 arası tam sayı kabul eder", () => {
    expect(ratingSchema.safeParse({ token, score: 5, comment: "" }).success).toBe(true);
    expect(ratingSchema.safeParse({ token, score: 0, comment: "" }).success).toBe(false);
    expect(ratingSchema.safeParse({ token, score: 4.5, comment: "" }).success).toBe(false);
    expect(ratingSchema.safeParse({ token: "kisa", score: 5, comment: "" }).success).toBe(false);
  });
});

describe("buildCustomerView", () => {
  const input: BuildInput = {
    job: {
      tracking_code: "UT-7K4M29",
      title: "Fren bakımı",
      item_label: null,
      status: "active",
      agreed_amount: 485000,
      estimated_delivery: null,
      current_stage_id: "s2",
      created_at: "2026-11-24T09:00:00Z",
      updated_at: "2026-11-24T12:00:00Z",
      delivered_at: null,
      token_expires_at: null,
    },
    business: { name: "Yıldız Oto", tagline: null, phone: "+905321234567", kvkk_text: null },
    logoUrl: null,
    stages: [
      { id: "s2", name: "Arıza Tespiti", position: 1, color: "#2563EB" },
      { id: "s1", name: "Teslim Alındı", position: 0, color: "#1E3A5F" },
      { id: "s3", name: "Onarım", position: 2, color: "#F59E0B" },
    ],
    events: [
      { id: "e1", stage_id: "s1", note: "Teslim alındı", entered_at: "2026-11-24T09:00:00Z" },
      { id: "e2", stage_id: "s2", note: null, entered_at: "2026-11-24T11:00:00Z" },
    ],
    media: [
      { id: "m1", stage_id: "s1", storage_path: "b/j/1.webp", caption: null, created_at: "2026-11-24T09:05:00Z" },
      { id: "m2", stage_id: "s2", storage_path: "b/j/2.webp", caption: null, created_at: "2026-11-24T11:30:00Z" },
      { id: "m3", stage_id: "s2", storage_path: "b/j/imzasiz.webp", caption: null, created_at: "2026-11-24T11:31:00Z" },
    ],
    signedUrls: { "b/j/1.webp": "https://x/1", "b/j/2.webp": "https://x/2" },
    offers: [
      {
        id: "o1",
        title: "Ön disk",
        description: null,
        status: "pending",
        current_amount: 310000,
        final_amount: null,
        created_at: "2026-11-24T12:00:00Z",
        offer_rounds: [
          { round_no: 1, actor: "business", action: "propose", amount: 350000, created_at: "2026-11-24T12:00:00Z" },
          { round_no: 1, actor: "customer", action: "counter", amount: 280000, created_at: "2026-11-24T12:10:00Z" },
          { round_no: 2, actor: "business", action: "propose", amount: 310000, created_at: "2026-11-24T12:20:00Z" },
        ],
      },
    ],
    rating: null,
    topic: "job:abc",
  };

  const view = buildCustomerView(input);

  it("aşamaları sıraya koyar ve aktif aşamayı bulur", () => {
    expect(view.stages.map((s) => s.name)).toEqual(["Teslim Alındı", "Arıza Tespiti", "Onarım"]);
    expect(view.activeIndex).toBe(1);
  });

  it("geçmiş en yeniden eskiye, fotoğraflar doğru aşamada", () => {
    expect(view.history.map((h) => h.id)).toEqual(["o1", "e2", "e1"]);
    const e2 = view.history.find((h) => h.id === "e2");
    expect(e2?.kind === "stage" && e2.photos.map((p) => p.id)).toEqual(["m2"]);
    expect(e2?.kind === "stage" && e2.current).toBe(true);
  });

  it("açık teklifi tur bilgisiyle verir", () => {
    expect(view.openOffers).toEqual([{ id: "o1", title: "Ön disk", amount: 310000, round: 2, maxRounds: 3 }]);
    expect(view.job.lastUpdate).toBe("2026-11-24T12:20:00Z");
  });

  it("M3 teklif detayını turlar ve ilk fiyatla verir (ip_hash içermez)", () => {
    const o = view.offers[0]!;
    expect(o.firstAmount).toBe(350000);
    expect(o.amount).toBe(310000);
    expect(o.round).toBe(2);
    expect(o.rounds.map((r) => `${r.round}:${r.actor}:${r.amount}`)).toEqual(["1:business:350000", "1:customer:280000", "2:business:310000"]);
    expect(o.rounds[0]!.note).toBeNull();
    expect(JSON.stringify(view.offers)).not.toContain("ip_hash");
  });

  it("müşteriye telefon ya da token sızdırmaz", () => {
    const text = JSON.stringify(view);
    expect(text).not.toContain("tracking_token");
    expect(text).not.toContain("customer_phone");
  });
});
