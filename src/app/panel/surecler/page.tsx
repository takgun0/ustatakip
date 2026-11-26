"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBusiness } from "@/lib/business";
import { getSupabase } from "@/lib/supabase";
import { STAGE_COLORS, templateSaveSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, Eyebrow } from "@/components/ui/Card";
import { Field, FieldError, Input, Label } from "@/components/ui/Field";
import { EmptyState, ErrorState, LoadingRegion, Notice, Skeleton } from "@/components/ui/States";
import { StageProgress } from "@/components/ui/StageProgress";
import { IconLayers, IconPlus, IconTrash } from "@/components/ui/icons";
import { StageListEditor, type DraftStage } from "@/components/panel/StageListEditor";
import { BackLink } from "@/components/ui/BackLink";

type Stage = { id: string; name: string; position: number; color: string; job_stage_events: Array<{ count: number }> };
type Template = {
  id: string;
  business_id: string | null;
  name: string;
  sector: string;
  created_at: string;
  template_stages: Stage[];
  jobs: Array<{ count: number }>;
};
type Load = { status: "loading" } | { status: "error" } | { status: "ready"; own: Template[]; ready: Template[] };
type Draft = { templateId: string | null; name: string; stages: DraftStage[] };

let keySeq = 0;
const newKey = () => `n${++keySeq}`;
const palette = new Set<string>(STAGE_COLORS);
const normColor = (c: string) => (palette.has(c.toUpperCase()) ? c.toUpperCase() : STAGE_COLORS[1]);

function toDraft(t: Template): Draft {
  return { templateId: t.id, name: t.name, stages: t.template_stages.map((s) => ({ key: s.id, id: s.id, name: s.name, color: normColor(s.color) })) };
}

const blankDraft = (): Draft => ({
  templateId: null,
  name: "",
  stages: [
    { key: newKey(), id: null, name: "Teslim Alındı", color: STAGE_COLORS[0] },
    { key: newKey(), id: null, name: "İşlemde", color: STAGE_COLORS[2] },
    { key: newKey(), id: null, name: "Teslime Hazır", color: STAGE_COLORS[4] },
  ],
});

const snapshot = (d: Draft | null) => (d ? JSON.stringify({ n: d.name, s: d.stages.map(({ id, name, color }) => [id, name, color]) }) : "");

/** RPC hatalarını kullanıcı diline çevirir (fonksiyonlar Türkçe mesaj üretir) */
function rpcMessage(error: { code?: string; message?: string }): string {
  if (error.code && ["23503", "22023", "23514", "P0002"].includes(error.code) && error.message) return error.message;
  return "Şablon kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin.";
}

/** E5 · /panel/surecler — süreç şablonları (aşama ekle/sil, sırala, renk) */
export default function SureclerPage() {
  const { business } = useBusiness();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("process_templates")
      .select("id, business_id, name, sector, created_at, jobs(count), template_stages(id, name, position, color, job_stage_events(count))")
      .order("created_at")
      .returns<Template[]>();
    if (error) {
      setLoad({ status: "error" });
      return null;
    }
    const all = (data ?? []).map((t) => ({ ...t, template_stages: [...t.template_stages].sort((a, b) => a.position - b.position) }));
    const next = { own: all.filter((t) => t.business_id === business.id), ready: all.filter((t) => t.business_id === null) };
    setLoad({ status: "ready", ...next });
    return next;
  }, [business.id]);

  const select = useCallback((d: Draft | null) => {
    setDraft(d);
    setSaved(snapshot(d));
    setErrors({});
    setConfirmDelete(false);
  }, []);

  useEffect(() => {
    // Şablonlar Supabase'den okunur (dış sistem senkronizasyonu)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll().then((r) => {
      if (r) select(r.own[0] ? toDraft(r.own[0]) : null);
    });
  }, [fetchAll, select]);

  const dirty = draft !== null && snapshot(draft) !== saved;
  const own = load.status === "ready" ? load.own : [];
  const current = own.find((t) => t.id === draft?.templateId) ?? null;
  const usedIds = useMemo(
    () => new Set((current?.template_stages ?? []).filter((s) => (s.job_stage_events[0]?.count ?? 0) > 0).map((s) => s.id)),
    [current],
  );
  const jobCount = current?.jobs[0]?.count ?? 0;

  function guard(): boolean {
    return !dirty || window.confirm("Kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?");
  }

  function open(t: Template) {
    if (t.id === draft?.templateId || !guard()) return;
    setResult(null);
    select(toDraft(t));
  }

  function startNew() {
    if (!guard()) return;
    setResult(null);
    select(blankDraft());
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  async function cloneReady(t: Template) {
    if (!guard()) return;
    setBusy(t.id);
    setResult(null);
    const { data: id, error } = await getSupabase().rpc("clone_template", { p_template_id: t.id });
    setBusy(null);
    if (error) return setResult({ ok: false, text: "Hazır şablon eklenemedi. Yeniden deneyin." });
    const r = await fetchAll();
    const created = r?.own.find((x) => x.id === id);
    if (created) select(toDraft(created));
    setResult({ ok: true, text: `“${t.name}” şablonunuza eklendi. Dilediğiniz gibi düzenleyebilirsiniz.` });
  }

  async function save() {
    if (!draft) return;
    setResult(null);
    const payload = { name: draft.name, stages: draft.stages.map(({ id, name, color }) => ({ id, name, color })) };
    const parsed = templateSaveSchema.safeParse(payload);
    if (!parsed.success) {
      const errs = toFieldErrors(parsed.error);
      setErrors(errs);
      setResult({ ok: false, text: errs.stages ?? errs.name ?? "Kırmızıyla işaretli alanları düzeltin." });
      return;
    }
    setErrors({});
    setBusy("save");
    const supabase = getSupabase();
    let id = draft.templateId;
    let error: { code?: string; message?: string } | null;
    if (id) {
      ({ error } = await supabase.rpc("save_template", { p_template_id: id, p_name: parsed.data.name, p_stages: parsed.data.stages }));
    } else {
      const res = await supabase.rpc("create_template", { p_name: parsed.data.name, p_stages: parsed.data.stages });
      error = res.error;
      id = (res.data as string | null) ?? null;
    }
    setBusy(null);
    if (error) return setResult({ ok: false, text: rpcMessage(error) });
    const r = await fetchAll();
    const t = r?.own.find((x) => x.id === id);
    if (t) select(toDraft(t));
    setResult({ ok: true, text: "Şablon kaydedildi. Yeni işlerde bu aşamalar kullanılır." });
  }

  async function remove() {
    if (!draft?.templateId) return;
    setBusy("delete");
    const { error } = await getSupabase().from("process_templates").delete().eq("id", draft.templateId);
    setBusy(null);
    setConfirmDelete(false);
    if (error) {
      return setResult({
        ok: false,
        text: error.code === "23503" ? "Bu şablonla kaydedilmiş işler var; silinemez." : "Şablon silinemedi. Yeniden deneyin.",
      });
    }
    const r = await fetchAll();
    select(r?.own[0] ? toDraft(r.own[0]) : null);
    setResult({ ok: true, text: "Şablon silindi." });
  }

  function addStage() {
    if (!draft) return;
    const last = draft.stages[draft.stages.length - 1];
    const stages = [...draft.stages];
    // Yeni aşama, son ("Teslime Hazır") aşamadan önceye eklenir
    stages.splice(Math.max(stages.length - 1, 0), 0, { key: newKey(), id: null, name: "", color: last?.color === STAGE_COLORS[2] ? STAGE_COLORS[1] : STAGE_COLORS[2] });
    setDraft({ ...draft, stages });
    requestAnimationFrame(() => document.getElementById(`stage-${stages[stages.length - 2]!.key}`)?.focus());
  }

  return (
    <main className="mx-auto box-border flex max-w-[1200px] flex-col gap-5 px-4 pt-5 pb-14 sm:px-6">
      <BackLink href="/panel/">Aktif işler</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.01em]">Süreçler</h1>
          <p className="m-0 text-[15px] text-ut-text-muted">İşlerinizin geçtiği aşamalar. Müşteri takip sayfasında bu adları görür.</p>
        </div>
        <Button variant="accent" icon={<IconPlus size={18} />} onClick={startNew} disabled={load.status !== "ready"}>
          Yeni şablon
        </Button>
      </div>

      {load.status === "loading" && <SureclerSkeleton />}
      {load.status === "error" && <ErrorState title="Şablonlar yüklenemedi" onRetry={() => void fetchAll()} />}

      {load.status === "ready" && (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
            {result && (
              <Notice tone={result.ok ? "success" : "danger"} title={result.ok ? undefined : "İşlem tamamlanamadı"}>
                {result.text}
              </Notice>
            )}

            {!draft ? (
              <EmptyState
                icon={<IconLayers size={22} />}
                title="Henüz süreç şablonunuz yok"
                description="Yeni bir şablon oluşturun ya da sağdaki hazır şablonlardan birini ekleyip düzenleyin."
                action={
                  <Button variant="secondary" icon={<IconPlus size={18} />} onClick={startNew}>
                    Yeni şablon
                  </Button>
                }
              />
            ) : (
              <Card padding="lg" className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle size="lg">{draft.templateId ? "Şablonu düzenle" : "Yeni şablon"}</CardTitle>
                  {draft.templateId && (
                    <span className="text-[13px] text-ut-text-muted">{jobCount > 0 ? `${jobCount} işte kullanılıyor` : "Henüz işte kullanılmadı"}</span>
                  )}
                </div>

                <Field>
                  <Label htmlFor="tpl-name">Şablon adı</Label>
                  <Input
                    ref={titleRef}
                    id="tpl-name"
                    value={draft.name}
                    maxLength={60}
                    placeholder="Örn. Genel Bakım"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "tpl-name-err" : undefined}
                  />
                  <FieldError id="tpl-name-err">{errors.name}</FieldError>
                </Field>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">Aşamalar</span>
                    <span className="text-[13px] text-ut-text-muted">{draft.stages.length} / 12 · tutamaçtan sürükleyerek sıralayın</span>
                  </div>
                  <StageListEditor
                    stages={draft.stages}
                    onChange={(stages) => setDraft({ ...draft, stages })}
                    usedIds={usedIds}
                    errors={errors}
                    onAdd={addStage}
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-ut bg-ut-bg p-4">
                  <Eyebrow>Müşteri böyle görür</Eyebrow>
                  <div className="overflow-x-auto">
                    <StageProgress
                      className="min-w-[420px]"
                      stages={draft.stages.map((s, i) => ({ id: s.key, name: s.name.trim() || `${i + 1}. aşama` }))}
                      activeIndex={Math.min(1, draft.stages.length - 1)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button size="lg" onClick={() => void save()} loading={busy === "save"} loadingText="Kaydediliyor…" disabled={!dirty || busy !== null}>
                    {draft.templateId ? "Değişiklikleri kaydet" : "Şablonu oluştur"}
                  </Button>
                  {dirty && (
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        setResult(null);
                        if (current) select(toDraft(current));
                        else select(own[0] ? toDraft(own[0]) : null);
                      }}
                    >
                      Vazgeç
                    </Button>
                  )}
                  {draft.templateId && !confirmDelete && (
                    <Button
                      variant="danger"
                      size="lg"
                      className="ml-auto"
                      icon={<IconTrash size={18} />}
                      disabled={jobCount > 0 || busy !== null}
                      title={jobCount > 0 ? "Bu şablonla kaydedilmiş işler var" : undefined}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Şablonu sil
                    </Button>
                  )}
                </div>
                {jobCount > 0 && draft.templateId && (
                  <p className="m-0 text-[13px] text-ut-text-muted">
                    Bu şablonla kaydedilmiş işler olduğu için şablon silinemez; aşamaların adını, rengini ve sırasını değiştirebilir, yeni aşama ekleyebilirsiniz.
                  </p>
                )}
                {confirmDelete && (
                  <Notice
                    tone="warning"
                    title={`“${draft.name}” silinsin mi?`}
                    action={
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button variant="danger" onClick={() => void remove()} loading={busy === "delete"} loadingText="Siliniyor…">
                          Evet, sil
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                          Vazgeç
                        </Button>
                      </div>
                    }
                  >
                    Bu işlem geri alınamaz.
                  </Notice>
                )}
              </Card>
            )}
          </div>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <Card className="flex flex-col gap-3" aria-labelledby="own-title">
              <CardTitle size="md">
                <span id="own-title">Şablonlarınız</span>
              </CardTitle>
              {own.length === 0 ? (
                <p className="m-0 text-sm text-ut-text-muted">Henüz şablon yok.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {own.map((t) => {
                    const on = t.id === draft?.templateId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => open(t)}
                          aria-current={on ? "true" : undefined}
                          className={cn(
                            "flex w-full flex-col gap-2 rounded-ut border px-3.5 py-3 text-left",
                            on ? "border-ut-primary bg-ut-primary-soft" : "border-ut-border bg-ut-surface hover:bg-ut-bg",
                          )}
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-[15px] font-bold text-ut-text">{t.name}</span>
                            <span className="shrink-0 text-[13px] text-ut-text-muted">{t.template_stages.length} aşama</span>
                          </span>
                          <ColorStrip stages={t.template_stages} />
                          <span className="text-[13px] text-ut-text-muted">
                            {(t.jobs[0]?.count ?? 0) > 0 ? `${t.jobs[0]!.count} işte kullanılıyor` : "Kullanılmıyor"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {load.ready.length > 0 && (
              <Card className="flex flex-col gap-3" aria-labelledby="ready-title">
                <div className="flex flex-col gap-1">
                  <CardTitle size="md">
                    <span id="ready-title">Hazır şablonlar</span>
                  </CardTitle>
                  <span className="text-[13px] text-ut-text-muted">Kopyası şablonlarınıza eklenir; aslı değişmez.</span>
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {load.ready.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-ut border border-ut-border px-3.5 py-3">
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="text-[15px] font-bold">{t.sector}</span>
                        <span className="truncate text-[13px] text-ut-text-muted">{t.template_stages.map((s) => s.name).join(" → ")}</span>
                      </span>
                      <Button variant="secondary" onClick={() => void cloneReady(t)} loading={busy === t.id} loadingText="Ekleniyor…" disabled={busy !== null}>
                        Ekle
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

function ColorStrip({ stages }: { stages: Array<{ id: string; color: string }> }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {stages.map((s) => (
        <span key={s.id} className="h-1.5 flex-1 rounded-full" style={{ background: s.color }} />
      ))}
    </span>
  );
}

function SureclerSkeleton() {
  return (
    <LoadingRegion label="Şablonlar yükleniyor…" className="flex flex-wrap items-start gap-5">
      <Card padding="lg" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-full rounded-ut" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[60px] w-full rounded-ut" />
        ))}
      </Card>
      <Card className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full rounded-ut" />
        <Skeleton className="h-20 w-full rounded-ut" />
      </Card>
    </LoadingRegion>
  );
}
