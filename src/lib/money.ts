/**
 * Para birimi yardımcıları. Tüm tutarlar veritabanında kuruş (integer) olarak durur.
 * Biçim: 1.250,00 ₺ — binlik ayırıcı nokta, kuruş virgül, ₺ sonda ve boşlukla.
 */

export function formatTRY(kurus: number): string {
  if (!Number.isFinite(kurus) || !Number.isInteger(kurus)) {
    throw new TypeError("Tutar kuruş cinsinden tam sayı olmalı");
  }
  const negative = kurus < 0;
  const abs = Math.abs(kurus);
  const lira = Math.floor(abs / 100);
  const cents = abs % 100;
  const liraText = lira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${liraText},${cents.toString().padStart(2, "0")} ₺`;
}

/**
 * Kullanıcı girdisini kuruşa çevirir. Kabul edilenler: "1.250,00", "1250,5", "1250", "1 250,00 ₺".
 * Geçersiz ya da negatif girdide null döner.
 */
export function parseTRY(input: string): number | null {
  const cleaned = input.replace(/[₺\s]/g, "").trim();
  if (!cleaned) return null;
  // Türkçe biçim: noktalar binlik, virgül ondalık
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(cleaned)) return null;
  const [intPart, fracPart = ""] = cleaned.replace(/\./g, "").split(",");
  const lira = Number(intPart);
  const kurus = Number(fracPart.padEnd(2, "0"));
  const total = lira * 100 + kurus;
  return Number.isSafeInteger(total) ? total : null;
}
