"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { ButtonLink } from "./Button";
import {
  IconChart,
  IconLayers,
  IconLogOut,
  IconPlus,
  IconSettings,
  IconWrench,
} from "./icons";

const NAV = [
  { href: "/panel/", label: "Aktif işler", icon: IconWrench },
  { href: "/panel/surecler/", label: "Süreçler", icon: IconLayers },
  { href: "/panel/analiz/", label: "Analiz", icon: IconChart },
  { href: "/panel/ayarlar/", label: "Ayarlar", icon: IconSettings },
];

/** Esnaf üst barı: yarı saydam beyaz, bulanık arka plan, yapışkan; geniş ekranda sekmeler görünür. 1200 px kapsayıcı. */
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
    <header className="sticky top-0 z-30 border-b border-ut-border/80 bg-white/80 text-ut-text backdrop-blur-md">
      <div className="mx-auto box-border flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
        <Link
          href="/panel/"
          className="flex items-center gap-2.5 text-ut-text no-underline hover:text-ut-text"
        >
          <BrandMark tone="onLight" />
          <span className="text-lg font-extrabold tracking-[-0.02em]">
            UstaTakip
          </span>
        </Link>
        <span aria-hidden="true" className="h-6 w-px bg-ut-border" />
        <span className="text-[15px] font-semibold text-ut-text-muted">
          {businessName}
        </span>
        <nav
          aria-label="Panel"
          className="ml-2 hidden items-center gap-1 lg:flex"
        >
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold no-underline transition",
                  active
                    ? "bg-ut-primary-soft text-ut-primary hover:text-ut-primary"
                    : "text-ut-text-muted hover:bg-ut-bg hover:text-ut-text",
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
        <span className="flex-1" />
        {showNewJob && (
          <ButtonLink href="/panel/is/yeni/" icon={<IconPlus size={18} />}>
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
            className="size-11 cursor-pointer rounded-full border-0 bg-ut-primary-soft text-sm font-bold text-ut-primary transition hover:bg-ut-primary hover:text-white"
          >
            {initialsText}
          </button>
          {open && (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 z-20 mt-2 flex w-56 flex-col overflow-hidden rounded-ut-lg border border-ut-border bg-ut-surface p-1 text-ut-text shadow-ut-lg"
            >
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  role="menuitem"
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-ut px-3 text-[15px] font-semibold text-ut-text no-underline hover:bg-ut-primary-soft hover:text-ut-text",
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
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-ut border-0 bg-transparent px-3 text-left text-[15px] font-semibold text-ut-danger hover:bg-ut-danger-tint"
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
    <header
      className="border-b border-ut-border/80 bg-white/80 text-ut-text"
      aria-hidden="true"
    >
      <div className="mx-auto box-border flex max-w-[1200px] items-center gap-4 px-6 py-3">
        <BrandMark tone="onLight" />
        <span className="text-lg font-extrabold tracking-[-0.02em]">
          UstaTakip
        </span>
        <span className="flex-1" />
        <span className="size-11 rounded-full bg-ut-primary-soft" />
      </div>
    </header>
  );
}
