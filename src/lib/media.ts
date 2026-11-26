"use client";

import { functionUrl, getSupabase, SUPABASE_PUBLISHABLE_KEY } from "./supabase";
import { reencodeImage } from "./image";

export type JobMedia = { id: string; stage_id: string | null; storage_path: string; caption: string | null; created_at: string };

const BUCKET = "job-media";
const URL_TTL = 3600;
/** İmzalı URL önbelleği: aynı görsel her yenilemede yeniden indirilmesin (süre dolmadan 10 dk önce yenilenir) */
const signedCache = new Map<string, { url: string; until: number }>();

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of paths) {
    const hit = signedCache.get(p);
    if (hit && hit.until > now) out[p] = hit.url;
    else missing.push(p);
  }
  if (missing.length) {
    const { data } = await getSupabase().storage.from(BUCKET).createSignedUrls(missing, URL_TTL);
    for (const row of data ?? []) {
      if (!row.signedUrl || !row.path) continue;
      out[row.path] = row.signedUrl;
      signedCache.set(row.path, { url: row.signedUrl, until: now + (URL_TTL - 600) * 1000 });
    }
  }
  return out;
}

/**
 * Fotoğrafı tarayıcıda küçültüp (1600 px, meta verisiz yeniden kodlama) media-upload uç noktasına gönderir.
 * Sunucu türü baytlardan doğrular ve EXIF/XMP'yi ayrıca temizler.
 */
export async function uploadStagePhoto(jobId: string, stageId: string, file: File): Promise<JobMedia> {
  const blob = await reencodeImage(file, 1600, 0.85);
  const form = new FormData();
  form.append("jobId", jobId);
  form.append("stageId", stageId);
  form.append("file", blob, blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
  const { data } = await getSupabase().auth.getSession();
  let res: Response;
  try {
    res = await fetch(functionUrl("media-upload"), {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: form,
    });
  } catch {
    throw new Error("Bağlantı kurulamadı. İnternetinizi kontrol edip yeniden deneyin.");
  }
  const body = await res.json().catch(() => null);
  if (res.status === 201 && body?.media) return body.media as JobMedia;
  throw new Error(body?.error?.message ?? "Fotoğraf yüklenemedi. Yeniden deneyin.");
}

/** Önce kayıt (RLS), sonra nesne silinir; nesne silinemezse kayıt zaten görünmez olur */
export async function deleteStagePhoto(media: Pick<JobMedia, "id" | "storage_path">): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("job_media").delete().eq("id", media.id);
  if (error) throw new Error("Fotoğraf silinemedi. Yeniden deneyin.");
  signedCache.delete(media.storage_path);
  await supabase.storage.from(BUCKET).remove([media.storage_path]);
}
