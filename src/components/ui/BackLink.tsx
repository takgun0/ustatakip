import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowLeft } from "./icons";

/** Sayfa başı geri bağlantısı (design/E4: "← Aktif işler"). En az 44 px dokunma alanı. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold no-underline">
      <IconArrowLeft size={18} />
      {children}
    </Link>
  );
}

/** Mobil başlıktaki ikon geri düğmesi (design/M3 başlığı). Görünür metin yok; adı aria-label'dan gelir. */
export function BackIconLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-ut text-ut-text hover:bg-ut-primary-soft hover:text-ut-text"
    >
      <IconArrowLeft size={22} />
    </Link>
  );
}
