// offer-action · Müşteri (M3) ek masraf teklifine yanıt verir: kabul, ret ya da karşı teklif.
// Giriş yok: takip token'ı doğrulanır. Geçiş kuralları _shared/offers.ts'te (src/lib/offers.ts kopyası).
// Yazma tek işlemde public.apply_offer_round ile (yalnızca service_role); IP yalnızca HMAC özeti olarak saklanır.
import { adminClient, clientIp, errorJson, json, preflight, readJson } from "../_shared/http.ts";
import { offerActionSchema, toFieldErrors } from "../_shared/validation.ts";
import { transition, type OfferAction, type OfferState } from "../_shared/offers.ts";
import { isTokenExpired } from "../_shared/tracking.ts";
import { hitRateLimit, ipHash, tooMany } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return errorJson(400, "bad_request", "Geçersiz istek");
  }
  const parsed = offerActionSchema.safeParse(body);
  if (!parsed.success) return errorJson(422, "validation", "Bilgileri kontrol edin", { fields: toFieldErrors(parsed.error) });
  const input = parsed.data;

  const admin = adminClient();
  let hash: string;
  try {
    hash = await ipHash(admin, clientIp(req));
    if (!(await hitRateLimit(admin, `offer:${hash}`, 20, 600))) return tooMany(10);
  } catch (e) {
    console.error(e);
    return errorJson(503, "unavailable", "Şu anda işlem yapılamıyor. Lütfen yeniden deneyin.");
  }

  const { data: job } = await admin
    .from("jobs")
    .select("id, status, token_expires_at")
    .eq("tracking_token", input.token)
    .maybeSingle();
  if (!job) return errorJson(404, "not_found", "Takip bağlantısı geçersiz.");
  if (job.status === "cancelled" || isTokenExpired(job.token_expires_at)) return errorJson(410, "expired", "Takip bağlantısının süresi doldu.");

  const { data: offer } = await admin
    .from("offers")
    .select("id, status, current_amount, final_amount, offer_rounds(round_no)")
    .eq("id", input.offerId)
    .eq("job_id", job.id)
    .maybeSingle();
  if (!offer) return errorJson(404, "not_found", "Teklif bulunamadı.");

  const round = (offer.offer_rounds as Array<{ round_no: number }>).reduce((m, r) => Math.max(m, r.round_no), 1);
  const state: OfferState = { status: offer.status, amount: offer.current_amount, round, finalAmount: offer.final_amount };
  const action: OfferAction =
    input.action === "counter" ? { actor: "customer", kind: "counter", amount: input.amount! } : { actor: "customer", kind: input.action };
  const result = transition(state, action);
  if (!result.ok) return errorJson(409, result.code, result.message);

  const { error } = await admin.rpc("apply_offer_round", {
    p_offer_id: offer.id,
    p_expected_status: state.status,
    p_expected_round: state.round,
    p_status: result.state.status,
    p_amount: result.state.amount,
    p_final: result.state.finalAmount,
    p_round_no: result.record.round_no,
    p_actor: result.record.actor,
    p_action: result.record.action,
    p_round_amount: result.record.amount,
    p_note: input.note ?? null,
    p_ip_hash: hash,
  });
  if (error) {
    if (error.code === "40001") return errorJson(409, "conflict", "Teklif bu arada güncellendi. Sayfayı yenileyin.");
    console.error("apply_offer_round", error.code, error.message);
    return errorJson(500, "server", "Yanıtınız kaydedilemedi. Lütfen yeniden deneyin.");
  }

  return json({ offer: { id: offer.id, ...result.state } });
});
