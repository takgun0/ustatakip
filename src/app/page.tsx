import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { IconArrowRight, IconQr, IconWrench } from "@/components/ui/icons";

/** Giriş noktası: müşteri takibi ya da esnaf paneli */
export default function Home() {
  const items = [
    { href: "/takip/", title: "İşimi takip et", text: "Takip kodu ya da QR ile işinizin hangi aşamada olduğunu görün.", icon: <IconQr size={22} /> },
    { href: "/giris/", title: "Esnaf girişi", text: "İş kaydedin, aşamaları güncelleyin, teklif gönderin.", icon: <IconWrench size={22} /> },
  ];
  return (
    <main className="flex min-h-dvh flex-col items-center bg-ut-bg px-4 py-12 text-ut-text">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <header className="flex items-center gap-3.5">
          <BrandMark tone="onLight" size={52} />
          <div className="flex flex-col gap-0.5">
            <h1 className="m-0 text-[30px] font-bold tracking-[-0.02em] text-ut-primary">UstaTakip</h1>
            <p className="m-0 text-[15px] text-ut-text-muted">Esnaf için kargo takibi mantığında iş takibi</p>
          </div>
        </header>
        <nav className="flex flex-col gap-3" aria-label="Ana menü">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-3 rounded-ut border border-ut-border bg-ut-surface px-4 py-4 text-ut-text no-underline shadow-ut hover:text-ut-text hover:shadow-md"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ut-primary-soft text-ut-primary">{it.icon}</span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-base font-bold">{it.title}</span>
                <span className="text-[13px] text-ut-text-muted">{it.text}</span>
              </span>
              <IconArrowRight size={20} className="text-ut-primary" />
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
