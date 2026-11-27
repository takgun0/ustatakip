"use client";

import Link from "next/link";
import { formatLong, formatRelative } from "@/lib/dates";
import { formatTRY } from "@/lib/money";
import { formatCode } from "@/lib/tracking";
import type { CustomerView, HistoryItem } from "@/lib/customer-view";
import { cn } from "@/lib/cn";
import { Card, CardTitle, Eyebrow } from "@/components/ui/Card";
import { StageProgress } from "@/components/ui/StageProgress";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Notice } from "@/components/ui/States";
import { IconAlert, IconArrowRight, IconClock } from "@/components/ui/icons";
import {
  BusinessHeader,
  ContactBar,
  CustomerFrame,
  TrackingProblem,
  TrackingSkeleton,
} from "@/components/customer/CustomerChrome";
import { useTracking } from "@/components/customer/useTracking";
import { BrandMark } from "@/components/ui/BrandMark";

/** M2 · /t/#<token> — müşteri takip sayfası (giriş yok, canlı güncellenir) */
export default function TrackingPage() {
  const { token, state, live, reload } = useTracking();

  if (state.status === "loading") return <TrackingSkeleton />;
  if (state.status === "missing")
    return <TrackingProblem error={null} onRetry={reload} />;
  if (state.status === "error")
    return <TrackingProblem error={state.error} onRetry={reload} />;

  const v = state.view;
  return (
    <CustomerFrame
      header={
        <BusinessHeader
          business={v.business}
          back={{ href: "/takip/", label: "Başka bir işi sorgula" }}
        />
      }
      footer={<ContactBar business={v.business} code={v.job.code} />}
    >
      <Summary view={v} />
      <StatusNotice view={v} />
      {v.openOffers.map((o) => (
        <Link
          key={o.id}
          href={`/t/teklif/#${token}/${o.id}`}
          className="flex items-center gap-3 rounded-ut border-[1.5px] border-ut-warning bg-ut-surface px-4 py-3.5 text-ut-text no-underline shadow-ut hover:text-ut-text"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ut-warning-tint text-ut-warning"
            aria-hidden="true"
          >
            <IconAlert size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">
              Onayınızı bekleyen teklif
            </span>
            <span className="truncate text-[13px] text-ut-text-muted">
              {o.title} · Tur {o.round}/{o.maxRounds}
            </span>
          </span>
          <span className="flex flex-col items-end gap-0.5">
            <span className="text-base font-bold tabular-nums">
              {formatTRY(o.amount)}
            </span>
            <span className="text-[13px] font-semibold text-ut-primary">
              İncele →
            </span>
          </span>
        </Link>
      ))}
      <Progress view={v} live={live} />
      <History view={v} token={token!} />
      {v.business.kvkkText && (
        <details className="rounded-ut border border-ut-border bg-ut-surface px-4 py-3 text-sm">
          <summary className="min-h-6 cursor-pointer font-semibold">
            Kişisel verileriniz (KVKK)
          </summary>
          <p className="mt-2 mb-0 leading-normal whitespace-pre-line text-ut-text-muted">
            {v.business.kvkkText}
          </p>
        </details>
      )}
      <p className="m-0 mt-1 flex items-center justify-center gap-1.5 text-xs text-ut-text-muted">
        <BrandMark tone="onLight" size={16} className="shadow-none" />
        UstaTakip ile takip ediliyor
      </p>
    </CustomerFrame>
  );
}

function Summary({ view: v }: { view: CustomerView }) {
  const stageName = v.stages[v.activeIndex]?.name ?? "—";
  return (
    <Card as="section" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Takip kodu</Eyebrow>
        <span className="font-mono text-sm font-bold text-ut-primary">
          {formatCode(v.job.code)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[22px] leading-tight font-bold">
          {v.job.title}
        </h1>
        {v.job.itemLabel && (
          <span className="text-sm text-ut-text-muted">{v.job.itemLabel}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {v.job.status === "delivered" ? (
          <StatusBadge tone="success">Teslim edildi</StatusBadge>
        ) : (
          <StatusBadge tone="active">{stageName}</StatusBadge>
        )}
        {v.job.agreedAmount != null && (
          <span className="text-[13px] text-ut-text-muted">
            Anlaşılan tutar {formatTRY(v.job.agreedAmount)}
          </span>
        )}
      </div>
      {v.job.status === "active" && v.job.estimatedDelivery && (
        <div className="flex items-center gap-3 rounded-ut bg-ut-primary-soft px-3.5 py-3">
          <IconClock size={22} className="shrink-0 text-ut-primary" />
          <div className="flex flex-col gap-px">
            <span className="text-[13px] text-ut-text">Tahmini teslim</span>
            <span className="text-base font-bold text-ut-primary">
              {formatLong(v.job.estimatedDelivery)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function StatusNotice({ view: v }: { view: CustomerView }) {
  if (v.job.status === "delivered") {
    return (
      <Notice tone="success" title="İşiniz teslim edildi">
        {v.job.deliveredAt &&
          `${formatLong(v.job.deliveredAt)} tarihinde teslim edildi. `}
        Bizi tercih ettiğiniz için teşekkür ederiz.
      </Notice>
    );
  }
  if (v.job.status === "active" && v.activeIndex === v.stages.length - 1) {
    return (
      <Notice tone="success" title="İşiniz hazır!">
        Teslim almak için işletmeyle iletişime geçebilirsiniz.
      </Notice>
    );
  }
  return null;
}

function Progress({ view: v, live }: { view: CustomerView; live: boolean }) {
  return (
    <Card
      as="section"
      className="flex flex-col gap-4"
      aria-labelledby="progress-title"
    >
      <div className="flex items-baseline justify-between gap-2">
        <CardTitle size="sm">
          <span id="progress-title">İlerleme</span>
        </CardTitle>
        <span className="text-[13px] font-semibold text-ut-text-muted">
          Aşama {v.activeIndex + 1} / {v.stages.length}
        </span>
      </div>
      <StageProgress
        stages={v.stages}
        activeIndex={
          v.job.status === "delivered" ? v.stages.length : v.activeIndex
        }
      />
      <span
        className="flex items-center gap-2 text-[13px] text-ut-text-muted"
        aria-live="polite"
      >
        Son güncelleme: {formatRelative(v.job.lastUpdate)}
        {live && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full bg-ut-success"
              aria-hidden="true"
            />
            canlı
          </span>
        )}
      </span>
    </Card>
  );
}

const offerDot: Record<string, string> = {
  pending: "bg-ut-warning",
  countered: "bg-ut-info",
  accepted: "bg-ut-success",
  rejected: "bg-ut-danger",
  expired: "bg-ut-border",
};

function offerText(h: Extract<HistoryItem, { kind: "offer" }>): string {
  const amount = formatTRY(h.amount);
  switch (h.status) {
    case "pending":
      return h.round > 1
        ? `${h.title} için usta yeni fiyat verdi: ${amount} (Tur ${h.round}).`
        : `${h.title} için ek işlem önerildi: ${amount}.`;
    case "countered":
      return `${h.title} için karşı teklifiniz iletildi: ${amount} (Tur ${h.round}). Ustanın yanıtı bekleniyor.`;
    case "accepted":
      return `${h.title} onaylandı: ${amount}.`;
    case "rejected":
      return `${h.title} reddedildi.`;
    default:
      return `${h.title} teklifi kapandı.`;
  }
}

function History({ view: v, token }: { view: CustomerView; token: string }) {
  if (v.history.length === 0) return null;
  return (
    <Card
      as="section"
      className="flex flex-col gap-4"
      aria-labelledby="history-title"
    >
      <CardTitle size="sm">
        <span id="history-title">İşin geçmişi</span>
      </CardTitle>
      <ol className="m-0 flex list-none flex-col p-0">
        {v.history.map((h, i) => {
          const last = i === v.history.length - 1;
          const dot =
            h.kind === "stage"
              ? h.current
                ? "bg-ut-accent shadow-[0_0_0_4px_rgba(245,158,11,.22)]"
                : "bg-ut-success"
              : offerDot[h.status];
          return (
            <li key={`${h.kind}-${h.id}`} className="flex gap-3.5">
              <div className="flex flex-col items-center pt-1">
                <span
                  className={cn("size-3.5 shrink-0 rounded-full", dot)}
                  aria-hidden="true"
                />
                {!last && (
                  <span
                    className="mt-1.5 w-0.5 flex-1 bg-ut-border"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-1.5",
                  !last && "pb-[22px]",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-bold">
                    {h.kind === "stage" ? h.title : "Ek masraf teklifi"}
                  </span>
                  <span className="shrink-0 text-[13px] text-ut-text-muted">
                    {formatRelative(h.at)}
                  </span>
                </div>
                {h.kind === "stage" && h.note && (
                  <p className="m-0 text-sm leading-normal">{h.note}</p>
                )}
                {h.kind === "offer" && (
                  <p className="m-0 text-sm leading-normal">{offerText(h)}</p>
                )}
                {h.kind === "stage" && h.photos.length > 0 && (
                  <div className="mt-0.5 grid grid-cols-3 gap-2">
                    {h.photos.map((p, n) => (
                      <a
                        key={p.id}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- imzalı URL, statik dışa aktarım */}
                        <img
                          src={p.url}
                          alt={p.caption ?? `${h.title} fotoğrafı ${n + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="aspect-square w-full rounded-lg border border-ut-border object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
                {h.kind === "offer" && h.awaiting && (
                  <Link
                    href={`/t/teklif/#${token}/${h.id}`}
                    className="inline-flex h-7 items-center gap-1.5 self-start rounded-full bg-ut-warning-tint px-3 text-[13px] font-semibold text-ut-text no-underline hover:text-ut-text"
                  >
                    <span
                      className="size-2 rounded-full bg-ut-warning"
                      aria-hidden="true"
                    />
                    Yanıtınız bekleniyor
                    <IconArrowRight size={14} />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
