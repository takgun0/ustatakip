// OTOMATİK KOPYA — kaynak: src/lib/offers.ts. Düzenlemeyin; `npm run sync:functions` çalıştırın.
/**
 * Ek masraf teklifi durum makinesi (saf fonksiyonlar; Edge Function'lara da kopyalanır).
 *
 * Bir "tur" = esnafın fiyatı (propose) + müşterinin yanıtı. En fazla 3 tur.
 *
 *   esnaf propose ──► pending ──(müşteri accept)──► accepted   (final = teklif edilen tutar)
 *                        │  ──(müşteri reject)──► rejected
 *                        │  ──(müşteri counter, tur < 3)──► countered
 *                        ▼
 *   countered ──(esnaf accept)──► accepted   (final = karşı teklif)
 *             ──(esnaf reject)──► rejected
 *             ──(esnaf propose yeni fiyat)──► pending, tur + 1
 *
 * 3. turda müşteri karşı teklif veremez; yalnızca kabul eder ya da reddeder.
 * accepted / rejected / expired son durumlardır. Her geçiş offer_rounds'a eklenen (append-only)
 * bir kayıt üretir.
 */

export const MAX_ROUNDS = 3;

export type OfferStatus = "pending" | "accepted" | "rejected" | "countered" | "expired";
export type OfferActor = "business" | "customer";
export type OfferActionKind = "propose" | "counter" | "accept" | "reject";

export type OfferState = {
  status: OfferStatus;
  /** Masadaki son tutar (kuruş): pending'de esnafın fiyatı, countered'da müşterinin karşı teklifi */
  amount: number;
  round: number;
  finalAmount: number | null;
};

export type OfferAction =
  | { actor: "customer"; kind: "accept" }
  | { actor: "customer"; kind: "reject" }
  | { actor: "customer"; kind: "counter"; amount: number }
  | { actor: "business"; kind: "accept" }
  | { actor: "business"; kind: "reject" }
  | { actor: "business"; kind: "propose"; amount: number };

export type RoundRecord = { round_no: number; actor: OfferActor; action: OfferActionKind; amount: number | null };

export type TransitionResult =
  | { ok: true; state: OfferState; record: RoundRecord }
  | { ok: false; code: "closed" | "not_your_turn" | "no_rounds_left" | "invalid_amount"; message: string };

export const TERMINAL: ReadonlySet<OfferStatus> = new Set(["accepted", "rejected", "expired"]);

/** İlk teklif (tur 1) */
export function openOffer(amount: number): TransitionResult {
  if (!validAmount(amount)) return fail("invalid_amount");
  return {
    ok: true,
    state: { status: "pending", amount, round: 1, finalAmount: null },
    record: { round_no: 1, actor: "business", action: "propose", amount },
  };
}

function validAmount(n: number): boolean {
  return Number.isInteger(n) && n > 0 && n <= 1_000_000_000;
}

const MESSAGES: Record<Exclude<TransitionResult, { ok: true }>["code"], string> = {
  closed: "Bu teklif kapanmış.",
  not_your_turn: "Teklif şu anda karşı tarafın yanıtını bekliyor.",
  no_rounds_left: `Pazarlık en fazla ${MAX_ROUNDS} tur sürebilir. Teklifi kabul edebilir ya da reddedebilirsiniz.`,
  invalid_amount: "Geçerli bir tutar girin.",
};

function fail(code: keyof typeof MESSAGES): TransitionResult {
  return { ok: false, code, message: MESSAGES[code] };
}

/** Sıradaki yanıt kimden bekleniyor? Kapalı tekliflerde null. */
export function awaiting(status: OfferStatus): OfferActor | null {
  if (status === "pending") return "customer";
  if (status === "countered") return "business";
  return null;
}

/** Müşteri bu turda karşı teklif verebilir mi? */
export function canCounter(state: Pick<OfferState, "status" | "round">): boolean {
  return state.status === "pending" && state.round < MAX_ROUNDS;
}

export function transition(state: OfferState, action: OfferAction): TransitionResult {
  if (TERMINAL.has(state.status)) return fail("closed");
  if (awaiting(state.status) !== action.actor) return fail("not_your_turn");

  if (action.actor === "customer") {
    switch (action.kind) {
      case "accept":
        return done(state, { status: "accepted", finalAmount: state.amount }, "customer", "accept", null);
      case "reject":
        return done(state, { status: "rejected" }, "customer", "reject", null);
      case "counter":
        if (state.round >= MAX_ROUNDS) return fail("no_rounds_left");
        if (!validAmount(action.amount)) return fail("invalid_amount");
        return done(state, { status: "countered", amount: action.amount }, "customer", "counter", action.amount);
    }
  }

  switch (action.kind) {
    case "accept":
      return done(state, { status: "accepted", finalAmount: state.amount }, "business", "accept", null);
    case "reject":
      return done(state, { status: "rejected" }, "business", "reject", null);
    case "propose": {
      if (state.round >= MAX_ROUNDS) return fail("no_rounds_left");
      if (!validAmount(action.amount)) return fail("invalid_amount");
      const round = state.round + 1;
      return {
        ok: true,
        state: { ...state, status: "pending", amount: action.amount, round },
        record: { round_no: round, actor: "business", action: "propose", amount: action.amount },
      };
    }
  }
}

function done(
  state: OfferState,
  patch: Partial<OfferState>,
  actor: OfferActor,
  action: OfferActionKind,
  amount: number | null,
): TransitionResult {
  return { ok: true, state: { ...state, ...patch }, record: { round_no: state.round, actor, action, amount } };
}

/** Kayıtlardan durumu yeniden kurar (append-only geçmişin tutarlılık denetimi için) */
export function replay(records: RoundRecord[]): OfferState | null {
  const [first, ...rest] = records;
  if (!first || first.action !== "propose" || first.actor !== "business" || first.amount == null) return null;
  const opened = openOffer(first.amount);
  if (!opened.ok) return null;
  let state = opened.state;
  for (const r of rest) {
    const action =
      r.action === "counter" || r.action === "propose"
        ? ({ actor: r.actor, kind: r.action, amount: r.amount ?? 0 } as OfferAction)
        : ({ actor: r.actor, kind: r.action } as OfferAction);
    const next = transition(state, action);
    if (!next.ok) return null;
    state = next.state;
  }
  return state;
}
