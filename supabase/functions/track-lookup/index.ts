// track-lookup · M1: müşteri takip kodu + telefonunun son 4 hanesiyle takip bağlantısını alır.
// Oturum gerekmez. IP başına ve kod başına deneme sınırı vardır; bulunamayan kod ile yanlış hane
// aynı yanıtı döner (kod taraması yapılamaz).
import { adminClient, clientIp, errorJson, json, preflight, readJson } from "../_shared/http.ts";
import { hitRateLimit, ipHash, tooMany } from "../_shared/security.ts";
import { checkLookup } from "../_shared/tracking.ts";
import { toFieldErrors, trackLookupSchema } from "../_shared/validation.ts";

const IP_LIMIT = { max: 10, windowSeconds: 15 * 60 };
const CODE_LIMIT = { max: 6, windowSeconds: 60 * 60 };

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  let body: unknown;
  try {
    body = await readJson(req, 1024);
  } catch {
    return errorJson(400, "bad_request", "Geçersiz istek");
  }
  const parsed = trackLookupSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(422, "validation", "Bilgileri kontrol edin", { fields: toFieldErrors(parsed.error) });
  }
  const { code, last4 } = parsed.data;

  try {
    const admin = adminClient();
    const ip = await ipHash(admin, clientIp(req));
    if (!(await hitRateLimit(admin, `lookup:ip:${ip}`, IP_LIMIT.max, IP_LIMIT.windowSeconds))) return tooMany(15);
    if (!(await hitRateLimit(admin, `lookup:code:${code}`, CODE_LIMIT.max, CODE_LIMIT.windowSeconds))) return tooMany(60);

    const { data: job, error } = await admin
      .from("jobs")
      .select("customer_phone, token_expires_at, status, tracking_token")
      .eq("tracking_code", code)
      .maybeSingle();
    if (error) throw error;

    const result = checkLookup(job, last4);
    if (result === "no_match") {
      return errorJson(404, "no_match", "Takip kodu ya da telefon hanesi eşleşmedi. Bilgileri kontrol edip yeniden deneyin.");
    }
    if (result === "expired") {
      return errorJson(410, "expired", "Bu işin takip süresi doldu. Ayrıntılar için işletmeyle iletişime geçin.");
    }
    return json({ token: job!.tracking_token });
  } catch (e) {
    console.error("track-lookup", e instanceof Error ? e.message : e);
    return errorJson(503, "unavailable", "Şu anda sorgulama yapılamıyor. Biraz sonra yeniden deneyin.");
  }
});
