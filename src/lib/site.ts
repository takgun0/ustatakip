/** GitHub Pages altında çalışırken /<repo> öneki */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Paylaşım linkleri için mutlak site adresi (CI'da NEXT_PUBLIC_SITE_URL verilir) */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return `${window.location.origin}${BASE_PATH}`;
  return BASE_PATH;
}

/** Müşteri takip linki. Token # sonrasında: sunucuya ve loglara gitmez. */
export function trackingUrl(token: string): string {
  return `${siteUrl()}/t/#${token}`;
}
