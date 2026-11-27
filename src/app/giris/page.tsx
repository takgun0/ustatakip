import type { Metadata } from "next";
import { AuthForm } from "./AuthForm";
import { BrandMark } from "@/components/ui/BrandMark";
import { BackLink } from "@/components/ui/BackLink";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = { title: "Esnaf girişi" };

/** E1 · /giris — esnaf giriş/kayıt */
export default function GirisPage() {
  return (
    <main className="ut-glow flex min-h-dvh flex-col items-center px-4 pt-4 pb-10 text-ut-text">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <div className="-mb-3 flex items-center justify-between">
          <BackLink href="/">Ana sayfa</BackLink>
          <ThemeToggle />
        </div>
        <header className="flex items-center gap-3.5">
          <BrandMark tone="onLight" size={48} />
          <div className="flex flex-col gap-0.5">
            <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.03em] text-ut-text">UstaTakip</h1>
            <p className="m-0 text-[15px] text-ut-text-muted">Esnaf için iş takibi</p>
          </div>
        </header>
        <AuthForm />
      </div>
    </main>
  );
}
