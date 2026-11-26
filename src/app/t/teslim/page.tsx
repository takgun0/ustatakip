"use client";

import { useState, type FormEvent } from "react";
import { callFunction } from "@/lib/customer-api";
import { formatLong } from "@/lib/dates";
import { formatTRY } from "@/lib/money";
import { formatCode } from "@/lib/tracking";
import { ratingSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardTitle, Eyebrow } from "@/components/ui/Card";
import { FieldError, Label, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { IconArrowLeft, IconStar } from "@/components/ui/icons";
import { BusinessHeader, CustomerFrame, TrackingProblem, TrackingSkeleton } from "@/components/customer/CustomerChrome";
import { useTracking } from "@/components/customer/useTracking";

const LABELS = ["Çok kötü", "Kötü", "İdare eder", "İyi", "Çok iyi"];

/** M4 · /t/teslim/#<token> — teslim özeti ve 1–5 puan */
export default function TeslimPage() {
  const { token, state, reload } = useTracking();
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ score: number } | null>(null);

  if (state.status === "loading") return <TrackingSkeleton />;
  if (state.status === "missing") return <TrackingProblem error={null} onRetry={reload} />;
  if (state.status === "error") return <TrackingProblem error={state.error} onRetry={reload} />;

  const v = state.view;
  const rated = sent ?? v.rating;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProblem(null);
    const comment = String(new FormData(e.currentTarget).get("comment") ?? "");
    const parsed = ratingSchema.safeParse({ token, score, comment });
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    const res = await callFunction<{ rating: { score: number } }>("track-rate", { token, score, comment });
    setBusy(false);
    if (res.ok) return setSent({ score });
    if (res.error.code === "already_rated") return setSent({ score });
    if (res.error.fields) setErrors(res.error.fields);
    setProblem(res.error.message);
  }

  return (
    <CustomerFrame header={<BusinessHeader business={v.business} />}>
      <ButtonLink href={`/t/#${token}`} variant="ghost" className="self-start px-1" icon={<IconArrowLeft size={18} />}>
        İşin takip sayfası
      </ButtonLink>

      <Card as="section" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>Takip kodu</Eyebrow>
          <span className="font-mono text-sm font-bold text-ut-primary">{formatCode(v.job.code)}</span>
        </div>
        <h1 className="m-0 text-[22px] leading-tight font-bold">{v.job.title}</h1>
        {v.job.itemLabel && <span className="text-sm text-ut-text-muted">{v.job.itemLabel}</span>}
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {v.job.deliveredAt && (
            <>
              <dt className="text-ut-text-muted">Teslim</dt>
              <dd className="m-0 font-semibold">{formatLong(v.job.deliveredAt)}</dd>
            </>
          )}
          {v.job.agreedAmount != null && (
            <>
              <dt className="text-ut-text-muted">Anlaşılan tutar</dt>
              <dd className="m-0 font-semibold tabular-nums">{formatTRY(v.job.agreedAmount)}</dd>
            </>
          )}
        </dl>
      </Card>

      {v.job.status !== "delivered" ? (
        <Notice tone="neutral" title="İşiniz henüz teslim edilmedi">
          Teslimden sonra bu sayfadan hizmeti puanlayabilirsiniz.
        </Notice>
      ) : rated ? (
        <Notice tone="success" title="Teşekkürler!">
          <span className="flex flex-col gap-2">
            <span>Puanınız {v.business.name} ile paylaşıldı.</span>
            <Stars value={rated.score} />
          </span>
        </Notice>
      ) : (
        <Card as="div" className="flex flex-col gap-4">
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            <CardTitle size="sm">Hizmeti nasıl buldunuz?</CardTitle>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-describedby="score-err">
              <legend className="sr-only">1 ile 5 arasında puan</legend>
              <div className="flex justify-between gap-1">
                {LABELS.map((label, i) => {
                  const n = i + 1;
                  const on = n <= score;
                  return (
                    <label key={n} className="flex flex-1 cursor-pointer flex-col items-center gap-1">
                      <input type="radio" name="score" value={n} checked={score === n} onChange={() => setScore(n)} aria-label={`${n} yıldız, ${label}`} className="peer sr-only" />
                      <span
                        className={cn(
                          "flex size-12 items-center justify-center rounded-ut peer-focus-visible:outline-2 peer-focus-visible:outline-ut-info",
                          on ? "text-ut-accent" : "text-ut-border",
                        )}
                      >
                        <IconStar size={36} filled={on} strokeWidth={1.6} />
                      </span>
                      <span className={cn("text-center text-[11.5px] leading-tight", score === n ? "font-bold text-ut-text" : "text-ut-text-muted")}>
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
              <FieldError id="score-err">{errors.score}</FieldError>
            </fieldset>
            <div className="flex flex-col gap-2">
              <Label htmlFor="comment" optional>
                Yorumunuz
              </Label>
              <Textarea id="comment" name="comment" rows={3} maxLength={1000} placeholder="İşletmeye iletmek istediğiniz bir not" aria-invalid={!!errors.comment} aria-describedby="comment-err" />
              <FieldError id="comment-err">{errors.comment}</FieldError>
            </div>
            {problem && <Notice tone="danger" title="Puan gönderilemedi">{problem}</Notice>}
            <Button type="submit" size="xl" block loading={busy} loadingText="Gönderiliyor…">
              Puanı gönder
            </Button>
          </form>
        </Card>
      )}
    </CustomerFrame>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-1 text-ut-accent" role="img" aria-label={`5 üzerinden ${value} puan`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar key={n} size={22} filled={n <= value} className={n <= value ? "" : "text-ut-text-muted"} />
      ))}
    </span>
  );
}
