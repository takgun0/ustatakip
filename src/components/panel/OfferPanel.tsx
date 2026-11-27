"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  getSupabase,
  functionUrl,
  SUPABASE_PUBLISHABLE_KEY,
} from "@/lib/supabase";
import { formatRelative } from "@/lib/dates";
import { formatTRY, parseTRY } from "@/lib/money";
import {
  renderMessage,
  waMeLink,
  type MessageTemplates,
} from "@/lib/notifications";
import { MAX_ROUNDS } from "@/lib/offers";
import type { OfferStatus } from "@/lib/types";
import { offerCreateSchema, toFieldErrors } from "@/lib/validation";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import {
  Field,
  FieldError,
  FieldHint,
  Input,
  Label,
  MoneyInput,
  Textarea,
} from "@/components/ui/Field";
import { ErrorState, Notice, Skeleton } from "@/components/ui/States";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { IconCheck, IconPlus, IconWhatsApp } from "@/components/ui/icons";

type Round = {
  round_no: number;
  actor: "business" | "customer";
  action: string;
  amount: number | null;
  note: string | null;
  created_at: string;
};
type Offer = {
  id: string;
  title: string;
  description: string | null;
  status: OfferStatus;
  current_amount: number;
  final_amount: number | null;
  created_at: string;
  offer_rounds: Round[];
};
type Flash = {
  tone: "success" | "danger" | "info";
  title: string;
  text?: string;
  wa?: string;
} | null;

export type OfferPanelJob = {
  id: string;
  status: string;
  title: string;
  customer_name: string;
  customer_phone: string;
};

const STATUS: Record<OfferStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: "warning", label: "Yanıt bekleniyor" },
  countered: { tone: "info", label: "Karşı teklif geldi" },
  accepted: { tone: "success", label: "Kabul edildi" },
  rejected: { tone: "danger", label: "Reddedildi" },
  expired: { tone: "queued", label: "Kapandı" },
};

const roundOf = (o: Offer) =>
  o.offer_rounds.reduce((m, r) => Math.max(m, r.round_no), 1);
const sortedRounds = (o: Offer) =>
  [...o.offer_rounds].sort((a, b) => a.created_at.localeCompare(b.created_at));

async function manage(
  body: Record<string, unknown>,
): Promise<
  { ok: true } | { ok: false; message: string; fields?: Record<string, string> }
> {
  const { data } = await getSupabase().auth.getSession();
  try {
    const res = await fetch(functionUrl("offer-manage"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => null);
    return {
      ok: false,
      message: json?.error?.message ?? "İşlem tamamlanamadı. Yeniden deneyin.",
      fields: json?.error?.fields,
    };
  } catch {
    return {
      ok: false,
      message:
        "Bağlantı kurulamadı. İnternetinizi kontrol edip yeniden deneyin.",
    };
  }
}

/**
 * E4 sağ sütun: ek masraf teklifleri. Yeni teklif, karşı teklife yanıt (kabul/ret/yeni fiyat), geçmiş.
 * Yazma offer-manage Edge Function'ı ile; okuma RLS'li istemciyle. Kabulde onJobChanged ile iş toplamı yenilenir.
 */
export function OfferPanel({
  job,
  businessName,
  templates,
  trackingUrl,
  onJobChanged,
}: {
  job: OfferPanelJob;
  businessName: string;
  templates?: MessageTemplates | null;
  trackingUrl: string;
  onJobChanged: () => void;
}) {
  const [offers, setOffers] = useState<Offer[] | null | "error">(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [creating, setCreating] = useState(false);

  const fetchOffers = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("offers")
      .select(
        "id, title, description, status, current_amount, final_amount, created_at, offer_rounds(round_no, actor, action, amount, note, created_at)",
      )
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .returns<Offer[]>();
    setOffers(error ? "error" : (data ?? []));
  }, [job.id]);

  useEffect(() => {
    // Teklifler Supabase'den okunur; sekmeye dönüldüğünde müşterinin yanıtı için yenilenir
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOffers();
    const onVisible = () =>
      document.visibilityState === "visible" && void fetchOffers();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchOffers]);

  const offerSentWa = (offerTitle: string, amount: number) =>
    waMeLink(
      renderMessage(
        {
          type: "offer_sent",
          businessName,
          customerName: job.customer_name,
          title: job.title,
          offerTitle,
          amount,
          url: trackingUrl,
        },
        templates,
      ),
      job.customer_phone,
    );

  if (offers === null)
    return (
      <Card as="section" padding="lg" className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  if (offers === "error")
    return (
      <ErrorState
        title="Teklifler yüklenemedi"
        onRetry={() => void fetchOffers()}
      />
    );

  const waiting = offers.find((o) => o.status === "countered");
  const hasOpen = offers.some(
    (o) => o.status === "pending" || o.status === "countered",
  );
  const canCreate = job.status === "active" && !hasOpen;

  async function after(next: Flash, jobChanged = false) {
    setFlash(next);
    await fetchOffers();
    if (jobChanged) onJobChanged();
  }

  return (
    <>
      {waiting && (
        <CounterCard
          key={`${waiting.id}-${roundOf(waiting)}`}
          offer={waiting}
          customerName={job.customer_name}
          onDone={(f, changed) => void after(f, changed)}
          offerSentWa={offerSentWa}
        />
      )}

      {flash && (
        <Notice
          tone={flash.tone}
          title={flash.title}
          action={
            flash.wa && (
              <a
                href={flash.wa}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("whatsapp", "md", "mt-2 self-start")}
              >
                <IconWhatsApp size={18} />
                Müşteriye WhatsApp&apos;tan gönder
              </a>
            )
          }
        >
          {flash.text}
        </Notice>
      )}

      <Card
        as="section"
        padding="lg"
        className="flex flex-col gap-3.5"
        aria-labelledby="offers-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle size="lg">
            <span id="offers-title">Teklifler</span>
          </CardTitle>
          {canCreate && !creating && (
            <Button
              variant="accent"
              icon={<IconPlus size={18} />}
              onClick={() => {
                setCreating(true);
                setFlash(null);
              }}
            >
              Teklif Oluştur
            </Button>
          )}
        </div>

        {creating && (
          <NewOfferForm
            jobId={job.id}
            onCancel={() => setCreating(false)}
            onCreated={(title, amount) => {
              setCreating(false);
              void after({
                tone: "success",
                title: "Teklif gönderildi",
                text: "Müşteri takip sayfasında teklifi görür. WhatsApp'tan haber verebilirsiniz.",
                wa: offerSentWa(title, amount),
              });
            }}
          />
        )}

        {!canCreate && job.status === "active" && hasOpen && !creating && (
          <span className="text-[13px] text-ut-text-muted">
            Yanıt bekleyen teklif kapanınca yeni teklif oluşturabilirsiniz.
          </span>
        )}

        {offers.length === 0 && !creating && (
          <p className="m-0 text-sm leading-normal text-ut-text-muted">
            Henüz teklif yok. İş sırasında ek parça ya da işçilik gerekirse
            buradan müşteriye onaya gönderin.
          </p>
        )}

        {offers.map((o) => (
          <OfferSummary key={o.id} offer={o} />
        ))}
      </Card>
    </>
  );
}

function NewOfferForm({
  jobId,
  onCancel,
  onCreated,
}: {
  jobId: string;
  onCancel: () => void;
  onCreated: (title: string, amount: number) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const amount = parseTRY(String(data.get("amount") ?? ""));
    const input = {
      jobId,
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      amount: amount ?? NaN,
    };
    const parsed = offerCreateSchema.safeParse(input);
    if (!parsed.success) {
      const f = toFieldErrors(parsed.error);
      if (amount == null) f.amount = "Geçerli bir tutar girin (örn. 1.250,00)";
      return setErrors(f);
    }
    setErrors({});
    setError(null);
    setBusy(true);
    const res = await manage({ op: "create", ...input });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      if (res.fields) setErrors(res.fields);
      return;
    }
    onCreated(parsed.data.title, parsed.data.amount);
  }

  return (
    <Card
      as="form"
      padding="sm"
      className="flex flex-col gap-3 border-[1.5px] border-ut-primary shadow-none"
      onSubmit={(e) => void submit(e)}
    >
      <CardTitle size="sm" as="h3">
        Yeni teklif
      </CardTitle>
      <Field>
        <Label htmlFor="of-title">Başlık</Label>
        <Input
          id="of-title"
          name="title"
          maxLength={120}
          placeholder="Örn. Ön fren diski değişimi"
          aria-invalid={!!errors.title}
          aria-describedby="of-title-err"
        />
        <FieldError id="of-title-err">{errors.title}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="of-desc" optional="müşteri görür">
          Açıklama
        </Label>
        <Textarea
          id="of-desc"
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="Neden gerekli, hangi parça kullanılacak?"
          aria-invalid={!!errors.description}
          aria-describedby="of-desc-err"
        />
        <FieldError id="of-desc-err">{errors.description}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="of-amount">Tutar</Label>
        <MoneyInput
          id="of-amount"
          name="amount"
          placeholder="1.250,00"
          aria-invalid={!!errors.amount}
          aria-describedby={errors.amount ? "of-amount-err" : "of-amount-hint"}
        />
        {errors.amount ? (
          <FieldError id="of-amount-err">{errors.amount}</FieldError>
        ) : (
          <FieldHint id="of-amount-hint">
            Parça + işçilik, KDV dahil. Müşteri en fazla {MAX_ROUNDS} tur
            pazarlık yapabilir.
          </FieldHint>
        )}
      </Field>
      {error && (
        <Notice tone="danger" title="Teklif gönderilemedi">
          {error}
        </Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="accent" loading={busy}>
          Teklifi Gönder
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Vazgeç
        </Button>
      </div>
    </Card>
  );
}

function CounterCard({
  offer: o,
  customerName,
  onDone,
  offerSentWa,
}: {
  offer: Offer;
  customerName: string;
  onDone: (flash: Flash, jobChanged?: boolean) => void;
  offerSentWa: (title: string, amount: number) => string;
}) {
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState<"accept" | "reject" | "propose" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const rounds = sortedRounds(o);
  const round = roundOf(o);
  const counter = [...rounds]
    .reverse()
    .find((r) => r.actor === "customer" && r.action === "counter");
  const ourPrice =
    [...rounds]
      .reverse()
      .find((r) => r.actor === "business" && r.amount != null)?.amount ??
    o.current_amount;
  const canPropose = round < MAX_ROUNDS;

  async function respond(
    action: "accept" | "reject" | "propose",
    amount?: number,
    note?: string,
  ) {
    setBusy(action);
    setError(null);
    const res = await manage({
      op: "respond",
      offerId: o.id,
      action,
      ...(action === "propose" ? { amount, note } : {}),
    });
    setBusy(null);
    if (!res.ok) {
      if (res.fields?.amount) setAmountError(res.fields.amount);
      return setError(res.message);
    }
    if (action === "accept")
      onDone(
        {
          tone: "success",
          title: "Karşı teklifi kabul ettiniz",
          text: `${formatTRY(o.current_amount)} iş toplamına eklendi. Müşterinin takip sayfası güncellendi.`,
        },
        true,
      );
    else if (action === "reject")
      onDone({
        tone: "danger",
        title: "Karşı teklifi reddettiniz",
        text: "Teklif kapandı. İsterseniz yeni bir teklif oluşturabilirsiniz.",
      });
    else
      onDone({
        tone: "info",
        title: `Yeni fiyat gönderildi · Tur ${round + 1} / ${MAX_ROUNDS}`,
        text: `Müşterinin yanıtı bekleniyor.${round + 1 === MAX_ROUNDS ? " Bu son tur: müşteri yalnızca kabul edebilir ya da reddedebilir." : ""}`,
        wa: offerSentWa(o.title, amount!),
      });
  }

  function submitNew(e: FormEvent<HTMLElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const amount = parseTRY(String(data.get("amount") ?? ""));
    if (amount == null || amount <= 0)
      return setAmountError("Geçerli bir tutar girin (örn. 1.250,00)");
    setAmountError(null);
    void respond("propose", amount, String(data.get("note") ?? ""));
  }

  return (
    <Card
      as="section"
      padding="lg"
      className="flex flex-col gap-3.5 border-[1.5px] border-ut-info"
      aria-labelledby="counter-title"
    >
      <div className="flex items-center justify-between gap-2">
        <StatusBadge tone="info">Karşı teklif geldi</StatusBadge>
        <span className="text-[13px] font-semibold text-ut-text-muted">
          Tur {round} / {MAX_ROUNDS}
        </span>
      </div>
      <h2 id="counter-title" className="m-0 text-lg font-bold">
        {o.title}
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5 rounded-ut bg-ut-bg p-3">
          <span className="text-xs text-ut-text-muted">Sizin teklifiniz</span>
          <span className="text-lg font-bold text-ut-text-muted tabular-nums">
            {formatTRY(ourPrice)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-ut bg-ut-info-tint p-3">
          <span className="text-xs">Müşterinin teklifi</span>
          <span className="text-[22px] font-bold tabular-nums">
            {formatTRY(o.current_amount)}
          </span>
        </div>
      </div>
      {counter?.note && (
        <blockquote className="m-0 rounded-ut bg-ut-bg px-3.5 py-3 text-sm leading-normal break-words">
          “{counter.note}”
          <span className="mt-1 block text-xs text-ut-text-muted">
            {customerName} · {formatRelative(counter.created_at)}
          </span>
        </blockquote>
      )}
      {error && (
        <Notice tone="danger" title="İşlem tamamlanamadı">
          {error}
        </Notice>
      )}
      <Button
        size="xl"
        block
        icon={<IconCheck size={20} />}
        loading={busy === "accept"}
        disabled={busy !== null}
        onClick={() => void respond("accept")}
      >
        Kabul Et · {formatTRY(o.current_amount)}
      </Button>
      <div
        className={cn(
          "grid gap-2.5",
          canPropose ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        <Button
          variant="danger"
          size="lg"
          loading={busy === "reject"}
          loadingText="Reddediliyor…"
          disabled={busy !== null}
          onClick={() => void respond("reject")}
        >
          Reddet
        </Button>
        {canPropose && (
          <Button
            variant="secondary"
            size="lg"
            aria-expanded={newOpen}
            aria-controls="new-price-form"
            disabled={busy !== null}
            className={cn(newOpen && "border-ut-primary bg-ut-primary-soft")}
            onClick={() => setNewOpen((n) => !n)}
          >
            Yeni Fiyat Ver
          </Button>
        )}
      </div>
      {newOpen && canPropose && (
        <form
          id="new-price-form"
          onSubmit={submitNew}
          className="flex flex-col gap-2.5 border-t border-ut-border pt-3.5"
        >
          <Field>
            <Label htmlFor="new-price">Yeni fiyatınız</Label>
            <MoneyInput
              id="new-price"
              name="amount"
              placeholder="1.250,00"
              aria-invalid={!!amountError}
              aria-describedby="new-price-err"
            />
            <FieldError id="new-price-err">{amountError}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="new-note" optional>
              Not
            </Label>
            <Textarea
              id="new-note"
              name="note"
              rows={2}
              maxLength={500}
              placeholder="Örn. Muadil marka parça ile."
            />
          </Field>
          <span className="text-[13px] text-ut-text-muted">
            Bu fiyat Tur {round + 1} olarak gider. En fazla {MAX_ROUNDS} tur
            yapılabilir.
          </span>
          <Button
            type="submit"
            variant="accent"
            size="lg"
            loading={busy === "propose"}
          >
            Yeni Fiyatı Gönder
          </Button>
        </form>
      )}
    </Card>
  );
}

function OfferSummary({ offer: o }: { offer: Offer }) {
  const rounds = sortedRounds(o);
  const round = roundOf(o);
  const s = STATUS[o.status];
  const shown =
    o.status === "accepted"
      ? (o.final_amount ?? o.current_amount)
      : o.current_amount;
  const noHaggle =
    o.status === "accepted" &&
    rounds.length === 2 &&
    rounds[1]!.action === "accept";
  return (
    <div className="flex flex-col gap-3 rounded-ut border border-ut-border p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-bold">{o.title}</span>
        <StatusBadge tone={s.tone} size="sm" className="text-xs">
          {s.label}
        </StatusBadge>
      </div>
      {noHaggle ? (
        <>
          <span className="text-base font-bold tabular-nums">
            {formatTRY(shown)}
          </span>
          <span className="text-[13px] text-ut-text-muted">
            {formatRelative(rounds[1]!.created_at)} · Pazarlıksız onaylandı
          </span>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="flex gap-[3px]" aria-hidden="true">
              {Array.from({ length: MAX_ROUNDS }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-[18px] rounded-[3px]",
                    i < round ? "bg-ut-primary" : "bg-ut-border",
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-ut-text-muted">
              {round} / {MAX_ROUNDS} tur
            </span>
          </div>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {rounds.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    r.actor === "business"
                      ? "bg-ut-primary text-ut-on-fill"
                      : "bg-ut-accent text-ut-on-accent",
                  )}
                >
                  {r.actor === "business" ? "S" : "M"}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs text-ut-text-muted">
                    Tur {r.round_no} ·{" "}
                    {r.actor === "business" ? "Siz" : "Müşteri"} ·{" "}
                    {formatRelative(r.created_at)}
                  </span>
                  {r.amount != null && (
                    <span className="text-base font-bold tabular-nums">
                      {formatTRY(r.amount)}
                    </span>
                  )}
                  <span className="text-[13px] leading-snug break-words">
                    {roundText(r)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {o.status === "accepted" && !noHaggle && (
        <span className="text-[13px] font-semibold">
          Onaylanan tutar: {formatTRY(shown)}
        </span>
      )}
    </div>
  );
}

function roundText(r: Round): string {
  if (r.action === "propose")
    return r.note ? r.note : r.round_no === 1 ? "İlk teklif" : "Yeni fiyat";
  if (r.action === "counter") return r.note ? `“${r.note}”` : "Karşı teklif";
  if (r.action === "accept")
    return r.actor === "business"
      ? "Karşı teklifi kabul ettiniz"
      : "Müşteri onayladı";
  return r.actor === "business"
    ? "Karşı teklifi reddettiniz"
    : "Müşteri reddetti";
}
