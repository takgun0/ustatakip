// OTOMATİK KOPYA — kaynak: src/lib/phone.ts. Düzenlemeyin; `npm run sync:functions` çalıştırın.
/**
 * Türkiye cep telefonu normalizasyonu → E.164 (+905xxxxxxxxx).
 * Kabul edilenler: "0532 111 22 33", "532 111 2233", "+90 532 111 22 33", "905321112233".
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (!/^5\d{9}$/.test(digits)) return null;
  return `+90${digits}`;
}

/** Ekranda gösterim: +90 532 111 22 33 */
export function formatPhone(e164: string): string {
  const m = /^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+90 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/** wa.me linkleri için başında + olmadan */
export function waNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}

export function lastFour(e164: string): string {
  return e164.slice(-4);
}
