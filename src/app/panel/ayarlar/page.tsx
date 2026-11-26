"use client";

import { useRef, useState, type FormEvent } from "react";
import { logoUrl, initials, useBusiness } from "@/lib/business";
import { getSupabase } from "@/lib/supabase";
import { reencodeImage } from "@/lib/image";
import { formatPhone } from "@/lib/phone";
import { businessSettingsSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";
import type { NotifyChannel } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/Field";
import { ErrorState, InfoBox, Notice } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconCamera, IconTrash } from "@/components/ui/icons";
import { BackLink } from "@/components/ui/BackLink";
import { MessageTemplatesEditor } from "@/components/panel/MessageTemplatesEditor";

const CHANNELS: Array<{ value: NotifyChannel; title: string; text: string; available: boolean }> = [
  { value: "wa_link", title: "WhatsApp linki", text: "Mesaj hazır gelir, kendi WhatsApp'ınızdan tek dokunuşla gönderirsiniz.", available: true },
  { value: "whatsapp_cloud", title: "WhatsApp Cloud API", text: "Mesajlar otomatik gider. Meta işletme hesabı gerekir.", available: false },
  { value: "sms", title: "SMS", text: "Mesajlar SMS sağlayıcısı üzerinden otomatik gider.", available: false },
];

function kvkkTemplate(name: string) {
  return `${name} olarak, iş takibi hizmeti kapsamında adınızı, telefon numaranızı ve işinize ait fotoğrafları yalnızca işinizin durumunu size bildirmek amacıyla işliyoruz. Verileriniz üçüncü kişilerle paylaşılmaz; takip bağlantınız iş tesliminden 30 gün sonra geçersiz olur. 6698 sayılı KVKK kapsamındaki haklarınız için bizimle iletişime geçebilirsiniz.`;
}

/** E7 · /panel/ayarlar */
export default function AyarlarPage() {
  const { business, refresh } = useBusiness();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [channel, setChannel] = useState<NotifyChannel>(business.notify_channel);
  const kvkkRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logo = logoUrl(business.logo_path);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = businessSettingsSchema.safeParse({ ...raw, notifyChannel: channel });
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    const { error } = await getSupabase()
      .from("businesses")
      .update({
        name: parsed.data.name,
        tagline: parsed.data.tagline,
        phone: parsed.data.phone,
        notify_channel: parsed.data.notifyChannel,
        kvkk_text: parsed.data.kvkkText,
      })
      .eq("id", business.id);
    setSaving(false);
    if (error) return setResult({ ok: false, text: "Ayarlar kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin." });
    setResult({ ok: true, text: "Ayarlar kaydedildi. Müşteri sayfalarında yeni bilgiler görünür." });
    await refresh();
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setLogoError(null);
    setLogoBusy(true);
    try {
      const blob = await reencodeImage(file, 512, 0.9);
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${business.id}/logo-${Date.now()}.${ext}`;
      const supabase = getSupabase();
      const up = await supabase.storage.from("logos").upload(path, blob, { contentType: blob.type, upsert: false });
      if (up.error) throw new Error("Logo yüklenemedi.");
      const { error } = await supabase.from("businesses").update({ logo_path: path }).eq("id", business.id);
      if (error) throw new Error("Logo kaydedilemedi.");
      if (business.logo_path) await supabase.storage.from("logos").remove([business.logo_path]);
      await refresh();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Logo yüklenemedi.");
    } finally {
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeLogo() {
    if (!business.logo_path) return;
    setLogoBusy(true);
    const supabase = getSupabase();
    await supabase.from("businesses").update({ logo_path: null }).eq("id", business.id);
    await supabase.storage.from("logos").remove([business.logo_path]);
    setLogoBusy(false);
    await refresh();
  }

  const err = (k: string) => errors[k];

  return (
    <main className="mx-auto box-border flex max-w-[1200px] flex-col gap-5 px-6 pt-5 pb-14">
      <BackLink href="/panel/">Aktif işler</BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">Ayarlar</h1>
        <p className="m-0 text-[15px] text-ut-text-muted">Müşterilerinizin takip sayfasında görünen işletme bilgileri</p>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <Card padding="lg" className="flex flex-col gap-4">
            <CardTitle size="lg">İşletme</CardTitle>
            <Field>
              <Label htmlFor="name">İşletme adı</Label>
              <Input id="name" name="name" defaultValue={business.name} aria-invalid={!!err("name")} aria-describedby={err("name") ? "name-error" : undefined} />
              <FieldError id="name-error">{err("name")}</FieldError>
            </Field>
            <Field>
              <Label htmlFor="tagline" optional>Kısa tanıtım</Label>
              <Input id="tagline" name="tagline" defaultValue={business.tagline ?? ""} placeholder="Örn. Oto tamir ve bakım · Kadıköy" aria-describedby="tagline-hint" />
              <FieldHint id="tagline-hint">Takip sayfasında işletme adının altında görünür.</FieldHint>
              <FieldError>{err("tagline")}</FieldError>
            </Field>
            <Field>
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={business.phone ? formatPhone(business.phone) : ""}
                placeholder="05xx xxx xx xx"
                aria-invalid={!!err("phone")}
                aria-describedby="phone-hint"
              />
              <FieldHint id="phone-hint">Müşterilerin &quot;Ara&quot; ve &quot;WhatsApp&quot; butonları bu numarayı kullanır.</FieldHint>
              <FieldError>{err("phone")}</FieldError>
            </Field>
          </Card>

          <Card padding="lg" className="flex flex-col gap-4">
            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
              <legend className="mb-3 p-0 text-xl font-bold">Bildirim kanalı</legend>
              {CHANNELS.map((c) => (
                <label
                  key={c.value}
                  className={cn(
                    "flex items-start gap-3 rounded-ut border p-3.5",
                    channel === c.value ? "border-[1.5px] border-ut-primary bg-ut-primary-soft" : "border-ut-border",
                    !c.available && "opacity-70",
                  )}
                >
                  <input
                    type="radio"
                    name="notifyChannelRadio"
                    value={c.value}
                    checked={channel === c.value}
                    disabled={!c.available}
                    onChange={() => setChannel(c.value)}
                    className="mt-1 size-5 accent-ut-primary"
                  />
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                      {c.title}
                      {!c.available && <StatusBadge tone="queued" size="sm">Yakında</StatusBadge>}
                    </span>
                    <span className="text-[13px] leading-normal text-ut-text-muted">{c.text}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <InfoBox>İş kaydedildiğinde, aşama değiştiğinde, teklif gönderildiğinde, iş hazır olduğunda ve teslim edildiğinde mesaj hazırlanır. Metinleri aşağıdaki &quot;WhatsApp mesajları&quot; bölümünden düzenleyebilirsiniz.</InfoBox>
          </Card>

          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle size="lg">KVKK aydınlatma metni</CardTitle>
              <Button
                variant="ghost"
                onClick={() => {
                  if (kvkkRef.current) kvkkRef.current.value = kvkkTemplate(business.name);
                }}
              >
                Örnek metni ekle
              </Button>
            </div>
            <Field>
              <Label htmlFor="kvkkText" optional>Metin</Label>
              <Textarea ref={kvkkRef} id="kvkkText" name="kvkkText" rows={6} defaultValue={business.kvkk_text ?? ""} aria-describedby="kvkk-hint" />
              <FieldHint id="kvkk-hint">Müşteri takip sayfasının altında bağlantı olarak gösterilir. Örnek metni kendi işletmenize göre gözden geçirin.</FieldHint>
              <FieldError>{err("kvkkText")}</FieldError>
            </Field>
          </Card>

          {result &&
            (result.ok ? <Notice tone="success" title="Kaydedildi">{result.text}</Notice> : <ErrorState title="Kaydedilemedi" description={result.text} />)}

          <Button type="submit" size="xl" loading={saving} loadingText="Kaydediliyor…" className="self-start">
            Ayarları kaydet
          </Button>
        </form>

        <Card padding="lg" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <CardTitle size="lg">Logo</CardTitle>
          <div className="flex items-center gap-4">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={`${business.name} logosu`} className="size-20 rounded-ut border border-ut-border object-cover" />
            ) : (
              <span role="img" aria-label="Logo yok" className="flex size-20 items-center justify-center rounded-ut bg-ut-primary text-2xl font-bold text-white">
                {initials(business.name)}
              </span>
            )}
            <span className="text-[13px] leading-normal text-ut-text-muted">Kare görsel önerilir. JPEG, PNG ya da WebP, en fazla 5 MB. Konum gibi meta veriler silinir.</span>
          </div>
          <input
            ref={fileRef}
            id="logo-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onLogo(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" icon={<IconCamera size={18} />} loading={logoBusy} loadingText="Yükleniyor…" onClick={() => fileRef.current?.click()}>
              {business.logo_path ? "Logoyu değiştir" : "Logo yükle"}
            </Button>
            {business.logo_path && (
              <Button variant="danger" icon={<IconTrash size={18} />} disabled={logoBusy} onClick={removeLogo}>
                Kaldır
              </Button>
            )}
          </div>
          {logoError && <ErrorState title="Logo yüklenemedi" description={logoError} />}
        </Card>
      </div>

      <MessageTemplatesEditor />
    </main>
  );
}
