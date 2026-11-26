"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomerView } from "@/lib/customer-view";
import { callFunction, readHash, takeEarlyTrack, type ApiError } from "@/lib/customer-api";

export type TrackingState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; error: ApiError }
  | { status: "ready"; view: CustomerView };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * M2/M4 veri kancası: #token'ı okur, track-get ile veriyi alır ve Realtime yayınını dinler.
 * Yayın içeriksizdir ("changed"); sinyal gelince veri yine token doğrulamalı uçtan çekilir.
 * Realtime istemcisi ilk boyamadan sonra tembel yüklenir.
 */
export function useTracking() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  /** #token/<ek> biçimindeki ek bölümler (M3'te teklif kimliği) */
  const [rest, setRest] = useState<string[]>([]);
  const [state, setState] = useState<TrackingState>({ status: "loading" });
  const [live, setLive] = useState(false);
  const inflight = useRef(false);

  useEffect(() => {
    const read = () => {
      const h = readHash();
      setToken(h.token);
      setRest((prev) => (prev.join("/") === h.rest.join("/") ? prev : h.rest));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!token || inflight.current) return;
      inflight.current = true;
      if (!silent) setState({ status: "loading" });
      // İlk yüklemede HTML'deki erken istek (EARLY_TRACK_SCRIPT) varsa onun sonucu kullanılır
      const early = silent ? null : takeEarlyTrack<CustomerView>(token);
      const done = early ? await early : await callFunction<CustomerView>("track-get", { token });
      inflight.current = false;
      if (done.ok) setState({ status: "ready", view: done.data });
      // Arka plan yenilemesi başarısızsa ekrandaki veri korunur
      else if (!silent || done.error.status === 404 || done.error.status === 410) setState({ status: "error", error: done.error });
    },
    [token],
  );

  useEffect(() => {
    if (token === undefined) return;
    // Hash'ten okunan token'a göre veri çekilir (dış sistem senkronizasyonu)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token === null) setState({ status: "missing" });
    else void load();
  }, [token, load]);

  const topic = state.status === "ready" ? state.view.topic : null;

  useEffect(() => {
    if (!topic) return;
    let disposed = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let cleanup: (() => void) | undefined;
    const refresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void load(true), 400);
    };

    void import("@supabase/realtime-js").then(({ RealtimeClient }) => {
      if (disposed) return;
      const client = new RealtimeClient(`${SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1`, { params: { apikey: KEY } });
      const channel = client
        .channel(topic, { config: { private: false } })
        .on("broadcast", { event: "changed" }, refresh)
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
      cleanup = () => {
        void channel.unsubscribe();
        client.disconnect();
      };
    });

    // Sekme arka plandayken kaçan yayınlar için geri dönüşte yenile
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisible);
      cleanup?.();
      setLive(false);
    };
  }, [topic, load]);

  return { token, rest, state, live, reload: () => void load(), refresh: () => void load(true) };
}
