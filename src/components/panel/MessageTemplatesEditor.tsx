"use client";

import { useRef, useState } from "react";
import { useBusiness } from "@/lib/business";
import { getSupabase } from "@/lib/supabase";
import { trackingUrl } from "@/lib/site";
import {
  DEFAULT_TEMPLATES,
  EDITABLE_MESSAGE_TYPES,
  TEMPLATE_FIELDS,
  TEMPLATE_MAX_LENGTH,
  renderMessage,
  unknownFields,
  type EditableMessageType,
  type MessageTemplates,
  type NotificationEvent,
} from "@/lib/notifications";
import { messageTemplatesSchema } from "@/lib/validation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, FieldHint, Label, Textarea } from "@/components/ui/Field";
import { ErrorState, Notice } from "@/components/ui/States";

const INFO: Record<EditableMessageType, { title: string; when: string }> = {
  job_created: {
    title: "İş kaydı",
    when: "Yeni iş kaydedildiğinde, takip linkiyle birlikte gönderilir.",
  },
  stage_changed: {
    title: "Aşama değişti",
    when: "İş bir sonraki aşamaya geçtiğinde gönderilir.",
  },
  offer_sent: {
    title: "Ek masraf teklifi",
    when: "Müşteriye ek iş için fiyat teklifi gönderildiğinde kullanılır.",
  },
  job_ready: {
    title: "İş hazır",
    when: "İş son aşamaya geldiğinde, teslim almaya çağırmak için gönderilir.",
  },
  job_delivered: {
    title: "Teslim edildi",
    when: "Teslim işaretlendikten sonra teşekkür için gönderilir.",
  },
};

const FIELD_LABELS: Record<string, string> = {
  müşteri: "Müşterinin adı",
  iş: "İş başlığı",
  kod: "Takip kodu",
  link: "Takip linki",
  işletme: "İşletme adı",
  aşama: "Aşama adı",
  teklif: "Teklif başlığı",
  tutar: "Tutar",
};

function sampleEvent(
  type: EditableMessageType,
  businessName: string,
): NotificationEvent {
  const base = {
    businessName,
    customerName: "Ayşe Kaya",
    title: "Fren bakımı",
    url: trackingUrl("ornek-baglanti"),
  };
  switch (type) {
    case "job_created":
      return { type, ...base, trackingCode: "UT-7K4M-29" };
    case "stage_changed":
      return { type, ...base, stageName: "Parça Bekleniyor" };
    case "offer_sent":
      return { type, ...base, offerTitle: "Rot başı değişimi", amount: 320000 };
    case "job_ready":
      return { type, ...base };
    case "job_delivered":
      return { type, ...base };
  }
}

function initialDrafts(
  saved: MessageTemplates | null,
): Record<EditableMessageType, string> {
  return Object.fromEntries(
    EDITABLE_MESSAGE_TYPES.map((t) => [
      t,
      saved?.[t]?.trim() || DEFAULT_TEMPLATES[t],
    ]),
  ) as Record<EditableMessageType, string>;
}

/** Yalnızca varsayılandan farklı ve boş olmayan şablonlar saklanır */
function toStored(
  drafts: Record<EditableMessageType, string>,
): MessageTemplates {
  const out: MessageTemplates = {};
  for (const t of EDITABLE_MESSAGE_TYPES) {
    const v = drafts[t].trim();
    if (v && v !== DEFAULT_TEMPLATES[t]) out[t] = v;
  }
  return out;
}

/** E7 · WhatsApp mesaj şablonları */
export function MessageTemplatesEditor() {
  const { business, refresh } = useBusiness();
  const [drafts, setDrafts] = useState(() =>
    initialDrafts(business.message_templates),
  );
  const [savedJson, setSavedJson] = useState(() =>
    JSON.stringify(toStored(initialDrafts(business.message_templates))),
  );
  const [type, setType] = useState<EditableMessageType>("job_created");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const draft = drafts[type];
  const fields = TEMPLATE_FIELDS[type];
  const unknown = unknownFields(type, draft);
  const missingLink = fields.includes("link") && !/\{\s*link\s*\}/i.test(draft);
  const empty = draft.trim() === "";
  const preview = renderMessage(sampleEvent(type, business.name), {
    [type]: draft,
  });
  const stored = toStored(drafts);
  const dirty = JSON.stringify(stored) !== savedJson;

  function setDraft(value: string) {
    setResult(null);
    setDrafts((d) => ({ ...d, [type]: value }));
  }

  function insertField(field: string) {
    const el = areaRef.current;
    const token = `{${field}}`;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + token + draft.slice(end);
    if (next.length > TEMPLATE_MAX_LENGTH) return;
    setDraft(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setResult(null);
    const parsed = messageTemplatesSchema.safeParse(stored);
    if (!parsed.success)
      return setResult({
        ok: false,
        text: "Mesajlardan biri çok uzun. En fazla 1000 karakter yazabilirsiniz.",
      });
    setSaving(true);
    const { error } = await getSupabase()
      .from("businesses")
      .update({ message_templates: parsed.data })
      .eq("id", business.id);
    setSaving(false);
    if (error)
      return setResult({
        ok: false,
        text: "Mesajlar kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin.",
      });
    setSavedJson(JSON.stringify(parsed.data));
    setResult({
      ok: true,
      text: "Mesajlar kaydedildi. Bundan sonra hazırlanan WhatsApp mesajları bu metinleri kullanır.",
    });
    await refresh();
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <CardTitle size="lg">WhatsApp mesajları</CardTitle>
        <p className="m-0 text-[14px] leading-normal text-ut-text-muted">
          Müşteriye giden hazır mesajları kendi üslubunuzla yazın. Süslü
          parantez içindeki alanlar mesaj hazırlanırken doldurulur.
        </p>
      </div>

      <div
        role="group"
        aria-label="Mesaj türü"
        className="flex flex-wrap gap-2"
      >
        {EDITABLE_MESSAGE_TYPES.map((t) => {
          const custom = drafts[t].trim() !== DEFAULT_TEMPLATES[t];
          return (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-ut border px-3.5 text-[14px] font-semibold",
                type === t
                  ? "border-[1.5px] border-ut-primary bg-ut-primary-soft text-ut-primary"
                  : "border-ut-border bg-ut-surface text-ut-text hover:bg-ut-primary-soft",
              )}
            >
              {INFO[t].title}
              {custom && (
                <>
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-ut-accent"
                  />
                  <span className="sr-only">(düzenlendi)</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
          <Field>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="template-text">{INFO[type].title} mesajı</Label>
              <span
                className="text-[13px] text-ut-text-muted"
                aria-live="polite"
              >
                {draft.length}/{TEMPLATE_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              ref={areaRef}
              id="template-text"
              rows={6}
              maxLength={TEMPLATE_MAX_LENGTH}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-describedby="template-hint"
            />
            <FieldHint id="template-hint">{INFO[type].when}</FieldHint>
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ut-text-muted">
              İmlecin olduğu yere alan ekle
            </span>
            <div className="flex flex-wrap gap-2">
              {fields.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => insertField(f)}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-ut border border-ut-border bg-ut-surface px-3 text-[13px] text-ut-text hover:bg-ut-primary-soft"
                >
                  <code className="font-semibold text-ut-primary">{`{${f}}`}</code>
                  <span className="text-ut-text-muted">{FIELD_LABELS[f]}</span>
                </button>
              ))}
            </div>
          </div>

          {(missingLink || unknown.length > 0 || empty) && (
            <Notice tone="warning" title="Kontrol edin">
              <ul className="m-0 flex flex-col gap-1 pl-4">
                {empty && (
                  <li>Mesaj boş. Kaydederseniz varsayılan metin kullanılır.</li>
                )}
                {!empty && missingLink && (
                  <li>
                    Mesajda {"{link}"} yok; müşteri takip sayfasına ulaşamaz.
                  </li>
                )}
                {unknown.length > 0 && (
                  <li>
                    Bu mesajda kullanılamayan alan:{" "}
                    {unknown.map((u) => `{${u}}`).join(", ")}. Olduğu gibi
                    gönderilir.
                  </li>
                )}
              </ul>
            </Notice>
          )}

          <Button
            variant="ghost"
            className="self-start"
            disabled={draft === DEFAULT_TEMPLATES[type]}
            onClick={() => setDraft(DEFAULT_TEMPLATES[type])}
          >
            Varsayılan metne dön
          </Button>
        </div>

        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
          <span
            id="template-preview-label"
            className="text-[13px] font-semibold text-ut-text-muted"
          >
            Önizleme (örnek bilgilerle)
          </span>
          <div
            aria-labelledby="template-preview-label"
            className="rounded-ut rounded-tl-none border border-ut-border bg-ut-success-tint px-4 py-3 text-[15px] leading-normal break-words whitespace-pre-wrap text-ut-text"
          >
            {preview}
          </div>
        </div>
      </div>

      {result &&
        (result.ok ? (
          <Notice tone="success" title="Kaydedildi">
            {result.text}
          </Notice>
        ) : (
          <ErrorState title="Kaydedilemedi" description={result.text} />
        ))}

      <Button
        size="xl"
        className="self-start"
        loading={saving}
        loadingText="Kaydediliyor…"
        disabled={!dirty}
        onClick={save}
      >
        Mesajları kaydet
      </Button>
    </Card>
  );
}
