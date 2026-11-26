"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { callFunction, tokenFromScannedText } from "@/lib/customer-api";
import { normalizeTrackingCode, formatCode } from "@/lib/tracking";
import { toFieldErrors, trackLookupSchema, type FieldErrors } from "@/lib/validation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BrandMark } from "@/components/ui/BrandMark";
import { Field, FieldError, FieldHint, Input, Label } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { IconArrowRight, IconQr } from "@/components/ui/icons";

const QrScanner = dynamic(() => import("@/components/customer/QrScanner").then((m) => m.QrScanner), { ssr: false });

type Problem = { tone: "danger" | "warning"; title: string; text: string } | null;

/** M1 · /takip — takip kodu + telefonun son 4 hanesi ya da QR */
export default function TakipPage() {
  const router = useRouter();
  const codeRef = useRef<HTMLInputElement>(null);
  const last4Ref = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Fişteki "?kod=" bağlantısı kodu önceden doldurur
  useEffect(() => {
    const kod = new URLSearchParams(window.location.search).get("kod");
    const code = kod ? normalizeTrackingCode(kod) : null;
    if (code && codeRef.current) {
      codeRef.current.value = formatCode(code);
      last4Ref.current?.focus();
    }
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProblem(null);
    const parsed = trackLookupSchema.safeParse({ code: codeRef.current?.value ?? "", last4: last4Ref.current?.value ?? "" });
    if (!parsed.success) {
      const fields = toFieldErrors(parsed.error);
      setErrors(fields);
      (fields.code ? codeRef : last4Ref).current?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await callFunction<{ token: string }>("track-lookup", parsed.data);
    if (res.ok) {
      router.push(`/t/#${res.data.token}`);
      return;
    }
    setBusy(false);
    const { error } = res;
    if (error.status === 422 && error.fields) return setErrors(error.fields);
    if (error.status === 404) setProblem({ tone: "danger", title: "Eşleşme bulunamadı", text: error.message });
    else if (error.status === 410) setProblem({ tone: "warning", title: "Takip süresi doldu", text: error.message });
    else if (error.status === 429) setProblem({ tone: "warning", title: "Çok fazla deneme", text: error.message });
    else setProblem({ tone: "danger", title: "Sorgulanamadı", text: error.message });
  }

  const onScan = useCallback(
    (text: string) => {
      setScanning(false);
      const token = tokenFromScannedText(text);
      if (token) return router.push(`/t/#${token}`);
      const code = normalizeTrackingCode(text);
      if (code && codeRef.current) {
        codeRef.current.value = formatCode(code);
        last4Ref.current?.focus();
        return;
      }
      setProblem({ tone: "warning", title: "Tanınmayan QR", text: "Bu QR bir UstaTakip takip kodu değil. Kodu elle girebilirsiniz." });
    },
    [router],
  );
  const closeScanner = useCallback(() => setScanning(false), []);

  return (
    <div className="mx-auto box-border flex min-h-dvh max-w-[480px] flex-col">
      <header className="flex items-center gap-3 border-b border-ut-border bg-ut-surface px-5 py-4">
        <BrandMark tone="onLight" size={40} />
        <span className="text-[17px] font-bold">UstaTakip</span>
      </header>

      <main className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1 px-1 pt-2">
          <h1 className="m-0 text-2xl leading-tight font-bold">İşimi takip et</h1>
          <p className="m-0 text-[15px] leading-normal text-ut-text-muted">
            Ustanızın verdiği takip kodunu ve telefon numaranızın son 4 hanesini girin.
          </p>
        </div>

        <form noValidate onSubmit={onSubmit} aria-label="Takip kodu sorgulama">
        <Card as="div" padding="lg" className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="code">Takip kodu</Label>
            <Input
              ref={codeRef}
              id="code"
              name="code"
              placeholder="UT-XXXX-XX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              className="h-[52px] font-mono text-lg font-bold tracking-[0.04em] uppercase placeholder:font-normal"
              aria-invalid={!!errors.code}
              aria-describedby="code-hint code-err"
            />
            <FieldError id="code-err">{errors.code}</FieldError>
            <FieldHint id="code-hint">Fişinizde ya da WhatsApp mesajında yazar.</FieldHint>
          </Field>
          <Field>
            <Label htmlFor="last4">Telefonunuzun son 4 hanesi</Label>
            <Input
              ref={last4Ref}
              id="last4"
              name="last4"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={4}
              placeholder="••••"
              className="h-[52px] w-40 text-lg font-bold tracking-[0.3em] tabular-nums"
              aria-invalid={!!errors.last4}
              aria-describedby="last4-err"
            />
            <FieldError id="last4-err">{errors.last4}</FieldError>
          </Field>

          {problem && (
            <Notice tone={problem.tone} title={problem.title}>
              {problem.text}
            </Notice>
          )}

          <Button type="submit" size="xl" block loading={busy} loadingText="Sorgulanıyor…" icon={<IconArrowRight size={18} />}>
            Takip et
          </Button>
        </Card>
        </form>

        <div className="flex items-center gap-3 text-[13px] text-ut-text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-ut-border" />
          ya da
          <span className="h-px flex-1 bg-ut-border" />
        </div>

        <Button variant="secondary" size="xl" block onClick={() => setScanning(true)} icon={<IconQr size={20} />}>
          QR Okut
        </Button>

        <p className="m-0 mt-2 text-center text-xs text-ut-text-muted">UstaTakip ile takip ediliyor</p>
      </main>

      {scanning && <QrScanner onResult={onScan} onClose={closeScanner} />}
    </div>
  );
}
