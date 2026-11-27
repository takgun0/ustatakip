"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useBusiness } from "@/lib/business";
import { formatDue, formatRelative, formatToday } from "@/lib/dates";
import { formatTRY } from "@/lib/money";
import { formatCode } from "@/lib/tracking";
import { cn } from "@/lib/cn";
import type { OfferStatus } from "@/lib/types";
import { ButtonLink, Button } from "@/components/ui/Button";
import { JobCard, JobCardSkeleton } from "@/components/ui/JobCard";
import { EmptyState, ErrorState, LoadingRegion } from "@/components/ui/States";
import {
  IconClock,
  IconPlus,
  IconSearch,
  IconSwap,
  IconWrench,
} from "@/components/ui/icons";

type Row = {
  id: string;
  customer_name: string;
  item_label: string | null;
  title: string;
  tracking_code: string;
  template_id: string;
  current_stage_id: string | null;
  estimated_delivery: string | null;
  updated_at: string;
  offers: Array<{
    status: OfferStatus;
    current_amount: number;
    created_at: string;
  }>;
};
type Stage = {
  id: string;
  template_id: string;
  name: string;
  position: number;
};

type JobView = Row & {
  stages: Array<{ id: string; name: string }>;
  activeIndex: number;
  stageName: string;
  flag: "waiting" | "counter" | null;
  offerAmount: number | null;
};

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; jobs: JobView[] };

/** E2 · /panel — aktif işler */
export default function PanelPage() {
  useBusiness();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [flagFilter, setFlagFilter] = useState<"waiting" | "counter" | null>(
    null,
  );
  const [query, setQuery] = useState("");

  const fetchJobs = useCallback(async () => {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("jobs")
      .select(
        "id, customer_name, item_label, title, tracking_code, template_id, current_stage_id, estimated_delivery, updated_at, offers(status, current_amount, created_at)",
      )
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .returns<Row[]>();
    if (error) return setLoad({ status: "error" });

    const templateIds = [...new Set((rows ?? []).map((r) => r.template_id))];
    let stages: Stage[] = [];
    if (templateIds.length) {
      const res = await supabase
        .from("template_stages")
        .select("id, template_id, name, position")
        .in("template_id", templateIds)
        .order("position")
        .returns<Stage[]>();
      if (res.error) return setLoad({ status: "error" });
      stages = res.data ?? [];
    }

    const jobs: JobView[] = (rows ?? []).map((r) => {
      const own = stages.filter((s) => s.template_id === r.template_id);
      const idx = Math.max(
        0,
        own.findIndex((s) => s.id === r.current_stage_id),
      );
      const open = r.offers
        .filter((o) => o.status === "countered" || o.status === "pending")
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const counter = open.find((o) => o.status === "countered");
      const waiting = open.find((o) => o.status === "pending");
      return {
        ...r,
        stages: own.map((s) => ({ id: s.id, name: s.name })),
        activeIndex: idx,
        stageName: own[idx]?.name ?? "—",
        flag: counter ? "counter" : waiting ? "waiting" : null,
        offerAmount: (counter ?? waiting)?.current_amount ?? null,
      };
    });
    setLoad({ status: "ready", jobs });
  }, []);

  useEffect(() => {
    // Veriler Supabase'den okunur (dış sistem senkronizasyonu)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchJobs();
  }, [fetchJobs]);

  const jobs = useMemo(
    () => (load.status === "ready" ? load.jobs : []),
    [load],
  );

  // Aşama çipleri: yalnızca içinde iş olan aşamalar. Farklı şablonlarda aynı adlı aşamalar
  // birleşir, şablondaki sıra korunur (çok sektörlü işletmede boş aşamalar listeyi uzatmasın).
  const chipNames = useMemo(() => {
    const occupied = new Set(jobs.map((j) => j.stageName));
    const seen = new Map<string, number>();
    for (const j of jobs)
      j.stages.forEach((s, i) =>
        occupied.has(s.name) && !seen.has(s.name) ? seen.set(s.name, i) : null,
      );
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
  }, [jobs]);

  const q = query.trim().toLocaleLowerCase("tr-TR");
  const searched = useMemo(
    () =>
      jobs.filter((j) => {
        if (!q) return true;
        const hay = [
          j.customer_name,
          j.item_label ?? "",
          j.title,
          j.tracking_code,
          formatCode(j.tracking_code),
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR");
        return (
          hay.includes(q) ||
          hay.replace(/\s/g, "").includes(q.replace(/\s/g, ""))
        );
      }),
    [jobs, q],
  );
  const visible = searched.filter(
    (j) =>
      (!stageFilter || j.stageName === stageFilter) &&
      (!flagFilter || j.flag === flagFilter),
  );
  const waitingCount = jobs.filter((j) => j.flag === "waiting").length;
  const counterCount = jobs.filter((j) => j.flag === "counter").length;

  const clear = () => {
    setStageFilter(null);
    setFlagFilter(null);
    setQuery("");
  };

  return (
    <main className="mx-auto box-border flex max-w-[1200px] flex-col gap-5 px-6 pt-7 pb-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">
            Aktif işler
          </h1>
          <p className="m-0 text-[15px] text-ut-text-muted">
            {load.status === "ready" ? `${jobs.length} aktif iş · ` : ""}
            {formatToday()}
          </p>
        </div>
        <div className="box-border flex h-11 min-w-60 flex-[0_1_360px] items-center gap-2.5 rounded-ut border border-ut-text-muted bg-ut-surface px-3.5 text-ut-text-muted">
          <IconSearch size={18} className="shrink-0" />
          <input
            type="search"
            aria-label="İş ara"
            placeholder="Plaka, müşteri veya takip kodu"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ut-text outline-none placeholder:text-ut-text-muted"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <FlagButton
          on={flagFilter === "waiting"}
          onClick={() =>
            setFlagFilter(flagFilter === "waiting" ? null : "waiting")
          }
          tone="warning"
          icon={<IconClock size={20} />}
          title="Yanıt bekleyen teklif"
          text="Müşteri henüz yanıtlamadı"
          count={waitingCount}
        />
        <FlagButton
          on={flagFilter === "counter"}
          onClick={() =>
            setFlagFilter(flagFilter === "counter" ? null : "counter")
          }
          tone="info"
          icon={<IconSwap size={20} />}
          title="Karşı teklif geldi"
          text="Yanıtınızı bekliyor"
          count={counterCount}
        />
      </div>

      {chipNames.length > 0 && (
        <div
          role="group"
          aria-label="Aşama filtresi"
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {[null, ...chipNames].map((name) => {
            const on = stageFilter === name;
            const count = searched.filter(
              (j) => !name || j.stageName === name,
            ).length;
            return (
              <button
                key={name ?? "__all"}
                type="button"
                aria-pressed={on}
                onClick={() => setStageFilter(name)}
                className={cn(
                  "inline-flex h-11 flex-none items-center gap-2 rounded-full border pr-2 pl-4 text-sm font-semibold",
                  on
                    ? "border-ut-primary bg-ut-primary text-ut-on-fill"
                    : "border-ut-border bg-ut-surface text-ut-text",
                )}
              >
                {name ?? "Tümü"}
                <span
                  className={cn(
                    "box-border inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-[7px] text-xs font-bold",
                    on
                      ? "bg-ut-on-fill/20 text-ut-on-fill"
                      : "bg-ut-primary-soft text-ut-primary",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {load.status === "loading" && (
        <LoadingRegion
          label="İşler yükleniyor…"
          className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </LoadingRegion>
      )}

      {load.status === "error" && (
        <ErrorState
          title="İşler yüklenemedi"
          onRetry={() => {
            setLoad({ status: "loading" });
            void fetchJobs();
          }}
        />
      )}

      {load.status === "ready" && jobs.length === 0 && (
        <EmptyState
          icon={<IconWrench size={22} />}
          title="Henüz aktif iş yok"
          description="İlk işi kaydedin; sistem müşteriniz için takip kodu, link ve QR kod üretsin."
          action={
            <ButtonLink
              href="/panel/is/yeni/"
              variant="accent"
              icon={<IconPlus size={18} />}
            >
              Yeni İş
            </ButtonLink>
          }
        />
      )}

      {load.status === "ready" && jobs.length > 0 && visible.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {visible.map((j) => (
            <JobCard
              key={j.id}
              href={`/panel/is/?id=${j.id}`}
              customerName={j.customer_name}
              itemLabel={j.item_label}
              title={j.title}
              trackingCode={j.tracking_code}
              stages={j.stages}
              activeIndex={j.activeIndex}
              flag={j.flag}
              offerAmountText={
                j.offerAmount != null ? formatTRY(j.offerAmount) : undefined
              }
              dueText={
                j.estimated_delivery
                  ? formatDue(j.estimated_delivery)
                  : undefined
              }
              updatedText={formatRelative(j.updated_at)}
            />
          ))}
        </div>
      )}

      {load.status === "ready" && jobs.length > 0 && visible.length === 0 && (
        <EmptyState
          title="Bu filtrede iş yok"
          action={
            <Button variant="secondary" onClick={clear}>
              Filtreleri temizle
            </Button>
          }
        />
      )}
    </main>
  );
}

function FlagButton({
  on,
  onClick,
  tone,
  icon,
  title,
  text,
  count,
}: {
  on: boolean;
  onClick: () => void;
  tone: "warning" | "info";
  icon: React.ReactNode;
  title: string;
  text: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-16 flex-[1_1_260px] items-center gap-3 rounded-ut border-[1.5px] bg-ut-surface px-4 py-3 text-left text-ut-text shadow-ut",
        on
          ? tone === "warning"
            ? "border-ut-warning"
            : "border-ut-info"
          : "border-ut-border",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          tone === "warning"
            ? "bg-ut-warning-tint text-ut-warning"
            : "bg-ut-info-tint text-ut-info",
        )}
      >
        {icon}
      </span>
      <span className="flex flex-1 flex-col gap-px">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[13px] text-ut-text-muted">{text}</span>
      </span>
      <span className="text-2xl font-bold">{count}</span>
    </button>
  );
}
