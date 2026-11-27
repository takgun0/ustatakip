"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { stageColor } from "@/lib/theme";
import { useBusiness } from "@/lib/business";
import {
  getSupabase,
  functionUrl,
  SUPABASE_PUBLISHABLE_KEY,
} from "@/lib/supabase";
import { localInputToIso } from "@/lib/dates";
import { parseTRY } from "@/lib/money";
import { renderMessage, waMeLink } from "@/lib/notifications";
import { trackingUrl } from "@/lib/site";
import { formatCode } from "@/lib/tracking";
import {
  jobCreateSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/validation";
import type { ProcessTemplate } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { CodeDisplay } from "@/components/ui/CodeDisplay";
import {
  Field,
  FieldError,
  FieldHint,
  Input,
  Label,
  MoneyInput,
  Select,
  Textarea,
} from "@/components/ui/Field";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Notice,
  Skeleton,
} from "@/components/ui/States";
import { IconArrowRight, IconLayers, IconPlus } from "@/components/ui/icons";
import { BackLink } from "@/components/ui/BackLink";

type Templates =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; own: ProcessTemplate[]; ready: ProcessTemplate[] };
type Created = {
  id: string;
  code: string;
  token: string;
  customerName: string;
  customerPhone: string;
  title: string;
};

const sortStages = (t: ProcessTemplate): ProcessTemplate => ({
  ...t,
  template_stages: [...(t.template_stages ?? [])].sort(
    (a, b) => a.position - b.position,
  ),
});

/** Bir dakikalık tolerans: form doldurulurken geçen süre */
function isPast(iso: string) {
  return Date.parse(iso) < Date.now() - 60_000;
}

/** E3 · /panel/is/yeni — yeni iş kaydı ve kod/link/QR başarı ekranı */
export default function YeniIsPage() {
  const { business } = useBusiness();
  const [templates, setTemplates] = useState<Templates>({ status: "loading" });
  const [templateId, setTemplateId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("process_templates")
      .select(
        "id, business_id, name, sector, created_at, template_stages(id, template_id, name, position, color)",
      )
      .order("created_at")
      .returns<ProcessTemplate[]>();
    if (error) return setTemplates({ status: "error" });
    const all = (data ?? []).map(sortStages);
    const own = all.filter((t) => t.business_id === business.id);
    setTemplates({
      status: "ready",
      own,
      ready: all.filter((t) => t.business_id === null),
    });
    setTemplateId((cur) =>
      own.some((t) => t.id === cur)
        ? cur
        : (own.find((t) => (t.template_stages?.length ?? 0) >= 2)?.id ?? ""),
    );
  }, [business.id]);

  useEffect(() => {
    // Şablonlar Supabase'den okunur (dış sistem senkronizasyonu)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (created) headingRef.current?.focus();
  }, [created]);

  async function addReadyTemplate(id: string) {
    setCloning(id);
    const { error } = await getSupabase().rpc("clone_template", {
      p_template_id: id,
    });
    setCloning(null);
    if (error) return setFormError("Şablon eklenemedi. Yeniden deneyin.");
    await load();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    const amountText = raw.agreedAmount?.trim() ?? "";
    const amount = amountText ? parseTRY(amountText) : null;
    const due = raw.estimatedDelivery
      ? localInputToIso(raw.estimatedDelivery)
      : null;

    const input = {
      templateId,
      customerName: raw.customerName ?? "",
      customerPhone: raw.customerPhone ?? "",
      title: raw.title ?? "",
      itemLabel: raw.itemLabel ?? "",
      description: raw.description ?? "",
      agreedAmount: amount,
      estimatedDelivery: due,
      note: raw.note ?? "",
    };
    const parsed = jobCreateSchema.safeParse(input);
    const fieldErrors = parsed.success ? {} : toFieldErrors(parsed.error);
    if (amountText && amount === null)
      fieldErrors.agreedAmount = "Tutarı 1.250,00 biçiminde girin";
    if (raw.estimatedDelivery && due && isPast(due))
      fieldErrors.estimatedDelivery = "Tahmini teslim geçmiş bir zaman olamaz";
    if (!parsed.success || Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      focusFirstError(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      // Güncel (gerekirse yenilenmiş) erişim belirteci
      const { data: auth } = await getSupabase().auth.getSession();
      const res = await fetch(functionUrl("job-create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${auth.session?.access_token ?? ""}`,
        },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 201 && body?.job) {
        setCreated({
          id: body.job.id,
          code: body.job.tracking_code,
          token: body.job.tracking_token,
          customerName: parsed.data.customerName,
          customerPhone: parsed.data.customerPhone,
          title: parsed.data.title,
        });
        return;
      }
      if (res.status === 422 && body?.error?.fields) {
        setErrors(body.error.fields);
        focusFirstError(body.error.fields);
      }
      setFormError(
        res.status === 401
          ? "Oturumunuzun süresi dolmuş. Sayfayı yenileyip yeniden giriş yapın."
          : (body?.error?.message ??
              "İş kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin."),
      );
    } catch {
      setFormError(
        "İş kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin.",
      );
    } finally {
      setSaving(false);
    }
  }

  function focusFirstError(fields: FieldErrors) {
    const first = Object.keys(fields)[0];
    if (!first) return;
    const el =
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`) ??
      document.getElementById(first);
    el?.focus();
  }

  function startOver() {
    setCreated(null);
    setErrors({});
    setFormError(null);
  }

  if (created) {
    const url = trackingUrl(created.token);
    const text = renderMessage(
      {
        type: "job_created",
        businessName: business.name,
        customerName: created.customerName,
        title: created.title,
        trackingCode: formatCode(created.code),
        url,
      },
      business.message_templates,
    );
    return (
      <main className="mx-auto box-border flex max-w-[720px] flex-col gap-5 px-6 pt-7 pb-14">
        <Notice tone="success" title="İş kaydedildi">
          Takip kodu, link ve QR hazır. Müşterinize WhatsApp&apos;tan gönderin
          ya da QR&apos;ı yazdırıp fişe iliştirin.
        </Notice>
        <div className="flex flex-col gap-1">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="m-0 text-[28px] font-extrabold tracking-[-0.025em] outline-none"
          >
            {created.customerName}
          </h1>
          <p className="m-0 text-[15px] text-ut-text-muted">{created.title}</p>
        </div>
        <CodeDisplay
          code={created.code}
          url={url}
          whatsappHref={waMeLink(text, created.customerPhone)}
          qrAction="print"
          printTitle={business.name}
        />
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink
            href={`/panel/is/?id=${created.id}`}
            variant="primary"
            size="lg"
            icon={<IconArrowRight size={18} />}
          >
            İşe git
          </ButtonLink>
          <Button
            variant="secondary"
            size="lg"
            onClick={startOver}
            icon={<IconPlus size={18} />}
          >
            Yeni iş kaydet
          </Button>
        </div>
      </main>
    );
  }

  const own = templates.status === "ready" ? templates.own : [];
  const selected = own.find((t) => t.id === templateId);
  const usable = own.filter((t) => (t.template_stages?.length ?? 0) >= 2);

  return (
    <main className="mx-auto box-border flex max-w-[720px] flex-col gap-5 px-6 pt-5 pb-14">
      <BackLink href="/panel/">Aktif işler</BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">
          Yeni iş
        </h1>
        <p className="m-0 text-[15px] text-ut-text-muted">
          Kaydettiğiniz anda müşteriniz için takip kodu, link ve QR üretilir.
        </p>
      </div>

      {templates.status === "loading" && (
        <LoadingRegion
          label="Süreç şablonları yükleniyor…"
          className="flex flex-col gap-4"
        >
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-5 w-64" />
          </Card>
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </Card>
        </LoadingRegion>
      )}

      {templates.status === "error" && (
        <ErrorState
          title="Süreç şablonları yüklenemedi"
          onRetry={() => {
            setTemplates({ status: "loading" });
            void load();
          }}
        />
      )}

      {templates.status === "ready" && usable.length === 0 && (
        <EmptyState
          icon={<IconLayers size={22} />}
          title="Önce bir süreç şablonu seçin"
          description="Her iş bir şablondaki aşamalardan geçer. Hazır şablonlardan birini ekleyin; sonra Süreçler sayfasından düzenleyebilirsiniz."
          action={
            <div className="mt-2 flex w-full max-w-md flex-col gap-2.5">
              {templates.ready.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-ut border border-ut-border px-4 py-3 text-left"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{t.name}</span>
                    <span className="truncate text-[13px] text-ut-text-muted">
                      {t.template_stages?.map((s) => s.name).join(" → ")}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    loading={cloning === t.id}
                    loadingText="Ekleniyor…"
                    disabled={!!cloning}
                    onClick={() => addReadyTemplate(t.id)}
                  >
                    Kullan
                  </Button>
                </div>
              ))}
              {formError && <FieldError>{formError}</FieldError>}
            </div>
          }
        />
      )}

      {templates.status === "ready" && usable.length > 0 && (
        <form
          ref={formRef}
          noValidate
          onSubmit={onSubmit}
          className="flex flex-col gap-5"
        >
          <Card padding="lg" className="flex flex-col gap-4">
            <CardTitle>Süreç</CardTitle>
            <Field>
              <Label htmlFor="templateId">Süreç şablonu</Label>
              <Select
                id="templateId"
                name="templateId"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                aria-invalid={!!errors.templateId}
                aria-describedby="templateId-hint templateId-err"
              >
                {usable.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <FieldError id="templateId-err">{errors.templateId}</FieldError>
              <FieldHint id="templateId-hint">
                Aşamaları <Link href="/panel/surecler/">Süreçler</Link>{" "}
                sayfasından düzenleyebilirsiniz.
              </FieldHint>
            </Field>
            {selected && (
              <ol
                className="m-0 flex list-none flex-wrap gap-2 p-0"
                aria-label="Bu şablonun aşamaları"
              >
                {selected.template_stages?.map((s, i) => (
                  <li
                    key={s.id}
                    className={cn(
                      "inline-flex h-8 items-center gap-2 rounded-full border border-ut-border px-3 text-[13px] font-semibold",
                      i === 0
                        ? "bg-ut-accent text-ut-on-accent"
                        : "bg-ut-surface text-ut-text-muted",
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: stageColor(s.color) }}
                      aria-hidden="true"
                    />
                    {s.name}
                    {i === 0 && (
                      <span className="sr-only"> (iş bu aşamada başlar)</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-4">
            <CardTitle>Müşteri</CardTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="customerName"
                label="Ad soyad"
                autoComplete="off"
                errors={errors}
              />
              <TextField
                name="customerPhone"
                label="Cep telefonu"
                type="tel"
                inputMode="tel"
                placeholder="05xx xxx xx xx"
                hint="Takip sayfasında son 4 hane ile doğrulama yapılır."
                errors={errors}
              />
            </div>
          </Card>

          <Card padding="lg" className="flex flex-col gap-4">
            <CardTitle>İş</CardTitle>
            <TextField
              name="title"
              label="İş başlığı"
              placeholder="Örn. Fren ve debriyaj bakımı"
              errors={errors}
            />
            <TextField
              name="itemLabel"
              label="Araç / ürün"
              optional
              placeholder="Örn. 2016 Renault Clio · 34 ABC 123"
              errors={errors}
            />
            <Field>
              <Label htmlFor="description" optional>
                Açıklama
              </Label>
              <Textarea
                id="description"
                name="description"
                aria-invalid={!!errors.description}
                aria-describedby="description-err"
              />
              <FieldError id="description-err">{errors.description}</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label htmlFor="agreedAmount" optional>
                  Anlaşılan tutar
                </Label>
                <MoneyInput
                  id="agreedAmount"
                  name="agreedAmount"
                  placeholder="0,00"
                  aria-invalid={!!errors.agreedAmount}
                  aria-describedby="agreedAmount-err"
                />
                <FieldError id="agreedAmount-err">
                  {errors.agreedAmount}
                </FieldError>
              </Field>
              <Field>
                <Label htmlFor="estimatedDelivery" optional>
                  Tahmini teslim
                </Label>
                <Input
                  id="estimatedDelivery"
                  name="estimatedDelivery"
                  type="datetime-local"
                  className="h-[52px]"
                  aria-invalid={!!errors.estimatedDelivery}
                  aria-describedby="estimatedDelivery-err"
                />
                <FieldError id="estimatedDelivery-err">
                  {errors.estimatedDelivery}
                </FieldError>
              </Field>
            </div>
            <Field>
              <Label htmlFor="note" optional>
                {selected?.template_stages?.[0]
                  ? `"${selected.template_stages[0].name}" notu`
                  : "İlk aşama notu"}
              </Label>
              <Textarea
                id="note"
                name="note"
                rows={2}
                placeholder="Müşteri takip sayfasında görür"
                aria-invalid={!!errors.note}
                aria-describedby="note-err"
              />
              <FieldError id="note-err">{errors.note}</FieldError>
            </Field>
          </Card>

          {formError && (
            <ErrorState title="İş kaydedilemedi" description={formError} />
          )}

          <div className="flex flex-wrap justify-end gap-2.5">
            <ButtonLink href="/panel/" variant="ghost" size="xl">
              Vazgeç
            </ButtonLink>
            <Button
              type="submit"
              variant="accent"
              size="xl"
              loading={saving}
              loadingText="Kaydediliyor…"
              icon={<IconPlus size={18} />}
            >
              İşi kaydet ve kod üret
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}

function TextField({
  name,
  label,
  hint,
  optional,
  errors,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
  errors: FieldErrors;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint && `${name}-hint`, `${name}-err`]
    .filter(Boolean)
    .join(" ");
  return (
    <Field>
      <Label htmlFor={name} optional={optional}>
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        aria-invalid={!!errors[name]}
        aria-describedby={describedBy}
        {...rest}
      />
      <FieldError id={`${name}-err`}>{errors[name]}</FieldError>
      {hint && <FieldHint id={`${name}-hint`}>{hint}</FieldHint>}
    </Field>
  );
}
