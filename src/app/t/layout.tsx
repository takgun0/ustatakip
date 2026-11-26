import type { ReactNode } from "react";
import { EARLY_TRACK_SCRIPT } from "@/lib/customer-api";

/**
 * Müşteri sayfaları (M2, M3, M4) için ortak kabuk. Gömülü betik takip verisini JS paketi inmeden
 * ister; yavaş mobil ağda içerik daha erken görünür (Lighthouse LCP).
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY_TRACK_SCRIPT }} />
      {children}
    </>
  );
}
