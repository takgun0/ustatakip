// track-rate · M4: teslim edilen iş için müşteri 1–5 puan (ve isteğe bağlı yorum) verir.
// Her iş için tek puan; yalnızca teslimden sonra ve token geçerliyken.
import { adminClient, clientIp, errorJson, json, preflight, readJson } from "../_shared/http.ts";
import { hitRateLimit, ipHash, tooMany } from "../_shared/security.ts";
import { isTokenExpired } from "../_shared/tracking.ts";
import { ratingSchema, toFieldErrors } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  let body: unknown;
  try {
    body = await readJson(req, 4096);
  } catch {
    return errorJson(400, "bad_request", "Geçersiz istek");
  }
  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(422, "validation", "Bilgileri kontrol edin", { fields: toFieldErrors(parsed.error) });
  }
  const { token, score, comment } = parsed.data;

  try {
    const admin = adminClient();
    const ip = await ipHash(admin, clientIp(req));
    if (!(await hitRateLimit(admin, `rate:ip:${ip}`, 10, 60 * 60))) return tooMany(60);

    const { data: job, error } = await admin
      .from("jobs")
      .select("id, status, token_expires_at")
      .eq("tracking_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!job) return errorJson(404, "not_found", "Takip bağlantısı geçersiz.");
    if (isTokenExpired(job.token_expires_at)) return errorJson(410, "expired", "Bu takip bağlantısının süresi doldu.");
    if (job.status !== "delivered") return errorJson(409, "not_delivered", "İşiniz teslim edildikten sonra puan verebilirsiniz.");

    const { error: insertError } = await admin.from("ratings").insert({ job_id: job.id, score, comment });
    if (insertError?.code === "23505") return errorJson(409, "already_rated", "Bu iş için puanınızı zaten verdiniz. Teşekkürler!");
    if (insertError) throw insertError;
    return json({ rating: { score, comment } }, 201);
  } catch (e) {
    console.error("track-rate", e instanceof Error ? e.message : e);
    return errorJson(503, "unavailable", "Puanınız şu anda kaydedilemedi. Biraz sonra yeniden deneyin.");
  }
});
