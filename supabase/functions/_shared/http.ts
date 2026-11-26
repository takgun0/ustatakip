// Edge Function ortak HTTP yardımcıları (yalnızca Deno'da çalışır)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Kimlik doğrulama çerez değil Authorization başlığıyla yapıldığı için "*" güvenlidir.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function errorJson(status: number, code: string, message: string, extra?: Record<string, unknown>): Response {
  return json({ error: { code, message, ...extra } }, status);
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorJson(405, "method_not_allowed", "Yalnızca POST desteklenir");
  return null;
}

export async function readJson(req: Request, maxBytes = 32_768): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("too_large");
  return JSON.parse(text);
}

/** service_role istemcisi: RLS'i atlar, yalnızca doğrulamadan sonra kullanılır */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** İsteği yapan esnafın kimliğiyle çalışan istemci (RLS geçerli) */
export function userClient(req: Request): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Oturumdaki esnafın işletmesi; yoksa null */
export async function requireBusiness(req: Request): Promise<{ businessId: string; userClient: SupabaseClient } | null> {
  const client = userClient(req);
  const { data: userData, error } = await client.auth.getUser();
  if (error || !userData.user) return null;
  const { data } = await client.from("businesses").select("id").eq("owner_id", userData.user.id).maybeSingle();
  if (!data) return null;
  return { businessId: data.id as string, userClient: client };
}

/** İstemci IP'si (Supabase önündeki proxy x-forwarded-for ekler) */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "0.0.0.0";
}
