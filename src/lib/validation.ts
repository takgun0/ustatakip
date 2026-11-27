import { z } from "zod";
import { normalizePhone } from "./phone.ts";
import { isTrackingToken, normalizeTrackingCode } from "./tracking.ts";

/**
 * Tüm girdiler buradaki şemalarla doğrulanır. Hata mesajları Türkçe.
 * Bu dosya Edge Function'lara da kopyalanır (npm run sync:functions): yalnızca
 * "zod" ve göreli ".ts" importları kullanın.
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} en az ${min} karakter olmalı`)
    .max(max, `${label} en fazla ${max} karakter olabilir`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} en fazla ${max} karakter olabilir`)
    .transform((v) => (v === "" ? null : v));

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({
        code: "custom",
        message: "Geçerli bir cep telefonu girin (05xx xxx xx xx)",
      });
      return z.NEVER;
    }
    return p;
  });

export const SECTORS = [
  "Oto Tamir",
  "Oto Yıkama",
  "Kaporta ve Boya",
  "Mobilya",
  "Elektronik Tamiri",
  "Tadilat ve Tesisat",
  "Terzi",
  "Ayakkabı Tamiri",
] as const;

export const signInSchema = z.object({
  email: z.email("Geçerli bir e-posta girin").trim(),
  password: z.string().min(1, "Şifrenizi girin"),
});

export const signUpSchema = z.object({
  businessName: trimmed(2, 80, "İşletme adı"),
  sector: z.enum([...SECTORS, "Diğer"], { message: "Sektör seçin" }),
  phone: phoneSchema,
  email: z.email("Geçerli bir e-posta girin").trim(),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .max(72, "Şifre en fazla 72 karakter olabilir"),
});

export const NOTIFY_CHANNELS = ["wa_link", "whatsapp_cloud", "sms"] as const;

export const businessSettingsSchema = z.object({
  name: trimmed(2, 80, "İşletme adı"),
  tagline: optionalText(80, "Kısa tanıtım"),
  phone: phoneSchema,
  notifyChannel: z.enum(NOTIFY_CHANNELS),
  kvkkText: optionalText(5000, "KVKK metni"),
});

/** E7 · mesaj şablonları (businesses.message_templates). Boş olanlar saklanmaz. */
const templateText = z
  .string()
  .trim()
  .min(1)
  .max(1000, "Mesaj en fazla 1000 karakter olabilir");
export const messageTemplatesSchema = z
  .object({
    job_created: templateText.optional(),
    stage_changed: templateText.optional(),
    offer_sent: templateText.optional(),
    job_ready: templateText.optional(),
    job_delivered: templateText.optional(),
  })
  .strict();

/** Kuruş cinsinden tutar (en fazla 10 milyon ₺) */
export const kurusSchema = z
  .number({ message: "Geçerli bir tutar girin" })
  .int("Tutar kuruş cinsinden tam sayı olmalı")
  .min(1, "Tutar 0'dan büyük olmalı")
  .max(1_000_000_000, "Tutar çok yüksek");

export const jobCreateSchema = z.object({
  templateId: z.uuid("Süreç şablonu seçin"),
  customerName: trimmed(2, 80, "Müşteri adı"),
  customerPhone: phoneSchema,
  title: trimmed(2, 120, "İş başlığı"),
  itemLabel: optionalText(120, "Araç / ürün bilgisi"),
  description: optionalText(2000, "Açıklama"),
  agreedAmount: kurusSchema.nullable(),
  estimatedDelivery: z.iso
    .datetime({ offset: true, message: "Geçerli bir tarih seçin" })
    .nullable(),
  note: optionalText(1000, "İlk aşama notu"),
});

/** E4 · iş bilgilerini düzenleme (kod, token ve şablon değişmez; tetikleyici de engeller) */
export const jobEditSchema = jobCreateSchema.pick({
  customerName: true,
  customerPhone: true,
  title: true,
  itemLabel: true,
  description: true,
  estimatedDelivery: true,
});
export type JobCreateInput = z.input<typeof jobCreateSchema>;

/** M1: takip kodu + telefonun son 4 hanesi */
export const trackLookupSchema = z.object({
  code: z
    .string()
    .max(20, "Takip kodunu kontrol edin")
    .transform((v, ctx) => {
      const c = normalizeTrackingCode(v);
      if (!c) {
        ctx.addIssue({
          code: "custom",
          message: "Takip kodunu UT-XXXX-XX biçiminde girin",
        });
        return z.NEVER;
      }
      return c;
    }),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Telefonunuzun son 4 hanesini girin"),
});

export const trackingTokenSchema = z
  .string()
  .refine(isTrackingToken, "Geçersiz takip bağlantısı");

export const trackGetSchema = z.object({ token: trackingTokenSchema });

/** E4: aşama fotoğrafı yükleme (multipart alanları; dosya ayrıca denetlenir) */
export const mediaUploadSchema = z.object({
  jobId: z.uuid("Geçersiz iş"),
  stageId: z.uuid("Geçersiz aşama").nullable(),
  caption: optionalText(200, "Açıklama").nullable(),
});

/** Aşama renkleri: yalnızca --ut-* paletinden (design/tokens) */
export const STAGE_COLORS = [
  "#1E3A5F",
  "#2563EB",
  "#F59E0B",
  "#D97706",
  "#16A34A",
  "#DC2626",
  "#6B7280",
] as const;

/** E5: süreç şablonu kaydetme */
export const templateSaveSchema = z.object({
  name: trimmed(2, 60, "Şablon adı"),
  stages: z
    .array(
      z.object({
        id: z.uuid().nullable(),
        name: trimmed(1, 40, "Aşama adı"),
        color: z.enum(STAGE_COLORS, "Paletten bir renk seçin"),
      }),
    )
    .min(2, "En az 2 aşama olmalı")
    .max(12, "En fazla 12 aşama olabilir"),
});
export type TemplateSaveInput = z.input<typeof templateSaveSchema>;

/** M3: müşterinin teklif yanıtı (karşı teklifte tutar zorunlu) */
export const offerActionSchema = z
  .object({
    token: trackingTokenSchema,
    offerId: z.uuid("Geçersiz teklif"),
    action: z.enum(["accept", "reject", "counter"], "Geçersiz işlem"),
    amount: kurusSchema.nullable().optional(),
    note: optionalText(500, "Not").optional(),
  })
  .refine((v) => v.action !== "counter" || v.amount != null, {
    message: "Karşı teklif tutarını girin",
    path: ["amount"],
  });

/** E4: esnafın yeni teklifi */
export const offerCreateSchema = z.object({
  jobId: z.uuid("Geçersiz iş"),
  title: trimmed(2, 120, "Teklif başlığı"),
  description: optionalText(2000, "Açıklama"),
  amount: kurusSchema,
});

/** E4: esnafın karşı teklife yanıtı */
export const offerRespondSchema = z
  .object({
    offerId: z.uuid("Geçersiz teklif"),
    action: z.enum(["accept", "reject", "propose"], "Geçersiz işlem"),
    amount: kurusSchema.nullable().optional(),
    note: optionalText(500, "Not").optional(),
  })
  .refine((v) => v.action !== "propose" || v.amount != null, {
    message: "Yeni fiyatı girin",
    path: ["amount"],
  });

/** E4: aşama notu */
export const stageNoteSchema = optionalText(1000, "Not");

export type FieldErrors = Record<string, string>;

/** Zod hatasını { alan: ilk mesaj } biçimine çevirir */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
