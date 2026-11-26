"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Tarayıcı istemcisi. Yalnızca herkese açık (publishable) anahtar kullanılır;
 * service_role anahtarı yalnızca Supabase Edge Function secret'larında durur.
 */
let client: SupabaseClient | null = null;

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY tanımlı olmalı (.env.local)");
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

/** Edge Function URL'si: /functions/v1/<ad> */
export function functionUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}
