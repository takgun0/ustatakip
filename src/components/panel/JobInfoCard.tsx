"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  formatLong,
  formatRelative,
  isoToLocalInput,
  localInputToIso,
} from "@/lib/dates";
import { formatTRY } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import {
  jobEditSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/validation";
import type { Job } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import {
  Field,
  FieldError,
  FieldHint,
  Input,
  Label,
  Textarea,
} from "@/components/ui/Field";
import { ErrorState, Notice } from "@/components/ui/States";
import { IconPencil } from "@/components/ui/icons";

type Props = {
  job: Pick<
    Job,
    | "id"
    | "customer_name"
    | "customer_phone"
    | "title"
    | "item_label"
    | "description"
    | "agreed_amount"
    | "estimated_delivery"
    | "created_at"
  >;
  /** Kayıttan sonra iş yeniden çekilir (başlık, kartlar ve müşteri sayfası güncellenir) */
  onSaved: () => Promise<void> | void;
};

/**
 * E4 sağ sütun · İş bilgileri. "Düzenle" ile müşteri adı/telefonu ve iş bilgileri değiştirilebilir.
 * Yazma RLS'li istemciyle (yalnızca işletme sahibi); takip kodu, bağlantı ve şablon
 * jobs_before_update tetikleyicisiyle kilitlidir.
 */
export function JobInfoCard({ job, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function startEdit() {
    setErrors({});
    setFormError(null);
    setSaved(null);
    setEditing(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    const due = raw.estimatedDelivery
      ? localInputToIso(raw.estimatedDelivery)
      : null;
    const parsed = jobEditSchema.safeParse({
      customerName: raw.customerName ?? "",
      customerPhone: raw.customerPhone ?? "",
      title: raw.title ?? "",
      itemLabel: raw.itemLabel ?? "",
      description: raw.description ?? "",
      estimatedDelivery: due,
    });
    const fieldErrors: FieldErrors = parsed.success
      ? {}
      : toFieldErrors(parsed.error);
    if (raw.estimatedDelivery && !due)
      fieldErrors.estimatedDelivery = "Geçerli bir tarih seçin";
    // Geçmiş tarih yalnızca değiştirilmişse reddedilir: eski tahmini teslim geçmiş olabilir
    const dueChanged =
      raw.estimatedDelivery !== isoToLocalInput(job.estimated_delivery);
    if (due && dueChanged && Date.parse(due) < Date.now() - 60_000) {
      fieldErrors.estimatedDelivery = "Tahmini teslim geçmiş bir zaman olamaz";
    }
    if (!parsed.success || Object.keys(fieldErrors).length)
      return setErrors(fieldErrors);
    setErrors({});

    const d = parsed.data;
    const phoneChanged = d.customerPhone !== job.customer_phone;
    setSaving(true);
    const { error } = await getSupabase()
      .from("jobs")
      .update({
        customer_name: d.customerName,
        customer_phone: d.customerPhone,
        title: d.title,
        item_label: d.itemLabel,
        description: d.description,
        estimated_delivery: d.estimatedDelivery,
      })
      .eq("id", job.id);
    setSaving(false);
    if (error)
      return setFormError(
        "Bilgiler kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin.",
      );
    setEditing(false);
    setSaved(
      phoneChanged
        ? "Bilgiler güncellendi. Müşteri kodla sorgularken artık yeni numaranın son 4 hanesini girmeli; takip bağlantısı aynı kalır."
        : "Bilgiler güncellendi. Müşterinin takip sayfası da yenilendi.",
    );
    await onSaved();
  }

  if (editing) {
    return (
      <Card as="section" padding="lg" className="flex flex-col gap-4">
        <CardTitle size="lg">İş bilgilerini düzenle</CardTitle>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <EditField
            name="customerName"
            label="Müşteri adı soyadı"
            defaultValue={job.customer_name}
            errors={errors}
            autoComplete="off"
          />
          <EditField
            name="customerPhone"
            label="Cep telefonu"
            type="tel"
            inputMode="tel"
            placeholder="05xx xxx xx xx"
            defaultValue={formatPhone(job.customer_phone)}
            hint="Müşteri takip kodunu bu numaranın son 4 hanesiyle sorgular."
            errors={errors}
          />
          <EditField
            name="title"
            label="İş başlığı"
            defaultValue={job.title}
            errors={errors}
          />
          <EditField
            name="itemLabel"
            label="Araç / ürün"
            optional
            defaultValue={job.item_label ?? ""}
            errors={errors}
          />
          <EditField
            name="estimatedDelivery"
            label="Tahmini teslim"
            optional
            type="datetime-local"
            defaultValue={isoToLocalInput(job.estimated_delivery)}
            hint="Boş bırakırsanız müşteri sayfasında tahmini teslim gösterilmez."
            errors={errors}
          />
          <Field>
            <Label htmlFor="edit-description" optional>
              Açıklama
            </Label>
            <Textarea
              id="edit-description"
              name="description"
              rows={4}
              defaultValue={job.description ?? ""}
              aria-invalid={!!errors.description}
              aria-describedby="edit-description-err"
            />
            <FieldError id="edit-description-err">
              {errors.description}
            </FieldError>
          </Field>

          {formError && (
            <ErrorState title="Kaydedilemedi" description={formError} />
          )}

          <div className="flex flex-wrap gap-2.5">
            <Button type="submit" loading={saving} loadingText="Kaydediliyor…">
              Kaydet
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Vazgeç
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card as="section" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <CardTitle size="lg">İş bilgileri</CardTitle>
        <Button
          variant="ghost"
          icon={<IconPencil size={16} />}
          onClick={startEdit}
          aria-label="İş bilgilerini düzenle"
        >
          Düzenle
        </Button>
      </div>
      {saved && (
        <Notice tone="success" title="Kaydedildi">
          {saved}
        </Notice>
      )}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[15px]">
        <dt className="text-ut-text-muted">Müşteri</dt>
        <dd className="m-0 font-semibold">{job.customer_name}</dd>
        <dt className="text-ut-text-muted">Telefon</dt>
        <dd className="m-0 font-semibold tabular-nums">
          {formatPhone(job.customer_phone)}
        </dd>
        {job.item_label && (
          <>
            <dt className="text-ut-text-muted">Araç / ürün</dt>
            <dd className="m-0 font-semibold">{job.item_label}</dd>
          </>
        )}
        <dt className="text-ut-text-muted">Anlaşılan</dt>
        <dd className="m-0 font-semibold tabular-nums">
          {job.agreed_amount != null ? formatTRY(job.agreed_amount) : "—"}
        </dd>
        <dt className="text-ut-text-muted">Tahmini teslim</dt>
        <dd className="m-0 font-semibold">
          {job.estimated_delivery ? formatLong(job.estimated_delivery) : "—"}
        </dd>
        <dt className="text-ut-text-muted">Kayıt</dt>
        <dd className="m-0">{formatRelative(job.created_at)}</dd>
      </dl>
      {job.description && (
        <p className="m-0 border-t border-ut-border pt-4 text-sm leading-normal">
          {job.description}
        </p>
      )}
    </Card>
  );
}

function EditField({
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
  const id = `edit-${name}`;
  const describedBy = [hint && `${id}-hint`, `${id}-err`]
    .filter(Boolean)
    .join(" ");
  return (
    <Field>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        aria-invalid={!!errors[name]}
        aria-describedby={describedBy}
        {...rest}
      />
      <FieldError id={`${id}-err`}>{errors[name]}</FieldError>
      {hint && <FieldHint id={`${id}-hint`}>{hint}</FieldHint>}
    </Field>
  );
}
