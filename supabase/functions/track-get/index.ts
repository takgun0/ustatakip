// track-get · M2/M3: token ile müşteri takip verisini döner.
// Oturum gerekmez; token 256 bit rastgeledir ve teslimden 30 gün sonra geçersizleşir.
// Fotoğraflar özel bucket'tan 1 saatlik imzalı URL ile verilir.
import { adminClient, clientIp, errorJson, json, preflight, readJson } from "../_shared/http.ts";
import { hitRateLimit, ipHash, jobTopic, tooMany } from "../_shared/security.ts";
import { isTokenExpired } from "../_shared/tracking.ts";
import { trackGetSchema } from "../_shared/validation.ts";
import { buildCustomerView, type RawBusiness, type RawEvent, type RawJob, type RawMedia, type RawOffer, type RawStage } from "../_shared/customer-view.ts";

const SIGNED_URL_SECONDS = 60 * 60;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  let body: unknown;
  try {
    body = await readJson(req, 1024);
  } catch {
    return errorJson(400, "bad_request", "Geçersiz istek");
  }
  const parsed = trackGetSchema.safeParse(body);
  if (!parsed.success) return errorJson(404, "not_found", "Takip bağlantısı geçersiz.");
  const { token } = parsed.data;

  try {
    const admin = adminClient();
    const ip = await ipHash(admin, clientIp(req));
    if (!(await hitRateLimit(admin, `get:ip:${ip}`, 120, 10 * 60))) return tooMany(10);

    const { data: job, error } = await admin
      .from("jobs")
      .select(
        "id, template_id, tracking_code, title, item_label, status, agreed_amount, estimated_delivery, current_stage_id, created_at, updated_at, delivered_at, token_expires_at, businesses(name, tagline, phone, logo_path, kvkk_text)",
      )
      .eq("tracking_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!job) return errorJson(404, "not_found", "Takip bağlantısı geçersiz.");
    if (job.status === "cancelled") return errorJson(410, "cancelled", "Bu iş işletme tarafından kapatıldı.");
    if (isTokenExpired(job.token_expires_at)) {
      return errorJson(410, "expired", "Bu takip bağlantısının süresi doldu (teslimden 30 gün sonra kapanır).");
    }

    const [stages, events, media, offers] = await Promise.all([
      admin.from("template_stages").select("id, name, position, color").eq("template_id", job.template_id),
      admin.from("job_stage_events").select("id, stage_id, note, entered_at").eq("job_id", job.id),
      admin.from("job_media").select("id, stage_id, storage_path, caption, created_at").eq("job_id", job.id),
      admin
        .from("offers")
        .select("id, title, description, status, current_amount, final_amount, created_at, offer_rounds(round_no, actor, action, amount, note, created_at)")
        .eq("job_id", job.id),
    ]);
    for (const r of [stages, events, media, offers]) if (r.error) throw r.error;

    const paths = (media.data as RawMedia[]).map((m) => m.storage_path);
    const signedUrls: Record<string, string> = {};
    if (paths.length) {
      const { data: signed } = await admin.storage.from("job-media").createSignedUrls(paths, SIGNED_URL_SECONDS);
      for (const s of signed ?? []) if (s.path && s.signedUrl) signedUrls[s.path] = s.signedUrl;
    }

    const business = job.businesses as unknown as RawBusiness & { logo_path: string | null };
    const logoUrl = business.logo_path
      ? `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/logos/${business.logo_path}`
      : null;

    const view = buildCustomerView({
      job: job as unknown as RawJob,
      business,
      logoUrl,
      stages: stages.data as RawStage[],
      events: events.data as RawEvent[],
      media: media.data as RawMedia[],
      signedUrls,
      offers: offers.data as RawOffer[],
      topic: await jobTopic(token),
    });
    return json(view);
  } catch (e) {
    console.error("track-get", e instanceof Error ? e.message : e);
    return errorJson(503, "unavailable", "Takip bilgisi şu anda alınamıyor. Biraz sonra yeniden deneyin.");
  }
});
