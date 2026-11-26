"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import { siteUrl } from "@/lib/site";
import { cn } from "@/lib/cn";
import { SECTORS, signInSchema, signUpSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, FieldError, FieldHint, Input, Label, Select } from "@/components/ui/Field";
import { ErrorState, Notice } from "@/components/ui/States";
import { IconMail } from "@/components/ui/icons";

type Mode = "signin" | "signup";

function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  // Yalnızca site içi /panel yolları
  return next && /^\/panel(\/[\w\-/?=&%.]*)?$/.test(next) ? next : "/panel/";
}

function authErrorText(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-posta ya da şifre hatalı.";
  if (/email not confirmed/i.test(message)) return "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin.";
  if (/already registered|already been registered/i.test(message)) return "Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.";
  if (/rate limit|too many/i.test(message)) return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.";
  return "İşlem tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.";
}

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const supabase = getSupabase();

    if (mode === "signin") {
      const parsed = signInSchema.safeParse(raw);
      if (!parsed.success) return setErrors(toFieldErrors(parsed.error));
      setErrors({});
      setPending(true);
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      setPending(false);
      if (error) return setFormError(authErrorText(error.message));
      router.replace(safeNext());
      return;
    }

    const parsed = signUpSchema.safeParse(raw);
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${siteUrl()}/panel/`,
        // handle_new_user tetikleyicisi bu bilgilerle işletmeyi ve sektör şablonunu oluşturur
        data: {
          business_name: parsed.data.businessName,
          phone: parsed.data.phone,
          sector: parsed.data.sector === "Diğer" ? "" : parsed.data.sector,
        },
      },
    });
    setPending(false);
    if (error) return setFormError(authErrorText(error.message));
    if (data.session) router.replace("/panel/");
    else setConfirmEmail(parsed.data.email);
  }

  if (confirmEmail) {
    return (
      <Card padding="lg" className="flex flex-col gap-4">
        <Notice tone="success" title="Hesabınız oluşturuldu" icon={<IconMail size={18} />}>
          <strong>{confirmEmail}</strong> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra panelinize
          yönlendirileceksiniz.
        </Notice>
        <Button
          variant="secondary"
          onClick={() => {
            setConfirmEmail(null);
            setMode("signin");
          }}
        >
          Giriş ekranına dön
        </Button>
      </Card>
    );
  }

  const err = (k: string) => errors[k];
  const describedBy = (k: string, hint?: string) => [err(k) ? `${k}-error` : null, hint].filter(Boolean).join(" ") || undefined;

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div role="tablist" aria-label="Giriş türü" className="grid grid-cols-2 gap-2 rounded-ut bg-ut-bg p-1">
        {(
          [
            ["signin", "Giriş yap"],
            ["signup", "Kayıt ol"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setErrors({});
              setFormError(null);
            }}
            className={cn(
              "h-11 rounded-[10px] border text-[15px] font-semibold",
              mode === m ? "border-ut-primary bg-ut-primary text-white" : "border-transparent bg-transparent text-ut-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4" aria-label={mode === "signin" ? "Giriş formu" : "Kayıt formu"}>
        {mode === "signup" && (
          <>
            <Field>
              <Label htmlFor="businessName">İşletme adı</Label>
              <Input id="businessName" name="businessName" autoComplete="organization" placeholder="Örn. Yıldız Oto Servis" aria-invalid={!!err("businessName")} aria-describedby={describedBy("businessName")} />
              <FieldError id="businessName-error">{err("businessName")}</FieldError>
            </Field>
            <Field>
              <Label htmlFor="sector">Sektör</Label>
              <Select id="sector" name="sector" defaultValue="Oto Tamir" aria-describedby={describedBy("sector", "sector-hint")}>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="Diğer">Diğer (aşamaları kendim tanımlayacağım)</option>
              </Select>
              <FieldHint id="sector-hint">Seçtiğiniz sektörün hazır süreç şablonu hesabınıza eklenir.</FieldHint>
            </Field>
            <Field>
              <Label htmlFor="phone">İşletme telefonu</Label>
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" aria-invalid={!!err("phone")} aria-describedby={describedBy("phone")} />
              <FieldError id="phone-error">{err("phone")}</FieldError>
            </Field>
          </>
        )}
        <Field>
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!err("email")} aria-describedby={describedBy("email")} />
          <FieldError id="email-error">{err("email")}</FieldError>
        </Field>
        <Field>
          <Label htmlFor="password">Şifre</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            aria-invalid={!!err("password")}
            aria-describedby={describedBy("password", mode === "signup" ? "password-hint" : undefined)}
          />
          {mode === "signup" && <FieldHint id="password-hint">En az 8 karakter.</FieldHint>}
          <FieldError id="password-error">{err("password")}</FieldError>
        </Field>

        {formError && <ErrorState title={mode === "signin" ? "Giriş yapılamadı" : "Kayıt tamamlanamadı"} description={formError} />}

        <Button type="submit" size="xl" variant={mode === "signin" ? "primary" : "accent"} loading={pending} loadingText={mode === "signin" ? "Giriş yapılıyor…" : "Hesap oluşturuluyor…"}>
          {mode === "signin" ? "Giriş yap" : "Hesabı oluştur"}
        </Button>
      </form>

      <p className="m-0 text-center text-[13px] text-ut-text-muted">
        Müşteri misiniz? <Link href="/takip/">İşinizi takip edin</Link>
      </p>
    </Card>
  );
}
