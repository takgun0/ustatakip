// offer-manage · Esnaf (E4) ek masraf teklifi açar ya da müşterinin karşı teklifine yanıt verir.
// İstek: Authorization: Bearer <esnaf oturum JWT'si>
//   { op: "create", jobId, title, description?, amount }           → yeni teklif (tur 1)
//   { op: "respond", offerId, action: accept|reject|propose, amount?, note? } → karşı teklife yanıt
// İş/teklif sahipliği RLS'li istemciyle doğrulanır; yazma service_role ile tek işlemde (RPC) yapılır.
import { adminClient, errorJson, json, preflight, readJson, requireBusiness } from "../_shared/http.ts";
import { offerCreateSchema, offerRespondSchema, toFieldErrors } from "../_shared/validation.ts";
import { openOffer, transition, type OfferAction, type OfferState } from "../_shared/offers.ts";

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const auth = await requireBusiness(req);
  if (!auth) return errorJson(401, "unauthorized", "Oturum bulunamadı. Lütfen yeniden giriş yapın.");

  let body: Record<string, unknown>;
  try {
    const raw = await readJson(req);
    if (!raw || typeof raw !== "object") throw new Error("bad");
    body = raw as Record<string, unknown>;
  } catch {
    return errorJson(400, "bad_request", "Geçersiz istek");
  }

  const admin = adminClient();

  if (body.op === "create") {
    const parsed = offerCreateSchema.safeParse(body);
    if (!parsed.success) return errorJson(422, "validation", "Formdaki hataları düzeltin", { fields: toFieldErrors(parsed.error) });
    const input = parsed.data;

    const { data: job } = await auth.userClient.from("jobs").select("id, business_id, status").eq("id", input.jobId).maybeSingle();
    if (!job || job.business_id !== auth.businessId) return errorJson(404, "not_found", "İş bulunamadı.");
    if (job.status !== "active") return errorJson(409, "closed", "Kapanmış işe teklif eklenemez.");
    const opened = openOffer(input.amount);
    if (!opened.ok) return errorJson(422, "validation", opened.message, { fields: { amount: opened.message } });

    const { data: id, error } = await admin.rpc("open_offer_tx", {
      p_job_id: job.id,
      p_title: input.title,
      p_description: input.description,
      p_amount: input.amount,
    });
    if (error) {
      if (error.code === "P0001") return errorJson(409, "conflict", error.message);
      console.error("open_offer_tx", error.code, error.message);
      return errorJson(500, "server", "Teklif kaydedilemedi. Lütfen yeniden deneyin.");
    }
    return json({ offer: { id, ...opened.state } }, 201);
  }

  if (body.op === "respond") {
    const parsed = offerRespondSchema.safeParse(body);
    if (!parsed.success) return errorJson(422, "validation", "Formdaki hataları düzeltin", { fields: toFieldErrors(parsed.error) });
    const input = parsed.data;

    // RLS: teklif yalnızca kendi işletmesinin işine aitse görünür
    const { data: offer } = await auth.userClient
      .from("offers")
      .select("id, status, current_amount, final_amount, offer_rounds(round_no), jobs!inner(business_id, status)")
      .eq("id", input.offerId)
      .maybeSingle();
    const owner = offer?.jobs as unknown as { business_id: string; status: string } | undefined;
    if (!offer || owner?.business_id !== auth.businessId) return errorJson(404, "not_found", "Teklif bulunamadı.");

    const round = (offer.offer_rounds as Array<{ round_no: number }>).reduce((m, r) => Math.max(m, r.round_no), 1);
    const state: OfferState = { status: offer.status, amount: offer.current_amount, round, finalAmount: offer.final_amount };
    const action: OfferAction =
      input.action === "propose" ? { actor: "business", kind: "propose", amount: input.amount! } : { actor: "business", kind: input.action };
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
      p_ip_hash: null,
    });
    if (error) {
      if (error.code === "40001") return errorJson(409, "conflict", "Teklif bu arada güncellendi. Sayfayı yenileyin.");
      console.error("apply_offer_round", error.code, error.message);
      return errorJson(500, "server", "Yanıtınız kaydedilemedi. Lütfen yeniden deneyin.");
    }
    return json({ offer: { id: offer.id, ...result.state } });
  }

  return errorJson(400, "bad_request", "Geçersiz işlem");
});
