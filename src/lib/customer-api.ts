/**
 * Müşteri sayfalarının (oturumsuz) Edge Function çağrıları.
 * supabase-js yüklenmez: sayfalar hafif kalır (M2 Lighthouse mobil 90+ hedefi).
 */
import { isTrackingToken } from "./tracking";

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export type ApiError = { status: number; code: string; message: string; fields?: Record<string, string> };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const NETWORK_ERROR: ApiError = { status: 0, code: "network", message: "Bağlantı kurulamadı. İnternetinizi kontrol edip yeniden deneyin." };

/* eslint-disable @typescript-eslint/no-explicit-any -- JSON yanıtı */
function toResult<T>(status: number, json: any): ApiResult<T> {
  if (status >= 200 && status < 300) return { ok: true, data: json as T };
  return {
    ok: false,
    error: {
      status,
      code: json?.error?.code ?? "unknown",
      message: json?.error?.message ?? "Bir şeyler ters gitti. Yeniden deneyin.",
      fields: json?.error?.fields,
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Müşteri uçları "basit" CORS isteğiyle çağrılır (text/plain gövde, özel başlık yok): tarayıcı
 * OPTIONS ön isteği göndermez, yavaş mobil ağda bir gidiş-dönüş kazanılır. Uçlar oturum istemez
 * (verify_jwt false) ve gövdeyi metin olarak okuyup JSON'a çevirir.
 */
export async function callFunction<T>(name: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${URL_BASE}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(body),
    });
    return toResult<T>(res.status, await res.json().catch(() => null));
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

/**
 * Sayfa HTML'ine gömülen erken istek: #token'ı okuyup track-get'i JS paketi inmeden başlatır
 * (src/app/t/layout.tsx). Sonuç window.__utTrack'te bekler; useTracking ilk yüklemede onu kullanır.
 */
export const EARLY_TRACK_SCRIPT = `(function(){try{var t=location.hash.slice(1).split("/")[0];if(!/^[A-Za-z0-9_-]{43}$/.test(t))return;window.__utTrack={token:t,promise:fetch(${JSON.stringify(URL_BASE + "/functions/v1/track-get")},{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify({token:t})}).then(function(r){return r.json().catch(function(){return null}).then(function(j){return{status:r.status,json:j}})})}}catch(e){}})();`;

type EarlyTrack = { token: string; promise: Promise<{ status: number; json: unknown }> };

/** Erken isteğin sonucunu bir kez teslim eder; token uyuşmazsa ya da istek yoksa null */
export function takeEarlyTrack<T>(token: string): Promise<ApiResult<T>> | null {
  const w = window as unknown as { __utTrack?: EarlyTrack };
  const early = w.__utTrack;
  if (!early || early.token !== token) return null;
  delete w.__utTrack;
  return early.promise.then((r) => toResult<T>(r.status, r.json)).catch(() => ({ ok: false as const, error: NETWORK_ERROR }));
}

/**
 * Adres çubuğundaki #token kısmı. Token sunucuya giden URL'de bulunmaz (hash istekle gitmez),
 * bu yüzden statik barındırmanın erişim loglarına da düşmez.
 * "#<token>" ya da "#<token>/<ek>" biçimini kabul eder.
 */
export function readHash(): { token: string | null; rest: string[] } {
  if (typeof window === "undefined") return { token: null, rest: [] };
  const [token = "", ...rest] = window.location.hash.replace(/^#/, "").split("/");
  return { token: isTrackingToken(token) ? token : null, rest };
}

/** QR'dan okunan metinden takip token'ı çıkarır (yalnızca kendi /t/#… biçimimiz) */
export function tokenFromScannedText(text: string): string | null {
  const m = /\/t\/#([A-Za-z0-9_-]{43})(?:$|\/)/.exec(text.trim());
  return m && isTrackingToken(m[1]!) ? m[1]! : null;
}
