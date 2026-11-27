"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { stageColor } from "@/lib/theme";
import { useBusiness } from "@/lib/business";
import { getSupabase } from "@/lib/supabase";
import { formatDuration } from "@/lib/dates";
import { formatTRY } from "@/lib/money";
import { acceptanceRate, bottleneck, periodStart, PERIODS, stageStats, type DurationRow, type PeriodValue } from "@/lib/analytics";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardTitle, Eyebrow } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Field";
import { EmptyState, ErrorState, LoadingRegion, Notice, Skeleton } from "@/components/ui/States";
import { IconChart, IconPlus } from "@/components/ui/icons";
import { BackLink } from "@/components/ui/BackLink";

type Summary = {
  active_jobs: number;
  delivered_jobs: number;
  avg_cycle_seconds: number | null;
  offers_total: number;
  offers_accepted: number;
  offers_rejected: number;
  offers_accepted_amount: number;
};
type Template = { id: string; name: string };
type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: DurationRow[]; summary: Summary | null; templates: Template[] };

/** E6 · /panel/analiz/ — aşama başına kaybedilen süre ve genel göstergeler */
export default function AnalizPage() {
  const { business } = useBusiness();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [period, setPeriod] = useState<PeriodValue>("30");
  const [templateId, setTemplateId] = useState<string>("");

  const fetchAll = useCallback(async () => {
    const supabase = getSupabase();
    const [rows, summary, templates] = await Promise.all([
      supabase
        .from("analytics_stage_durations")
        .select("event_id, job_id, template_id, stage_id, stage_name, stage_position, stage_color, entered_at, left_at, is_open, seconds")
        .eq("business_id", business.id)
        .returns<DurationRow[]>(),
      supabase.from("analytics_business_summary").select("*").eq("business_id", business.id).maybeSingle<Summary>(),
      supabase.from("process_templates").select("id, name").eq("business_id", business.id).order("created_at").returns<Template[]>(),
    ]);
    if (rows.error || summary.error || templates.error) return setLoad({ status: "error" });
    setLoad({ status: "ready", rows: rows.data ?? [], summary: summary.data, templates: templates.data ?? [] });
  }, [business.id]);

  useEffect(() => {
    // Analiz görünümleri Supabase'den okunur (dış sistem senkronizasyonu)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
  }, [fetchAll]);

  const ready = load.status === "ready" ? load : null;
  // Yalnızca verisi olan şablonlar seçilebilir; varsayılan en çok kaydı olan
  const usedTemplates = useMemo(() => {
    if (!ready) return [];
    const counts = new Map<string, number>();
    for (const r of ready.rows) counts.set(r.template_id, (counts.get(r.template_id) ?? 0) + 1);
    return ready.templates.filter((t) => counts.has(t.id)).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [ready]);
  const activeTemplate = usedTemplates.find((t) => t.id === templateId) ?? usedTemplates[0];
  const stats = useMemo(
    () => (ready && activeTemplate ? stageStats(ready.rows.filter((r) => r.template_id === activeTemplate.id), periodStart(period)) : []),
    [ready, activeTemplate, period],
  );

  if (load.status === "loading") return <AnalizSkeleton />;
  if (load.status === "error")
    return (
      <Page>
        <ErrorState title="Analiz yüklenemedi" onRetry={() => { setLoad({ status: "loading" }); void fetchAll(); }} />
      </Page>
    );

  const s = load.summary;
  const rate = s ? acceptanceRate(s.offers_accepted, s.offers_rejected) : null;
  const worst = bottleneck(stats);
  const maxLost = Math.max(1, ...stats.map((x) => x.lostSeconds));

  return (
    <Page>
      <section aria-labelledby="kpi-title" className="flex flex-col gap-3">
        <h2 id="kpi-title" className="sr-only">
          Genel göstergeler
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 sm:gap-4">
          <Kpi label="Aktif iş" value={String(s?.active_jobs ?? 0)} />
          <Kpi label="Teslim edilen" value={String(s?.delivered_jobs ?? 0)} />
          <Kpi label="Ort. teslim süresi" value={s?.avg_cycle_seconds != null ? formatDuration(s.avg_cycle_seconds) : "—"} hint="Kayıttan teslime" />
          <Kpi
            label="Ek masraf onayı"
            value={rate != null ? `%${rate}` : "—"}
            hint={s && s.offers_accepted ? `${formatTRY(s.offers_accepted_amount)} onaylandı` : `${s?.offers_total ?? 0} teklif`}
          />
        </div>
        <span className="text-[13px] text-ut-text-muted">Göstergeler tüm zamanları kapsar.</span>
      </section>

      <Card as="section" padding="lg" className="flex flex-col gap-5" aria-labelledby="stages-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle size="lg">
              <span id="stages-title">Aşama başına kaybedilen süre</span>
            </CardTitle>
            <p className="m-0 max-w-2xl text-sm leading-normal text-ut-text-muted">
              Her ziyarette aşamanın tipik (medyan) süresini aşan kısım toplanır. Çubuk ne kadar uzunsa işler o aşamada o kadar fazla bekliyor demektir.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {usedTemplates.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="an-template">Süreç</Label>
                <Select id="an-template" value={activeTemplate?.id} onChange={(e) => setTemplateId(e.target.value)} className="min-w-48">
                  {usedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="an-period">Dönem</Label>
              <Select id="an-period" value={period} onChange={(e) => setPeriod(e.target.value as PeriodValue)} className="min-w-40">
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {stats.length === 0 ? (
          <EmptyState
            icon={<IconChart size={22} />}
            title={load.rows.length ? "Bu dönemde aşama hareketi yok" : "Henüz analiz edilecek veri yok"}
            description={load.rows.length ? "Daha uzun bir dönem seçin." : "İşleri aşama aşama ilerlettikçe burada hangi aşamada zaman kaybedildiğini göreceksiniz."}
            action={!load.rows.length && <ButtonLink href="/panel/is/yeni/" variant="accent" icon={<IconPlus size={18} />}>Yeni İş</ButtonLink>}
          />
        ) : (
          <>
            {worst ? (
              <Notice tone="warning" title={`Darboğaz: ${worst.name}`}>
                Bu dönemde işler “{worst.name}” aşamasında tipik süreden toplam {formatDuration(worst.lostSeconds)} fazla bekledi
                {worst.openNow ? `; şu an ${worst.openNow} iş bu aşamada` : ""}.
              </Notice>
            ) : (
              <Notice tone="success" title="Belirgin bir darboğaz yok">
                Aşama süreleri tipik değerlerine yakın seyrediyor.
              </Notice>
            )}

            <ol className="m-0 flex list-none flex-col gap-4 p-0" aria-label="Aşamalara göre kaybedilen süre">
              {stats.map((x) => (
                <li key={x.stageId} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-[15px] font-semibold">
                      <span className="size-2.5 rounded-full" style={{ background: stageColor(x.color) }} aria-hidden="true" />
                      {x.name}
                    </span>
                    <span className="text-[15px] font-bold tabular-nums">{x.lostSeconds ? formatDuration(x.lostSeconds) : "Kayıp yok"}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-ut-bg" aria-hidden="true">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(x.lostSeconds ? 2 : 0, (x.lostSeconds / maxLost) * 100)}%`, background: x === worst ? "var(--ut-warning)" : stageColor(x.color) }}
                    />
                  </div>
                  <span className="text-[13px] text-ut-text-muted">
                    {x.visits} geçiş · ortalama {x.avgSeconds != null ? formatDuration(x.avgSeconds) : "—"} · medyan{" "}
                    {x.medianSeconds != null ? formatDuration(x.medianSeconds) : "—"} · en uzun {formatDuration(x.maxSeconds)}
                    {x.openNow ? ` · şu an ${x.openNow} iş bekliyor` : ""}
                  </span>
                </li>
              ))}
            </ol>

            <details className="rounded-ut border border-ut-border px-4 py-3 text-sm">
              <summary className="min-h-6 cursor-pointer font-semibold">Ortalama aşama süreleri (tablo)</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ut-border text-ut-text-muted">
                      <th scope="col" className="py-2 pr-3 font-semibold">Aşama</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Ortalama</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Medyan</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Kaybedilen</th>
                      <th scope="col" className="py-2 font-semibold">Bekleyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((x) => (
                      <tr key={x.stageId} className="border-b border-ut-border last:border-0">
                        <th scope="row" className="py-2 pr-3 font-semibold">{x.name}</th>
                        <td className="py-2 pr-3 tabular-nums">{x.avgSeconds != null ? formatDuration(x.avgSeconds) : "—"}</td>
                        <td className="py-2 pr-3 tabular-nums">{x.medianSeconds != null ? formatDuration(x.medianSeconds) : "—"}</td>
                        <td className="py-2 pr-3 tabular-nums">{formatDuration(x.lostSeconds)}</td>
                        <td className="py-2 tabular-nums">{x.openNow}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </Card>
    </Page>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card padding="md" className="flex flex-col gap-1">
      <Eyebrow>{label}</Eyebrow>
      <span className="text-[26px] leading-tight font-bold tabular-nums">{value}</span>
      {hint && <span className="text-[13px] text-ut-text-muted">{hint}</span>}
    </Card>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto box-border flex max-w-[1200px] flex-col gap-5 px-6 pt-5 pb-14">
      <BackLink href="/panel/">Aktif işler</BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">Analiz</h1>
        <span className="text-[15px] text-ut-text-muted">İşlerinizin hangi aşamada beklediğini görün, darboğazı giderin.</span>
      </div>
      {children}
    </main>
  );
}

function AnalizSkeleton() {
  return (
    <Page>
      <LoadingRegion label="Analiz yükleniyor…" className="flex flex-col gap-5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 sm:gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Card key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </Card>
          ))}
        </div>
        <Card padding="lg" className="flex flex-col gap-4">
          <Skeleton className="h-6 w-64" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </Card>
      </LoadingRegion>
    </Page>
  );
}
