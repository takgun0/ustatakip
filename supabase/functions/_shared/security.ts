// Müşteri uçları için güvenlik yardımcıları (yalnızca Deno'da çalışır)
import type { SupabaseClient } from "@supabase/supabase-js";
import { errorJson } from "./http.ts";

let secretPromise: Promise<string> | null = null;

/** HMAC anahtarı: önce IP_HASH_SECRET ortam değişkeni, yoksa Vault (public.ip_hash_secret, yalnızca service_role) */
function ipSecret(admin: SupabaseClient): Promise<string> {
  secretPromise ??= (async () => {
    const env = Deno.env.get("IP_HASH_SECRET");
    if (env) return env;
    const { data, error } = await admin.rpc("ip_hash_secret");
    if (error || typeof data !== "string" || data.length < 32) throw new Error("ip_hash_secret alınamadı");
    return data;
  })().catch((e) => {
    secretPromise = null;
    throw e;
  });
  return secretPromise;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** IP adresinin HMAC-SHA256 özeti (32 hex). Ham IP hiçbir yerde saklanmaz. */
export async function ipHash(admin: SupabaseClient, ip: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(await ipSecret(admin)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip))).slice(0, 32);
}

/** Realtime kanal adı; SQL'deki public.job_topic ile aynı */
export async function jobTopic(token: string): Promise<string> {
  return "job:" + hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

/** Sabit pencereli sayaç. false = sınır aşıldı. */
export async function hitRateLimit(admin: SupabaseClient, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin.rpc("hit_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) throw new Error("rate limit: " + error.message);
  if (Math.random() < 0.01) void admin.rpc("purge_rate_limits");
  return data === true;
}

export function tooMany(minutes: number): Response {
  return errorJson(429, "rate_limited", `Çok fazla deneme yapıldı. ${minutes} dakika sonra yeniden deneyin.`);
}
