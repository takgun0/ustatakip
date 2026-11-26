// media-upload · Esnaf bir işe (isteğe bağlı olarak bir aşamaya) fotoğraf ekler.
// Tür sihirli baytlardan belirlenir (jpeg/png/webp), en fazla 5 MB, EXIF/XMP/metin sunucuda atılır.
// Nesne özel "job-media" kovasına <business_id>/<job_id>/<uuid>.<ext> yoluna yazılır.
// İstek: Authorization: Bearer <esnaf JWT'si>, multipart/form-data: jobId, stageId?, caption?, file
import { adminClient, errorJson, json, preflight, requireBusiness } from "../_shared/http.ts";
import { mediaUploadSchema, toFieldErrors } from "../_shared/validation.ts";
import { IMAGE_EXT, IMAGE_MIME, stripMetadata } from "../_shared/exif.ts";
import { hitRateLimit, tooMany } from "../_shared/security.ts";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_JOB = 40;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const auth = await requireBusiness(req);
  if (!auth) return errorJson(401, "unauthorized", "Oturum bulunamadı. Lütfen yeniden giriş yapın.");

  // Gövdeyi okumadan önce boyutu sınırla (multipart ek yükü için küçük pay)
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES + 64 * 1024) return errorJson(413, "too_large", "Dosya en fazla 5 MB olabilir.");

  const admin = adminClient();
  try {
    if (!(await hitRateLimit(admin, `media:${auth.businessId}`, 60, 600))) return tooMany(10);
  } catch (e) {
    console.error(e);
    return errorJson(503, "unavailable", "Şu anda yükleme yapılamıyor. Lütfen yeniden deneyin.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorJson(400, "bad_request", "Geçersiz istek");
  }
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v !== "" ? v : null;
  };
  const parsed = mediaUploadSchema.safeParse({ jobId: str("jobId"), stageId: str("stageId"), caption: str("caption") ?? "" });
  if (!parsed.success) return errorJson(422, "validation", "Geçersiz bilgi", { fields: toFieldErrors(parsed.error) });
  const input = parsed.data;

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return errorJson(422, "validation", "Fotoğraf seçin", { fields: { file: "Fotoğraf seçin" } });
  if (file.size > MAX_BYTES) return errorJson(413, "too_large", "Dosya en fazla 5 MB olabilir.");

  const cleaned = stripMetadata(new Uint8Array(await file.arrayBuffer()));
  if (!cleaned) {
    return errorJson(415, "unsupported", "Yalnızca JPEG, PNG ya da WebP fotoğraf yükleyebilirsiniz.", { fields: { file: "Desteklenmeyen ya da bozuk dosya" } });
  }

  // İş bu işletmenin mi? (RLS'li istemciyle)
  const { data: job } = await auth.userClient.from("jobs").select("id, template_id, status").eq("id", input.jobId).maybeSingle();
  if (!job) return errorJson(404, "not_found", "İş bulunamadı");
  if (job.status === "cancelled") return errorJson(409, "closed", "İptal edilen işe fotoğraf eklenemez.");

  if (input.stageId) {
    const { data: stage } = await auth.userClient
      .from("template_stages")
      .select("id")
      .eq("id", input.stageId)
      .eq("template_id", job.template_id)
      .maybeSingle();
    if (!stage) return errorJson(422, "validation", "Aşama bu işe ait değil", { fields: { stageId: "Aşama bu işe ait değil" } });
  }

  const { count } = await admin.from("job_media").select("id", { count: "exact", head: true }).eq("job_id", job.id);
  if ((count ?? 0) >= MAX_PER_JOB) return errorJson(409, "limit", `Bir işe en fazla ${MAX_PER_JOB} fotoğraf eklenebilir.`);

  const path = `${auth.businessId}/${job.id}/${crypto.randomUUID()}.${IMAGE_EXT[cleaned.kind]}`;
  const { error: upError } = await admin.storage.from("job-media").upload(path, cleaned.bytes, {
    contentType: IMAGE_MIME[cleaned.kind],
    cacheControl: "3600",
    upsert: false,
  });
  if (upError) {
    console.error("storage upload", upError.message);
    return errorJson(500, "server", "Fotoğraf yüklenemedi. Lütfen yeniden deneyin.");
  }

  const { data: media, error: dbError } = await admin
    .from("job_media")
    .insert({ job_id: job.id, stage_id: input.stageId, storage_path: path, caption: input.caption })
    .select("id, stage_id, storage_path, caption, created_at")
    .single();
  if (dbError) {
    console.error("job_media insert", dbError.message);
    await admin.storage.from("job-media").remove([path]);
    return errorJson(500, "server", "Fotoğraf kaydedilemedi. Lütfen yeniden deneyin.");
  }

  return json({ media }, 201);
});
