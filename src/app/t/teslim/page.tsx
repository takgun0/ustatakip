"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/site";
import { TrackingSkeleton } from "@/components/customer/CustomerChrome";

/**
 * Eski M4 adresi (/t/teslim/#<token>). Puanlama kaldırıldı; daha önce paylaşılmış
 * bağlantılar takip sayfasına (M2) yönlendirilir. Token yalnızca # sonrasında taşınır.
 */
export default function TeslimRedirect() {
  useEffect(() => {
    window.location.replace(`${BASE_PATH}/t/${window.location.hash}`);
  }, []);
  return <TrackingSkeleton />;
}
