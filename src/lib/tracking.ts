/**
 * Takip kodu ve token üretimi/doğrulaması.
 * Bağımlılıksız tutulur: aynı dosya Supabase Edge Function'larına da kopyalanır
 * (npm run sync:functions) ve orada Deno'da çalışır.
 *
 * - tracking_code: "UT-" + 6 Crockford Base32 karakteri (I, L, O, U yok).
 *   Ekranda tasarımdaki gibi gruplanır: UT-7K4M-29.
 * - tracking_token: 32 bayt (256 bit) kriptografik rastgele, base64url.
 */

export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 6;
export const TOKEN_BYTES = 32;
const CODE_PATTERN = /^UT-[0-9A-HJKMNP-TV-Z]{6}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type RandomSource = (bytes: Uint8Array) => Uint8Array;
const defaultRandom: RandomSource = (bytes) => crypto.getRandomValues(bytes);

/** 32 karakterlik alfabe 256'yı tam böler: `bayt & 31` yanlılık üretmez. */
export function generateTrackingCode(random: RandomSource = defaultRandom): string {
  const bytes = random(new Uint8Array(CODE_LENGTH));
  let out = "";
  for (const b of bytes) out += CROCKFORD_ALPHABET[b & 31];
  return `UT-${out}`;
}

export function generateTrackingToken(random: RandomSource = defaultRandom): string {
  const bytes = random(new Uint8Array(TOKEN_BYTES));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isTrackingCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

export function isTrackingToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

/**
 * Kullanıcının yazdığı kodu standart biçime çevirir.
 * Büyük/küçük harf, boşluk, tire ve "UT" öneki önemsizdir; Crockford kuralıyla O→0, I/L→1.
 * Geçersizse null.
 */
export function normalizeTrackingCode(input: string): string | null {
  let s = input.toUpperCase().replace(/[\s\-_.]/g, "");
  if (s.startsWith("UT") && s.length === CODE_LENGTH + 2) s = s.slice(2);
  s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== CODE_LENGTH) return null;
  const code = `UT-${s}`;
  return CODE_PATTERN.test(code) ? code : null;
}

/** "UT-7K4M29" → "UT-7K4M-29" (tasarımdaki görünüm) */
export function formatCode(code: string): string {
  const m = /^UT-([0-9A-Z]{4})([0-9A-Z]{2})$/.exec(code);
  return m ? `UT-${m[1]}-${m[2]}` : code;
}

/** Sabit zamanlı karşılaştırma (uzunluk eşitse içerikten bağımsız süre) */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Telefonun son 4 hanesi doğrulaması. phoneE164: "+905321112233" */
export function verifyLastFour(phoneE164: string, input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 4) return false;
  return timingSafeEqual(phoneE164.replace(/\D/g, "").slice(-4), digits);
}

/** Token'ın süresi dolmuş mu? (teslimden 30 gün sonra) */
export function isTokenExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime();
}

export type LookupResult = "ok" | "no_match" | "expired";

/**
 * M1 doğrulaması: kod + telefonun son 4 hanesi.
 * Kod yoksa da son 4 hane karşılaştırması yapılır (sahte numarayla), böylece yanıt süresi
 * kodun var olup olmadığını ele vermez. Bulunamayan kod ve yanlış hane aynı sonucu döner.
 */
export function checkLookup(
  job: { customer_phone: string; token_expires_at: string | null; status: string } | null,
  last4: string,
  now: Date = new Date(),
): LookupResult {
  const matches = verifyLastFour(job?.customer_phone ?? "+900000000000", last4);
  if (!job || !matches) return "no_match";
  if (job.status === "cancelled" || isTokenExpired(job.token_expires_at, now)) return "expired";
  return "ok";
}
