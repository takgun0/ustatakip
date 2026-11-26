"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBusiness } from "@/lib/business";
import { getSupabase } from "@/lib/supabase";
import { formatLong, formatRelative } from "@/lib/dates";
import { formatTRY } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { renderMessage, waMeLink } from "@/lib/notifications";
import { trackingUrl } from "@/lib/site";
import { formatCode } from "@/lib/tracking";
import type { Job, TemplateStage } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button, ButtonLink, buttonClass } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { CodeDisplay } from "@/components/ui/CodeDisplay";
import { StageProgressMini } from "@/components/ui/StageProgress";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FieldError, Label, Textarea } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Notice,
  Skeleton,
} from "@/components/ui/States";
import {
  IconArrowRight,
  IconCheck,
  IconPhone,
  IconSearch,
  IconWhatsApp,
} from "@/components/ui/icons";
import { BackLink } from "@/components/ui/BackLink";
import { StagePhotos, type PhotoItem } from "@/components/panel/StagePhotos";
import { OfferPanel } from "@/components/panel/OfferPanel";
import {
  deleteStagePhoto,
  signedUrls,
  uploadStagePhoto,
  type JobMedia,
} from "@/lib/media";
import { stageNoteSchema } from "@/lib/validation";

type StageEvent = {
  id: string;
  stage_id: string;
  note: string | null;
  entered_at: string;
};
type Detail = Job & { job_stage_events: StageEvent[]; job_media: JobMedia[] };
type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "missing" }
  | {
      status: "ready";
      job: Detail;
      stages: TemplateStage[];
      urls: Record<string, string>;
    };
type Flash = {
  tone: "success" | "danger";
  title: string;
  text?: string;
  wa?: string;
} | null;

/** E4 · /panel/is/?id=… — iş detayı (statik dışa aktarımda dinamik segment yerine sorgu parametresi) */
export default function IsDetayPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <IsDetay />
    </Suspense>
  );
}

function IsDetay() {
  const id = useSearchParams().get("id");
  const { business } = useBusiness();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    "advance" | "undo" | "note" | "photo-delete" | null
  >(null);
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<Flash>(null);

  const fetchJob = useCallback(async () => {
    if (!id || !/^[0-9a-f-]{36}$/i.test(id))
      return setLoad({ status: "missing" });
    const supabase = getSupabase();
    const { data: job, error } = await supabase
      .from("jobs")
      .select(
        "*, job_stage_events(id, stage_id, note, entered_at), job_media(id, stage_id, storage_path, caption, created_at)",
      )
      .eq("id", id)
      .maybeSingle<Detail>();
    if (error) return setLoad({ status: "error" });
    if (!job) return setLoad({ status: "missing" });
    const res = await supabase
      .from("template_stages")
      .select("id, template_id, name, position, color")
      .eq("template_id", job.template_id)
      .order("position")
      .returns<TemplateStage[]>();
    if (res.error) return setLoad({ status: "error" });
    const urls = await signedUrls(
      job.job_media.map((m) => m.storage_path),
    ).catch(() => ({}));
    setLoad({ status: "ready", job, stages: res.data ?? [], urls });
  }, [id]);

  useEffect(() => {
    // İş Supabase'den okunur (dış sistem senkronizasyonu)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchJob();
  }, [fetchJob]);

  if (load.status === "loading") return <DetailSkeleton />;
  if (load.status === "error")
    return (
      <Shell>
        <ErrorState
          title="İş yüklenemedi"
          onRetry={() => {
            setLoad({ status: "loading" });
            void fetchJob();
          }}
        />
      </Shell>
    );
  if (load.status === "missing")
    return (
      <Shell>
        <EmptyState
          icon={<IconSearch size={22} />}
          title="İş bulunamadı"
          description="Bağlantı hatalı olabilir ya da bu iş başka bir işletmeye ait."
          action={
            <ButtonLink href="/panel/" variant="secondary">
              Aktif işlere dön
            </ButtonLink>
          }
        />
      </Shell>
    );

  const { job, stages, urls } = load;
  const activeIndex = Math.max(
    0,
    stages.findIndex((s) => s.id === job.current_stage_id),
  );
  const delivered = job.status === "delivered";
  /** Teslim bildirimi: esnaf kendi WhatsApp'ından tek dokunuşla gönderir */
  const deliveredWa = waMeLink(
    renderMessage(
      {
        type: "job_delivered",
        businessName: business.name,
        customerName: job.customer_name,
        title: job.title,
      },
      business.message_templates,
    ),
    job.customer_phone,
  );
  const isActive = job.status === "active";
  const events = [...job.job_stage_events].sort((a, b) =>
    a.entered_at.localeCompare(b.entered_at),
  );
  const lastEvent = (stageId: string) =>
    events.filter((e) => e.stage_id === stageId).at(-1);
  const photosOf = (stageId: string): PhotoItem[] =>
    job.job_media
      .filter((m) => m.stage_id === stageId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({ ...m, url: urls[m.storage_path] }));
  const isLast = activeIndex === stages.length - 1;
  const nextStage = stages[activeIndex + 1];
  const canUndo = delivered || (isActive && events.length > 1);
  const url = trackingUrl(job.tracking_token);

  /** Supabase RPC hatası → kullanıcı mesajı (fonksiyonlar Türkçe mesaj üretir) */
  const rpcText = (e: { code?: string; message?: string }) =>
    e.code === "P0001" || e.code === "P0002" || e.code === "22001"
      ? (e.message ?? "")
      : "Bağlantınızı kontrol edip yeniden deneyin.";

  async function advance() {
    const parsed = stageNoteSchema.safeParse(note);
    if (!parsed.success)
      return setNoteError(
        parsed.error.issues[0]?.message ?? "Notu kontrol edin",
      );
    setNoteError(null);
    setFlash(null);
    setBusy("advance");
    const { data, error } = await getSupabase().rpc("advance_job", {
      p_job_id: job.id,
      p_note: parsed.data,
    });
    setBusy(null);
    if (error)
      return setFlash({
        tone: "danger",
        title: "Aşama ilerletilemedi",
        text: rpcText(error),
      });
    setNote("");
    const result = data as { status: string; stage_id: string };
    if (result.status === "delivered") {
      setFlash({
        tone: "success",
        title: "İş teslim edildi",
        text: "Müşterinin takip sayfası güncellendi. Takip bağlantısı 30 gün sonra kapanır.",
        wa: deliveredWa,
      });
    } else {
      const reached = stages.find((s) => s.id === result.stage_id);
      const ready = reached && stages.at(-1)?.id === reached.id;
      const msg = renderMessage(
        ready
          ? {
              type: "job_ready",
              businessName: business.name,
              customerName: job.customer_name,
              title: job.title,
              url,
            }
          : {
              type: "stage_changed",
              businessName: business.name,
              customerName: job.customer_name,
              title: job.title,
              stageName: reached?.name ?? "",
              url,
            },
        business.message_templates,
      );
      setFlash({
        tone: "success",
        title: `“${reached?.name ?? "Sonraki aşama"}” aşamasına geçildi`,
        text: "Müşterinin takip sayfası güncellendi.",
        wa: waMeLink(msg, job.customer_phone),
      });
    }
    await fetchJob();
  }

  async function undo() {
    setFlash(null);
    setBusy("undo");
    const { error } = await getSupabase().rpc("undo_job_stage", {
      p_job_id: job.id,
    });
    setBusy(null);
    if (error)
      return setFlash({
        tone: "danger",
        title: "Geri alınamadı",
        text: rpcText(error),
      });
    setFlash({ tone: "success", title: "Son ilerletme geri alındı" });
    await fetchJob();
  }

  async function saveNote() {
    const parsed = stageNoteSchema.safeParse(note);
    if (!parsed.success)
      return setNoteError(
        parsed.error.issues[0]?.message ?? "Notu kontrol edin",
      );
    setNoteError(null);
    setFlash(null);
    setBusy("note");
    const { error } = await getSupabase().rpc("set_stage_note", {
      p_job_id: job.id,
      p_note: parsed.data ?? "",
    });
    setBusy(null);
    if (error)
      return setFlash({
        tone: "danger",
        title: "Not kaydedilemedi",
        text: rpcText(error),
      });
    setNote("");
    setFlash({
      tone: "success",
      title: "Not kaydedildi",
      text: "Müşteri notu takip sayfasında görür.",
    });
    await fetchJob();
  }

  async function addPhotos(stageId: string, files: File[]) {
    setFlash(null);
    setUploading((u) => ({
      ...u,
      [stageId]: (u[stageId] ?? 0) + files.length,
    }));
    const failures: string[] = [];
    for (const file of files) {
      try {
        await uploadStagePhoto(job.id, stageId, file);
      } catch (e) {
        failures.push(e instanceof Error ? e.message : "Fotoğraf yüklenemedi.");
      }
      setUploading((u) => ({
        ...u,
        [stageId]: Math.max(0, (u[stageId] ?? 1) - 1),
      }));
    }
    if (failures.length) {
      setFlash({
        tone: "danger",
        title:
          failures.length === files.length
            ? "Fotoğraf yüklenemedi"
            : `${files.length - failures.length} / ${files.length} fotoğraf yüklendi`,
        text: [...new Set(failures)].join(" "),
      });
    }
    await fetchJob();
  }

  async function removePhoto(p: PhotoItem) {
    setFlash(null);
    setBusy("photo-delete");
    try {
      await deleteStagePhoto(p);
    } catch (e) {
      setFlash({
        tone: "danger",
        title: "Fotoğraf silinemedi",
        text: e instanceof Error ? e.message : undefined,
      });
    }
    setBusy(null);
    await fetchJob();
  }
  const shareText = renderMessage(
    {
      type: "job_created",
      businessName: business.name,
      customerName: job.customer_name,
      title: job.title,
      trackingCode: formatCode(job.tracking_code),
      url,
    },
    business.message_templates,
  );

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">
            {job.customer_name}
          </h1>
          <span className="text-[15px] text-ut-text-muted">
            {[job.item_label, job.title].filter(Boolean).join(" · ")}
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {job.status === "active" && (
              <StatusBadge tone="active">
                {stages[activeIndex]?.name ?? "—"}
              </StatusBadge>
            )}
            {delivered && (
              <StatusBadge tone="success">Teslim edildi</StatusBadge>
            )}
            {job.status === "cancelled" && (
              <StatusBadge tone="danger">İptal edildi</StatusBadge>
            )}
          </div>
        </div>
        <a
          href={`tel:${job.customer_phone}`}
          className={buttonClass("secondary", "md")}
        >
          <IconPhone size={18} />
          Müşteriyi ara
        </a>
      </div>

      <CodeDisplay
        layout="wide"
        qrAction="download"
        code={job.tracking_code}
        url={url}
        whatsappHref={waMeLink(shareText, job.customer_phone)}
        printTitle={business.name}
      />

      <div className="flex flex-wrap items-start gap-5">
        <Card
          as="section"
          padding="lg"
          className="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle size="lg">Aşamalar</CardTitle>
            <div className="flex items-center gap-2.5">
              <StageProgressMini
                stages={stages}
                activeIndex={activeIndex}
                finished={delivered}
                className="w-[132px] gap-[3px]"
              />
              <span className="text-sm font-semibold text-ut-text-muted">
                Aşama {activeIndex + 1} / {stages.length}
              </span>
            </div>
          </div>
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
                    Müşteriye WhatsApp&apos;tan haber ver
                  </a>
                )
              }
            >
              {flash.text}
            </Notice>
          )}
          {!flash && delivered && (
            <Notice
              tone="success"
              title="İş teslim edildi"
              action={
                <a
                  href={deliveredWa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("whatsapp", "md", "mt-2 self-start")}
                >
                  <IconWhatsApp size={18} />
                  Müşteriye WhatsApp&apos;tan haber ver
                </a>
              }
            >
              {job.delivered_at
                ? `${formatLong(job.delivered_at)} tarihinde teslim edildi.`
                : "Teslim edildi."}{" "}
              Müşterinize işin bittiğini bildirebilirsiniz.
            </Notice>
          )}
          <ol
            className="m-0 flex list-none flex-col p-0"
            aria-label="İş aşamaları"
          >
            {stages.map((s, i) => {
              const done = i < activeIndex || (delivered && i === activeIndex);
              const act = !done && i === activeIndex && isActive;
              const up = !done && !act;
              const ev = lastEvent(s.id);
              const photos = photosOf(s.id);
              const canPhoto = job.status !== "cancelled" && (done || act);
              return (
                <li
                  key={s.id}
                  className="flex gap-3.5"
                  aria-current={act ? "step" : undefined}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "box-border flex size-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                        done && "bg-ut-success text-white",
                        act &&
                          "bg-ut-accent text-ut-text shadow-[0_0_0_4px_rgba(245,158,11,.25)]",
                        up &&
                          "border-2 border-ut-border bg-white text-ut-text-muted",
                      )}
                    >
                      {done ? <IconCheck size={16} strokeWidth={3} /> : i + 1}
                    </span>
                    {i < stages.length - 1 && (
                      <span
                        className={cn(
                          "my-1 w-0.5 flex-1",
                          done ? "bg-ut-success" : "bg-ut-border",
                        )}
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1 pb-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "text-base font-bold",
                          up && "text-ut-text-muted",
                        )}
                      >
                        {s.name}
                        <span className="sr-only">
                          {done
                            ? " (tamamlandı)"
                            : act
                              ? " (aktif aşama)"
                              : " (sırada)"}
                        </span>
                      </span>
                      {ev && (
                        <span className="text-[13px] text-ut-text-muted">
                          {formatRelative(ev.entered_at)}
                        </span>
                      )}
                    </div>

                    {!act && ev?.note && (
                      <p className="m-0 text-sm leading-normal">{ev.note}</p>
                    )}
                    {done && canPhoto && (
                      <StagePhotos
                        variant="row"
                        stageName={s.name}
                        photos={photos}
                        uploading={uploading[s.id] ?? 0}
                        onAdd={(files) => void addPhotos(s.id, files)}
                      />
                    )}
                    {up && (
                      <span className="text-[13px] text-ut-text-muted">
                        Sırada
                      </span>
                    )}

                    {act && (
                      <div className="flex flex-col gap-3 rounded-ut border-[1.5px] border-ut-accent bg-ut-accent-tint p-4">
                        {ev?.note && (
                          <p className="m-0 text-sm leading-normal">
                            {ev.note}
                          </p>
                        )}
                        <Label htmlFor="stage-note" optional="müşteri görür">
                          Aşama notu
                        </Label>
                        <Textarea
                          id="stage-note"
                          rows={2}
                          maxLength={1000}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Örn. Parçalar yarın sabah serviste olacak."
                          aria-invalid={!!noteError}
                          aria-describedby={
                            noteError
                              ? "stage-note-err"
                              : ev?.note
                                ? "stage-note-hint"
                                : undefined
                          }
                          className="py-2.5"
                        />
                        {ev?.note && !noteError && (
                          <span
                            id="stage-note-hint"
                            className="-mt-1.5 text-[13px] text-ut-text-muted"
                          >
                            Yazdığınız not yukarıdaki notun yerine geçer.
                          </span>
                        )}
                        <FieldError id="stage-note-err">{noteError}</FieldError>
                        {note.trim() && (
                          <Button
                            variant="secondary"
                            className="self-start"
                            onClick={() => void saveNote()}
                            loading={busy === "note"}
                            loadingText="Kaydediliyor…"
                            disabled={busy !== null}
                          >
                            Notu kaydet
                          </Button>
                        )}
                        <StagePhotos
                          variant="grid"
                          stageName={s.name}
                          photos={photos}
                          uploading={uploading[s.id] ?? 0}
                          onAdd={(files) => void addPhotos(s.id, files)}
                          onDelete={(p) => void removePhoto(p)}
                          disabled={busy === "photo-delete"}
                        />
                        <Button
                          size="2xl"
                          block
                          onClick={() => void advance()}
                          loading={busy === "advance"}
                          loadingText="Kaydediliyor…"
                          disabled={busy !== null || (uploading[s.id] ?? 0) > 0}
                        >
                          {isLast
                            ? "İşi tamamla ve teslim et"
                            : `Sonraki aşamaya geç: ${nextStage?.name ?? ""}`}
                          <IconArrowRight size={20} />
                        </Button>
                        <span className="text-[13px] text-ut-text-muted">
                          Tek dokunuşla ilerler; müşterinin takip sayfası hemen
                          güncellenir.
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {canUndo && (
            <Button
              variant="ghost"
              className="self-start"
              onClick={() => void undo()}
              loading={busy === "undo"}
              loadingText="Geri alınıyor…"
              disabled={busy !== null}
            >
              {delivered ? "Teslimi geri al" : "Son ilerletmeyi geri al"}
            </Button>
          )}
        </Card>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <OfferPanel
            job={job}
            businessName={business.name}
            templates={business.message_templates}
            trackingUrl={url}
            onJobChanged={() => void fetchJob()}
          />
          <Card as="section" padding="lg" className="flex flex-col gap-4">
            <CardTitle size="lg">İş bilgileri</CardTitle>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[15px]">
              <dt className="text-ut-text-muted">Telefon</dt>
              <dd className="m-0 font-semibold tabular-nums">
                {formatPhone(job.customer_phone)}
              </dd>
              <dt className="text-ut-text-muted">Anlaşılan</dt>
              <dd className="m-0 font-semibold tabular-nums">
                {job.agreed_amount != null ? formatTRY(job.agreed_amount) : "—"}
              </dd>
              <dt className="text-ut-text-muted">Tahmini teslim</dt>
              <dd className="m-0 font-semibold">
                {job.estimated_delivery
                  ? formatLong(job.estimated_delivery)
                  : "—"}
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
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto box-border flex max-w-[1200px] flex-col gap-5 px-6 pt-5 pb-14">
      <BackLink href="/panel/">Aktif işler</BackLink>
      {children}
    </main>
  );
}

function DetailSkeleton() {
  return (
    <Shell>
      <LoadingRegion label="İş yükleniyor…" className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Card className="flex items-center gap-5">
          <Skeleton className="size-[108px] rounded-ut" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-48" />
          </div>
        </Card>
        <Card padding="lg" className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      </LoadingRegion>
    </Shell>
  );
}
