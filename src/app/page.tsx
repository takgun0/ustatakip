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
    <main className="ut-glow flex min-h-dvh flex-col items-center px-4 py-12 text-ut-text">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <header className="flex items-center gap-3.5">
          <BrandMark tone="onLight" size={52} />
          <div className="flex flex-col gap-0.5">
            <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.03em] text-ut-text">UstaTakip</h1>
            <p className="m-0 text-[15px] text-ut-text-muted">Esnaf için kargo takibi mantığında iş takibi</p>
          </div>
        </header>
        <nav className="flex flex-col gap-3" aria-label="Ana menü">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-3 rounded-ut-lg border border-ut-border/80 bg-ut-surface px-4 py-4 text-ut-text no-underline shadow-ut transition duration-200 hover:-translate-y-0.5 hover:border-ut-primary/30 hover:text-ut-text hover:shadow-ut-lg"
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
