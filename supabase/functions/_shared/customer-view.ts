// OTOMATİK KOPYA — kaynak: src/lib/customer-view.ts. Düzenlemeyin; `npm run sync:functions` çalıştırın.
/**
 * Müşteri takip sayfasının (M2/M4) veri modeli ve onu ham satırlardan kuran saf fonksiyon.
 * Edge Function (track-get) bu fonksiyonla yanıtı üretir; sayfa aynı tipleri kullanır.
 * Müşteriye giden veride telefon, token, iç kimlikler (business_id, template_id) bulunmaz.
 *
 * Bu dosya Edge Function'lara da kopyalanır: yalnızca göreli ".ts" importları kullanın.
 */

export const MAX_OFFER_ROUNDS = 3;

export type JobStatus = "active" | "delivered" | "cancelled";
export type OfferStatus = "pending" | "accepted" | "rejected" | "countered" | "expired";

export type RawJob = {
  tracking_code: string;
  title: string;
  item_label: string | null;
  status: JobStatus;
  agreed_amount: number | null;
  estimated_delivery: string | null;
  current_stage_id: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  token_expires_at: string | null;
};
export type RawBusiness = { name: string; tagline: string | null; phone: string | null; kvkk_text: string | null };
export type RawStage = { id: string; name: string; position: number; color: string };
export type RawEvent = { id: string; stage_id: string; note: string | null; entered_at: string };
export type RawMedia = { id: string; stage_id: string | null; storage_path: string; caption: string | null; created_at: string };
export type RawRound = {
  round_no: number;
  actor: "business" | "customer";
  action: string;
  amount: number | null;
  note?: string | null;
  created_at: string;
};
export type RawOffer = {
  id: string;
  title: string;
  description: string | null;
  status: OfferStatus;
  current_amount: number;
  final_amount: number | null;
  created_at: string;
  offer_rounds: RawRound[];
};

export type Photo = { id: string; url: string; caption: string | null };

export type HistoryItem =
  | { kind: "stage"; id: string; title: string; at: string; note: string | null; photos: Photo[]; current: boolean }
  | {
      kind: "offer";
      id: string;
      title: string;
      at: string;
      status: OfferStatus;
      amount: number;
      round: number;
      /** Müşterinin yanıtı bekleniyor */
      awaiting: boolean;
    };

export type OpenOffer = { id: string; title: string; amount: number; round: number; maxRounds: number };

/** M3: teklif detayı (tüm turlar, eskiden yeniye) */
export type OfferDetail = {
  id: string;
  title: string;
  description: string | null;
  status: OfferStatus;
  /** Masadaki son tutar: pending'de ustanın fiyatı, countered'da müşterinin karşı teklifi */
  amount: number;
  /** Ustanın ilk fiyatı */
  firstAmount: number;
  finalAmount: number | null;
  round: number;
  maxRounds: number;
  createdAt: string;
  rounds: Array<{ round: number; actor: "business" | "customer"; action: string; amount: number | null; note: string | null; at: string }>;
};

export type CustomerView = {
  business: { name: string; tagline: string | null; phone: string | null; logoUrl: string | null; kvkkText: string | null };
  job: {
    code: string;
    title: string;
    itemLabel: string | null;
    status: JobStatus;
    agreedAmount: number | null;
    estimatedDelivery: string | null;
    createdAt: string;
    deliveredAt: string | null;
    expiresAt: string | null;
    lastUpdate: string;
  };
  stages: Array<{ id: string; name: string; color: string }>;
  activeIndex: number;
  history: HistoryItem[];
  openOffers: OpenOffer[];
  offers: OfferDetail[];
  /** Realtime kanal adı: job:<sha256(token)> */
  topic: string;
};

export type BuildInput = {
  job: RawJob;
  business: RawBusiness;
  logoUrl: string | null;
  stages: RawStage[];
  events: RawEvent[];
  media: RawMedia[];
  /** storage_path → imzalı URL; imzalanamayan fotoğraf gösterilmez */
  signedUrls: Record<string, string>;
  offers: RawOffer[];
  topic: string;
};

const byTime = <T>(get: (x: T) => string) => (a: T, b: T) => get(a).localeCompare(get(b));

/** Teklifin en son tur numarası (tur = esnafın fiyatı + müşterinin yanıtı) */
export function offerRound(offer: Pick<RawOffer, "offer_rounds">): number {
  return offer.offer_rounds.reduce((max, r) => Math.max(max, r.round_no), 1);
}

export function buildCustomerView(input: BuildInput): CustomerView {
  const stages = [...input.stages].sort((a, b) => a.position - b.position);
  const activeIndex = Math.max(0, stages.findIndex((s) => s.id === input.job.current_stage_id));
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const events = [...input.events].sort(byTime((e) => e.entered_at));
  const latestEventId = events.at(-1)?.id;

  // Her fotoğraf, çekildiği anda o aşamada açık olan olay kaydına bağlanır
  const photosByEvent = new Map<string, Photo[]>();
  for (const m of [...input.media].sort(byTime((x) => x.created_at))) {
    const url = input.signedUrls[m.storage_path];
    if (!url) continue;
    const candidates = events.filter((e) => !m.stage_id || e.stage_id === m.stage_id);
    const owner = candidates.filter((e) => e.entered_at <= m.created_at).at(-1) ?? candidates[0];
    if (!owner) continue;
    const list = photosByEvent.get(owner.id) ?? [];
    list.push({ id: m.id, url, caption: m.caption });
    photosByEvent.set(owner.id, list);
  }

  const history: HistoryItem[] = events.map((e) => ({
    kind: "stage",
    id: e.id,
    title: stageName.get(e.stage_id) ?? "Aşama",
    at: e.entered_at,
    note: e.note,
    photos: photosByEvent.get(e.id) ?? [],
    current: e.id === latestEventId && input.job.status === "active",
  }));

  for (const o of input.offers) {
    const rounds = [...o.offer_rounds].sort(byTime((r) => r.created_at));
    const last = rounds.at(-1);
    const amount =
      o.status === "accepted"
        ? (o.final_amount ?? o.current_amount)
        : o.status === "countered"
          ? ([...rounds].reverse().find((r) => r.actor === "customer" && r.amount)?.amount ?? o.current_amount)
          : o.current_amount;
    history.push({
      kind: "offer",
      id: o.id,
      title: o.title,
      at: last?.created_at ?? o.created_at,
      status: o.status,
      amount,
      round: offerRound(o),
      awaiting: o.status === "pending",
    });
  }
  history.sort((a, b) => b.at.localeCompare(a.at));

  const openOffers: OpenOffer[] = input.offers
    .filter((o) => o.status === "pending")
    .sort(byTime((o) => o.created_at))
    .map((o) => ({ id: o.id, title: o.title, amount: o.current_amount, round: offerRound(o), maxRounds: MAX_OFFER_ROUNDS }));

  const offers: OfferDetail[] = [...input.offers].sort(byTime((o) => o.created_at)).map((o) => {
    const rounds = [...o.offer_rounds].sort(byTime((r) => r.created_at));
    return {
      id: o.id,
      title: o.title,
      description: o.description,
      status: o.status,
      amount: o.current_amount,
      firstAmount: rounds.find((r) => r.actor === "business" && r.amount != null)?.amount ?? o.current_amount,
      finalAmount: o.final_amount,
      round: offerRound(o),
      maxRounds: MAX_OFFER_ROUNDS,
      createdAt: o.created_at,
      rounds: rounds.map((r) => ({ round: r.round_no, actor: r.actor, action: r.action, amount: r.amount, note: r.note ?? null, at: r.created_at })),
    };
  });

  const lastUpdate = [input.job.updated_at, ...history.map((h) => h.at)].sort().at(-1)!;

  return {
    business: {
      name: input.business.name,
      tagline: input.business.tagline,
      phone: input.business.phone,
      logoUrl: input.logoUrl,
      kvkkText: input.business.kvkk_text,
    },
    job: {
      code: input.job.tracking_code,
      title: input.job.title,
      itemLabel: input.job.item_label,
      status: input.job.status,
      agreedAmount: input.job.agreed_amount,
      estimatedDelivery: input.job.estimated_delivery,
      createdAt: input.job.created_at,
      deliveredAt: input.job.delivered_at,
      expiresAt: input.job.token_expires_at,
      lastUpdate,
    },
    stages: stages.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    activeIndex,
    history,
    openOffers,
    offers,
    topic: input.topic,
  };
}
