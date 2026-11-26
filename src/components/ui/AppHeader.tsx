"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { ButtonLink } from "./Button";
import { IconChart, IconLayers, IconLogOut, IconPlus, IconSettings, IconWrench } from "./icons";

const NAV = [
  { href: "/panel/", label: "Aktif işler", icon: IconWrench },
  { href: "/panel/surecler/", label: "Süreçler", icon: IconLayers },
  { href: "/panel/analiz/", label: "Analiz", icon: IconChart },
  { href: "/panel/ayarlar/", label: "Ayarlar", icon: IconSettings },
];

/** Esnaf üst barı (design/E2, E4): --ut-primary zemin, 1200 px kapsayıcı. */
export function AppHeader({
  businessName,
  initialsText,
  onSignOut,
  showNewJob = true,
}: {
  businessName: string;
  initialsText: string;
  onSignOut: () => void;
  showNewJob?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <header className="bg-ut-primary text-white">
      <div className="mx-auto box-border flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
        <Link href="/panel/" className="flex items-center gap-2.5 text-white no-underline hover:text-white">
          <BrandMark />
          <span className="text-lg font-bold tracking-[-0.01em]">UstaTakip</span>
        </Link>
        <span aria-hidden="true" className="h-6 w-px bg-white/25" />
        <span className="text-[15px] font-semibold">{businessName}</span>
        <span className="flex-1" />
        {showNewJob && (
          <ButtonLink href="/panel/is/yeni/" variant="accent" icon={<IconPlus size={18} />}>
            Yeni İş
          </ButtonLink>
        )}
        <div
          ref={wrapRef}
          className="relative"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <button
            type="button"
            aria-label="Hesap menüsü"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
            className="size-11 rounded-full border-0 bg-white/15 text-sm font-bold text-white hover:bg-white/25"
          >
            {initialsText}
          </button>
          {open && (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 z-20 mt-2 flex w-56 flex-col overflow-hidden rounded-ut border border-ut-border bg-ut-surface py-1 text-ut-text shadow-ut"
            >
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  role="menuitem"
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 px-4 text-[15px] font-semibold text-ut-text no-underline hover:bg-ut-primary-soft hover:text-ut-text",
                    pathname === href && "bg-ut-primary-soft",
                  )}
                >
                  <Icon size={18} className="text-ut-primary" />
                  {label}
                </Link>
              ))}
              <span className="my-1 h-px bg-ut-border" aria-hidden="true" />
              <button
                type="button"
                role="menuitem"
                onClick={onSignOut}
                className="flex min-h-11 items-center gap-2.5 border-0 bg-transparent px-4 text-left text-[15px] font-semibold text-ut-danger hover:bg-ut-danger-tint"
              >
                <IconLogOut size={18} />
                Çıkış yap
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** Oturum yüklenirken üst bar iskeleti */
export function AppHeaderSkeleton() {
  return (
    <header className="bg-ut-primary text-white" aria-hidden="true">
      <div className="mx-auto box-border flex max-w-[1200px] items-center gap-4 px-6 py-3">
        <BrandMark />
        <span className="text-lg font-bold">UstaTakip</span>
        <span className="flex-1" />
        <span className="size-11 rounded-full bg-white/15" />
      </div>
    </header>
  );
}
