"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { callFunction } from "@/lib/customer-api";
import type { CustomerView, OfferDetail, OfferStatus } from "@/lib/customer-view";
import { formatRelative } from "@/lib/dates";
import { formatTRY, parseTRY } from "@/lib/money";
import { canCounter, MAX_ROUNDS } from "@/lib/offers";
import { formatCode } from "@/lib/tracking";
import { renderMessage, waMeLink } from "@/lib/notifications";
import { siteUrl } from "@/lib/site";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardTitle, Eyebrow } from "@/components/ui/Card";
import { Field, FieldError, FieldHint, Label, MoneyInput, Textarea } from "@/components/ui/Field";
import { InfoBox, Notice } from "@/components/ui/States";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { IconArrowLeft, IconCheck, IconSwap, IconWhatsApp, IconX } from "@/components/ui/icons";
import { CustomerFrame, TrackingProblem, TrackingSkeleton } from "@/components/customer/CustomerChrome";
import { useTracking } from "@/components/customer/useTracking";

/** M3 · /t/teklif/#<token>/<offerId> — ek masraf teklifi: onayla, reddet ya da pazarlık yap (en fazla 3 tur) */
export default function OfferPage() {
  const { token, rest, state, reload, refresh } = useTracking();

  if (state.status === "loading") return <TrackingSkeleton />;
  if (state.status === "missing") return <TrackingProblem error={null} onRetry={reload} />;
  if (state.status === "error") return <TrackingProblem error={state.error} onRetry={reload} />;

  const v = state.view;
  const offer = v.offers.find((o) => o.id === rest[0]);
  return (
    <CustomerFrame header={<OfferHeader view={v} token={token!} />}>
      {offer ? (
        <OfferBody key={offer.id} view={v} offer={offer} token={token!} onChanged={refresh} />
      ) : (
        <Notice tone="neutral" title="Teklif bulunamadı">
          Bu teklif kaldırılmış ya da bağlantı eksik olabilir.{" "}
          <Link href={`/t/#${token}`}>İş takibine dönün</Link>.
        </Notice>
      )}
    </CustomerFrame>
  );
}

function OfferHeader({ view: v, token }: { view: CustomerView; token: string }) {
  return (
    <header className="flex items-center gap-1.5 border-b border-ut-border bg-ut-surface py-2.5 pr-4 pl-2">
      <Link
        href={`/t/#${token}`}
        aria-label="İş takibine dön"
        className="flex size-11 shrink-0 items-center justify-center rounded-ut text-ut-text hover:bg-ut-primary-soft hover:text-ut-text"
      >
        <IconArrowLeft size={22} />
      </Link>
      <div className="flex min-w-0 flex-col gap-px">
        <h1 className="m-0 text-[17px] font-bold">Teklif Detayı</h1>
        <span className="truncate text-[13px] text-ut-text-muted">
          {v.business.name} · <span className="font-mono">{formatCode(v.job.code)}</span>
        </span>
      </div>
    </header>
  );
}

const STATUS: Record<OfferStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: "warning", label: "Yanıtınız bekleniyor" },
  countered: { tone: "info", label: "Karşı teklif gönderildi" },
  accepted: { tone: "success", label: "Onaylandı" },
  rejected: { tone: "danger", label: "Reddedildi" },
  expired: { tone: "queued", label: "Süresi doldu" },
};

type Action = { action: "accept" } | { action: "reject" } | { action: "counter"; amount: number; note: string };

function OfferBody({ view: v, offer: o, token, onChanged }: { view: CustomerView; offer: OfferDetail; token: string; onChanged: () => void }) {
  const [negotiating, setNegotiating] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [busy, setBusy] = useState<Action["action"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const open = o.status === "pending";
  const counterAllowed = canCounter({ status: o.status, round: o.round });
  const status = STATUS[o.status];
  const shownAmount = o.status === "accepted" ? (o.finalAmount ?? o.amount) : o.amount;
  const lastBusinessPrice = [...o.rounds].reverse().find((r) => r.actor === "business" && r.amount != null)?.amount ?? o.amount;

  async function send(a: Action) {
    setBusy(a.action);
    setError(null);
    const res = await callFunction<{ offer: unknown }>("offer-action", {
      token,
      offerId: o.id,
      action: a.action,
      ...(a.action === "counter" ? { amount: a.amount, note: a.note } : {}),
    });
    setBusy(null);
    if (res.ok) {
      setNegotiating(false);
      setConfirmReject(false);
      onChanged();
      return;
    }
    if (res.error.fields?.amount) setFieldError(res.error.fields.amount);
    setError(res.error.message);
    if (res.error.status === 409) onChanged();
  }

  function submitCounter(e: FormEvent<HTMLElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const amount = parseTRY(String(data.get("amount") ?? ""));
    if (amount == null || amount <= 0) return setFieldError("Geçerli bir tutar girin (örn. 2.900,00)");
    if (amount >= o.amount) return setFieldError(`Karşı teklif ustanın fiyatından (${formatTRY(o.amount)}) düşük olmalı`);
    setFieldError(null);
    void send({ action: "counter", amount, note: String(data.get("note") ?? "") });
  }

  return (
    <>
      <Card as="section" className="flex flex-col gap-3" aria-labelledby="offer-title">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          <span className="text-[13px] font-semibold text-ut-text-muted">
            Tur {o.round} / {o.maxRounds}
          </span>
        </div>
        <h2 id="offer-title" className="m-0 text-[21px] leading-tight font-bold">
          {o.title}
        </h2>
        {o.description && <p className="m-0 text-[15px] leading-relaxed whitespace-pre-line">{o.description}</p>}
        <div className="flex items-end justify-between gap-3 border-t border-ut-border pt-3.5">
          <div className="flex flex-col gap-0.5">
            <Eyebrow>{o.status === "accepted" ? "Onaylanan tutar" : o.status === "countered" ? "Karşı teklifiniz" : "Güncel tutar"}</Eyebrow>
            <span className="text-[30px] leading-tight font-bold tabular-nums">{formatTRY(shownAmount)}</span>
          </div>
          {o.firstAmount !== shownAmount && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-ut-text-muted">İlk teklif</span>
              <span className="text-[15px] text-ut-text-muted tabular-nums line-through">{formatTRY(o.firstAmount)}</span>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <Notice tone="danger" title="İşlem tamamlanamadı">
          {error}
        </Notice>
      )}

      {open && !confirmReject && (
        <div className="flex flex-col gap-2.5">
          <Button
            variant="primary"
            size="xl"
            block
            icon={<IconCheck size={20} />}
            loading={busy === "accept"}
            disabled={busy !== null}
            onClick={() => void send({ action: "accept" })}
          >
            Onayla · {formatTRY(o.amount)}
          </Button>
          <div className={cn("grid gap-2.5", counterAllowed ? "grid-cols-2" : "grid-cols-1")}>
            <Button variant="danger" size="lg" icon={<IconX size={18} />} disabled={busy !== null} onClick={() => setConfirmReject(true)}>
              Reddet
            </Button>
            {counterAllowed && (
              <Button
                variant="secondary"
                size="lg"
                icon={<IconSwap size={18} />}
                aria-expanded={negotiating}
                aria-controls="counter-form"
                disabled={busy !== null}
                className={cn(negotiating && "border-ut-primary bg-ut-primary-soft")}
                onClick={() => setNegotiating((n) => !n)}
              >
                Pazarlık Yap
              </Button>
            )}
          </div>
          {!counterAllowed && <InfoBox>Bu son tur: teklifi onaylayabilir ya da reddedebilirsiniz.</InfoBox>}
        </div>
      )}

      {open && confirmReject && (
        <Notice
          tone="danger"
          title="Teklifi reddetmek istiyor musunuz?"
          action={
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="danger" loading={busy === "reject"} loadingText="Reddediliyor…" onClick={() => void send({ action: "reject" })}>
                Evet, reddet
              </Button>
              <Button variant="ghost" disabled={busy !== null} onClick={() => setConfirmReject(false)}>
                Vazgeç
              </Button>
            </div>
          }
        >
          Ek işlem yapılmadan iş devam eder. Bu karar geri alınamaz.
        </Notice>
      )}

      {open && negotiating && counterAllowed && !confirmReject && (
        <Card as="form" id="counter-form" className="flex flex-col gap-3 border-[1.5px] border-ut-primary" onSubmit={submitCounter}>
          <div className="flex items-center justify-between gap-2">
            <CardTitle size="sm">Karşı teklif ver</CardTitle>
            <span className="rounded-full bg-ut-primary-soft px-2.5 py-1 text-xs font-bold text-ut-primary">Tur {o.round} yanıtınız</span>
          </div>
          <Field>
            <Label htmlFor="co-amount">Karşı teklif tutarı</Label>
            <MoneyInput
              id="co-amount"
              name="amount"
              placeholder="2.900,00"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "co-amount-error" : "co-amount-hint"}
            />
            {fieldError ? (
              <FieldError id="co-amount-error">{fieldError}</FieldError>
            ) : (
              <FieldHint id="co-amount-hint">Usta en son {formatTRY(lastBusinessPrice)} önerdi.</FieldHint>
            )}
          </Field>
          <Field>
            <Label htmlFor="co-note" optional>
              Not
            </Label>
            <Textarea id="co-note" name="note" rows={3} maxLength={500} placeholder="Örn. Bu fiyata işçilik de dahil olursa onaylarım." />
          </Field>
          <InfoBox>
            Bir teklifte en fazla {MAX_ROUNDS} tur pazarlık yapılır. Bu yanıttan sonra {MAX_ROUNDS - o.round} tur hakkınız kalır.
          </InfoBox>
          <Button type="submit" variant="accent" size="xl" block loading={busy === "counter"}>
            Karşı Teklif Gönder
          </Button>
          <Button variant="ghost" block disabled={busy !== null} onClick={() => setNegotiating(false)}>
            Vazgeç
          </Button>
        </Card>
      )}

      <Outcome offer={o} view={v} />
      <RoundHistory offer={o} />
    </>
  );
}

function Outcome({ offer: o, view: v }: { offer: OfferDetail; view: CustomerView }) {
  const agreedAmount = v.job.agreedAmount;
  const last = o.rounds.at(-1);
  if (o.status === "accepted") {
    const byBusiness = last?.actor === "business";
    return (
      <Notice tone="success" title={byBusiness ? "Usta karşı teklifinizi kabul etti" : "Teklifi onayladınız"}>
        {formatTRY(o.finalAmount ?? o.amount)} iş toplamına eklendi.
        {agreedAmount != null && ` Güncel iş toplamı: ${formatTRY(agreedAmount)}.`}
      </Notice>
    );
  }
  if (o.status === "rejected") {
    return (
      <Notice tone="danger" title={last?.actor === "business" ? "Usta karşı teklifi kabul etmedi" : "Teklifi reddettiniz"}>
        Bu ek işlem yapılmadan iş devam edecek.
      </Notice>
    );
  }
  if (o.status === "countered") {
    return (
      <Notice
        tone="info"
        title="Karşı teklifiniz gönderildi"
        action={
          v.business.phone && (
            <a
              href={waMeLink(
                renderMessage({ type: "counter_received", customerName: "Müşteriniz", trackingCode: formatCode(v.job.code), amount: o.amount, url: `${siteUrl()}/panel/` }),
                v.business.phone,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("secondary", "md", "mt-2 self-start")}
            >
              <IconWhatsApp size={18} />
              Ustaya WhatsApp&apos;tan haber ver
            </a>
          )
        }
      >
        Ustanın yanıtı bekleniyor. Yanıt gelince bu sayfa kendiliğinden güncellenir.
      </Notice>
    );
  }
  if (o.status === "expired") {
    return (
      <Notice tone="neutral" title="Teklif kapandı">
        İş kapandığı için bu teklif artık yanıtlanamaz.
      </Notice>
    );
  }
  return null;
}

function roundLine(r: OfferDetail["rounds"][number]): string {
  if (r.actor === "business") {
    if (r.action === "propose") return r.round === 1 ? "İlk teklif" : "Yeni fiyat önerdi";
    return r.action === "accept" ? "Karşı teklifinizi kabul etti" : "Karşı teklifi kabul etmedi";
  }
  if (r.action === "counter") return r.note ? `“${r.note}”` : "Karşı teklif verdiniz";
  return r.action === "accept" ? "Teklifi onayladınız" : "Teklifi reddettiniz";
}

function RoundHistory({ offer: o }: { offer: OfferDetail }) {
  const open = o.status === "pending" || o.status === "countered";
  const rounds = Array.from({ length: o.maxRounds }, (_, i) => i + 1);
  return (
    <Card as="section" className="flex flex-col gap-3.5" aria-labelledby="rounds-title">
      <div className="flex items-center justify-between gap-2">
        <CardTitle size="sm">
          <span id="rounds-title">Teklif geçmişi</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex gap-[3px]" aria-hidden="true">
            {rounds.map((n) => (
              <span key={n} className={cn("h-1.5 w-[18px] rounded-[3px]", n <= o.round ? "bg-ut-primary" : "bg-ut-border")} />
            ))}
          </div>
          <span className="text-[13px] font-semibold">
            {o.round} / {o.maxRounds} tur
          </span>
        </div>
      </div>
      <p className="m-0 text-[13px] leading-normal text-ut-text-muted">
        Her teklif için en fazla {o.maxRounds} tur pazarlık yapılabilir. Bir tur, ustanın fiyatı ve sizin yanıtınızdan oluşur.
      </p>

      {rounds.map((n) => {
        const items = o.rounds.filter((r) => r.round === n);
        if (items.length === 0) {
          if (!open) return null;
          return (
            <div key={n} className="flex items-center justify-between gap-2 rounded-ut border border-dashed border-ut-border px-3.5 py-3">
              <span className="text-[13px] font-semibold text-ut-text-muted">Tur {n}</span>
              <span className="text-[13px] text-ut-text-muted">{n === o.maxRounds ? "Son tur · henüz kullanılmadı" : "Henüz kullanılmadı"}</span>
            </div>
          );
        }
        const current = n === o.round && open;
        const waitingYou = current && o.status === "pending";
        return (
          <div key={n} className={cn("flex flex-col gap-3 rounded-ut border p-3.5", current ? "border-ut-primary" : "border-ut-border")}>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-ut-primary-soft px-2.5 py-1 text-xs font-bold text-ut-primary">
                Tur {n}
                {current && " · Güncel"}
              </span>
              <span className="text-xs text-ut-text-muted">{formatRelative(items[0]!.at)}</span>
            </div>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {items.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <Avatar who={r.actor} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] text-ut-text-muted">
                      {r.actor === "business" ? "Usta" : "Siz"} · {formatRelative(r.at)}
                    </span>
                    {r.amount != null && <span className="text-[17px] font-bold tabular-nums">{formatTRY(r.amount)}</span>}
                    <span className="text-sm leading-snug break-words">{roundLine(r)}</span>
                  </div>
                </li>
              ))}
              {waitingYou && (
                <li className="flex gap-2.5">
                  <Avatar who="pending" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] text-ut-text-muted">Siz · Bekleniyor</span>
                    <span className="text-sm leading-snug text-ut-text-muted">Onaylayın, reddedin ya da karşı teklif verin.</span>
                  </div>
                </li>
              )}
            </ol>
          </div>
        );
      })}
    </Card>
  );
}

function Avatar({ who }: { who: "business" | "customer" | "pending" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "box-border flex size-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold",
        who === "business" && "bg-ut-primary text-white",
        who === "customer" && "bg-ut-accent text-ut-text",
        who === "pending" && "border border-dashed border-ut-text-muted bg-ut-surface text-ut-text-muted",
      )}
    >
      {who === "business" ? "U" : who === "customer" ? "S" : "?"}
    </span>
  );
}
