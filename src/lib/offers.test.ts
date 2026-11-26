import { describe, expect, it } from "vitest";
import { MAX_ROUNDS, awaiting, canCounter, openOffer, replay, transition, type OfferState } from "./offers";

function opened(amount = 150_000): OfferState {
  const r = openOffer(amount);
  if (!r.ok) throw new Error("açılamadı");
  return r.state;
}

function step(s: OfferState, a: Parameters<typeof transition>[1]): OfferState {
  const r = transition(s, a);
  if (!r.ok) throw new Error(r.message);
  return r.state;
}

describe("offers durum makinesi", () => {
  it("esnaf teklifi tur 1'de müşteri yanıtını bekler", () => {
    const r = openOffer(250_000);
    expect(r.ok && r.state).toEqual({ status: "pending", amount: 250_000, round: 1, finalAmount: null });
    expect(r.ok && r.record).toEqual({ round_no: 1, actor: "business", action: "propose", amount: 250_000 });
    expect(awaiting("pending")).toBe("customer");
  });

  it("geçersiz tutarla teklif açılmaz", () => {
    expect(openOffer(0).ok).toBe(false);
    expect(openOffer(12.5).ok).toBe(false);
    expect(openOffer(-1).ok).toBe(false);
  });

  it("müşteri kabul ederse son tutar teklif edilen tutardır", () => {
    const s = step(opened(150_000), { actor: "customer", kind: "accept" });
    expect(s).toMatchObject({ status: "accepted", finalAmount: 150_000 });
  });

  it("müşteri reddederse teklif kapanır", () => {
    const s = step(opened(), { actor: "customer", kind: "reject" });
    expect(s.status).toBe("rejected");
    expect(transition(s, { actor: "business", kind: "propose", amount: 1 })).toMatchObject({ ok: false, code: "closed" });
  });

  it("karşı teklif esnafın sırasına geçer, esnaf kabul ederse son tutar karşı tekliftir", () => {
    const c = step(opened(150_000), { actor: "customer", kind: "counter", amount: 120_000 });
    expect(c).toMatchObject({ status: "countered", amount: 120_000, round: 1 });
    expect(awaiting(c.status)).toBe("business");
    expect(step(c, { actor: "business", kind: "accept" })).toMatchObject({ status: "accepted", finalAmount: 120_000 });
  });

  it("esnafın yeni fiyatı yeni tur açar", () => {
    const c = step(opened(), { actor: "customer", kind: "counter", amount: 100_000 });
    const r = transition(c, { actor: "business", kind: "propose", amount: 130_000 });
    expect(r.ok && r.state).toMatchObject({ status: "pending", amount: 130_000, round: 2 });
    expect(r.ok && r.record).toEqual({ round_no: 2, actor: "business", action: "propose", amount: 130_000 });
  });

  it("sırası gelmeyen taraf işlem yapamaz", () => {
    expect(transition(opened(), { actor: "business", kind: "accept" })).toMatchObject({ ok: false, code: "not_your_turn" });
    const c = step(opened(), { actor: "customer", kind: "counter", amount: 1_000 });
    expect(transition(c, { actor: "customer", kind: "accept" })).toMatchObject({ ok: false, code: "not_your_turn" });
  });

  it(`en fazla ${MAX_ROUNDS} tur: son turda karşı teklif verilemez`, () => {
    let s = opened(200_000);
    s = step(s, { actor: "customer", kind: "counter", amount: 150_000 });
    s = step(s, { actor: "business", kind: "propose", amount: 180_000 });
    s = step(s, { actor: "customer", kind: "counter", amount: 160_000 });
    s = step(s, { actor: "business", kind: "propose", amount: 170_000 });
    expect(s.round).toBe(3);
    expect(canCounter(s)).toBe(false);
    expect(transition(s, { actor: "customer", kind: "counter", amount: 165_000 })).toMatchObject({ ok: false, code: "no_rounds_left" });
    expect(step(s, { actor: "customer", kind: "accept" })).toMatchObject({ status: "accepted", finalAmount: 170_000 });
  });

  it("karşı teklif tutarı doğrulanır", () => {
    expect(transition(opened(), { actor: "customer", kind: "counter", amount: 0 })).toMatchObject({ ok: false, code: "invalid_amount" });
  });

  it("süresi dolan teklif kapalıdır", () => {
    const s: OfferState = { ...opened(), status: "expired" };
    expect(transition(s, { actor: "customer", kind: "accept" })).toMatchObject({ ok: false, code: "closed" });
  });

  it("append-only kayıtlardan durum yeniden kurulur, tutarsız geçmiş reddedilir", () => {
    const ok = replay([
      { round_no: 1, actor: "business", action: "propose", amount: 200_000 },
      { round_no: 1, actor: "customer", action: "counter", amount: 150_000 },
      { round_no: 2, actor: "business", action: "propose", amount: 175_000 },
      { round_no: 2, actor: "customer", action: "accept", amount: null },
    ]);
    expect(ok).toEqual({ status: "accepted", amount: 175_000, round: 2, finalAmount: 175_000 });
    expect(replay([{ round_no: 1, actor: "customer", action: "accept", amount: null }])).toBeNull();
    expect(
      replay([
        { round_no: 1, actor: "business", action: "propose", amount: 1_000 },
        { round_no: 1, actor: "business", action: "accept", amount: null },
      ]),
    ).toBeNull();
  });
});
