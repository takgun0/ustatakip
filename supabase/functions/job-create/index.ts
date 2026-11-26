// job-create · Esnaf yeni iş kaydeder.
// Takip kodu ve token burada, sunucuda, kriptografik rastgelelikle üretilir.
// İstek: Authorization: Bearer <esnaf oturum JWT'si>, gövde: jobCreateSchema
import { adminClient, errorJson, json, preflight, readJson, requireBusiness } from "../_shared/http.ts";
import { jobCreateSchema, toFieldErrors } from "../_shared/validation.ts";
import { generateTrackingCode, generateTrackingToken } from "../_shared/tracking.ts";

const MAX_ATTEMPTS = 6;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const auth = await requireBusiness(req);
  if (!auth) return errorJson(401, "unauthorized", "Oturum bulunamadı. Lütfen yeniden giriş yapın.");

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return errorJson(400, "bad_request", "Geçersiz istek");
  }
  const parsed = jobCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(422, "validation", "Formdaki hataları düzeltin", { fields: toFieldErrors(parsed.error) });
  }
  const input = parsed.data;

  // Şablon bu işletmenin olmalı (RLS'li istemciyle okunur)
  const { data: template } = await auth.userClient
    .from("process_templates")
    .select("id, business_id, template_stages(id, position)")
    .eq("id", input.templateId)
    .maybeSingle();
  if (!template || template.business_id !== auth.businessId) {
    return errorJson(422, "validation", "Süreç şablonu bulunamadı", { fields: { templateId: "Süreç şablonu seçin" } });
  }
  const stages = [...(template.template_stages as Array<{ id: string; position: number }>)].sort((a, b) => a.position - b.position);
  if (stages.length < 2) {
    return errorJson(422, "validation", "Şablonda en az 2 aşama olmalı", { fields: { templateId: "Bu şablonda yeterli aşama yok" } });
  }

  const admin = adminClient();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: job, error } = await admin
      .from("jobs")
      .insert({
        business_id: auth.businessId,
        template_id: template.id,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        title: input.title,
        item_label: input.itemLabel,
        description: input.description,
        agreed_amount: input.agreedAmount,
        estimated_delivery: input.estimatedDelivery,
        current_stage_id: stages[0]!.id,
        tracking_code: generateTrackingCode(),
        tracking_token: generateTrackingToken(),
      })
      .select("id, tracking_code, tracking_token")
      .single();

    if (error) {
      // Kod/token çakışması (çok düşük olasılık): yeniden üret
      if (error.code === "23505") continue;
      console.error("job insert", error.code, error.message);
      return errorJson(500, "server", "İş kaydedilemedi. Lütfen yeniden deneyin.");
    }

    const { error: evError } = await admin
      .from("job_stage_events")
      .insert({ job_id: job.id, stage_id: stages[0]!.id, note: input.note });
    if (evError) console.error("first stage event", evError.message);

    return json({ job }, 201);
  }
  return errorJson(503, "busy", "Takip kodu üretilemedi. Lütfen yeniden deneyin.");
});
