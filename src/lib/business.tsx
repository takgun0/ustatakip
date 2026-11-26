"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import type { Business } from "./types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: Session; business: Business };

type Ctx = {
  session: Session;
  business: Business;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const BusinessContext = createContext<Ctx | null>(null);

/**
 * Esnaf ekranlarının koruması. Statik yayında middleware olmadığı için oturum
 * tarayıcıda kontrol edilir; asıl güvenlik RLS ile veritabanındadır.
 */
export function BusinessProvider({
  children,
  fallback,
  errorView,
}: {
  children: ReactNode;
  fallback: ReactNode;
  errorView: (message: string, retry: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/giris/?next=${next}`);
      return;
    }
    const { data: business, error } = await supabase.from("businesses").select("*").maybeSingle();
    if (error || !business) {
      setState({ status: "error", message: error?.message ?? "İşletme kaydı bulunamadı" });
      return;
    }
    setState({ status: "ready", session, business: business as Business });
  }, [router]);

  useEffect(() => {
    // İlk yükleme: oturum ve işletme bilgisi dış kaynaktan (Supabase) okunur
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const { data: sub } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/giris/");
    });
    return () => sub.subscription.unsubscribe();
  }, [load, router]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    router.replace("/giris/");
  }, [router]);

  if (state.status === "loading") return <>{fallback}</>;
  if (state.status === "error") {
    return (
      <>
        {errorView(state.message, () => {
          setState({ status: "loading" });
          void load();
        })}
      </>
    );
  }
  return (
    <BusinessContext.Provider value={{ session: state.session, business: state.business, refresh: load, signOut }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness(): Ctx {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness, BusinessProvider içinde kullanılmalı");
  return ctx;
}

/** Logo dosyasının herkese açık URL'si (logos bucket'ı public) */
export function logoUrl(path: string | null): string | null {
  if (!path) return null;
  return getSupabase().storage.from("logos").getPublicUrl(path).data.publicUrl;
}

export { initials } from "./initials";
