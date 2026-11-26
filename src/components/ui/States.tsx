import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { IconAlert, IconCheck, IconInfo, IconRefresh, IconSwap, IconX } from "./icons";

/**
 * Boş, yükleniyor ve hata durumları. Tasarımdaki iki kalıbın üzerine kurulu:
 *  - E2 "Bu filtrede iş yok": kesikli kenarlı beyaz kutu, ortalanmış metin + ikincil buton
 *  - M3/E4 sonuç kutuları (role=status): %10–12 renk tonu + dolu yuvarlak ikon
 */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2.5 rounded-ut border border-dashed border-ut-border bg-ut-surface px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-ut-primary-soft text-ut-primary" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="text-base font-semibold">{title}</span>
      {description && <p className="m-0 max-w-md text-sm leading-normal text-ut-text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Bir şeyler ters gitti",
  description = "Bağlantınızı kontrol edip yeniden deneyin.",
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-3 rounded-ut bg-ut-danger-tint p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ut-danger text-white" aria-hidden="true">
          <IconAlert size={18} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-bold">{title}</span>
          <span className="text-sm leading-normal">{description}</span>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} icon={<IconRefresh size={18} />}>
          Yeniden dene
        </Button>
      )}
    </div>
  );
}

export type NoticeTone = "success" | "danger" | "info" | "warning" | "neutral";

const noticeTone: Record<NoticeTone, { wrap: string; dot: string; icon: ReactNode }> = {
  success: { wrap: "bg-ut-success-tint", dot: "bg-ut-success text-white", icon: <IconCheck size={18} strokeWidth={2.6} /> },
  danger: { wrap: "bg-ut-danger-tint", dot: "bg-ut-danger text-white", icon: <IconX size={18} strokeWidth={2.6} /> },
  info: { wrap: "bg-ut-info-tint", dot: "bg-ut-info text-white", icon: <IconSwap size={18} /> },
  warning: { wrap: "bg-ut-warning-tint", dot: "bg-ut-warning text-white", icon: <IconAlert size={18} /> },
  neutral: { wrap: "bg-ut-primary-soft", dot: "bg-ut-primary text-white", icon: <IconInfo size={18} /> },
};

/** Sonuç/bilgi kutusu (role=status) */
export function Notice({
  tone,
  title,
  children,
  action,
  icon,
  className,
}: {
  tone: NoticeTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const t = noticeTone[tone];
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-ut p-4", t.wrap, className)}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", t.dot)} aria-hidden="true">
        {icon ?? t.icon}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        {title && <span className="text-[15px] font-bold">{title}</span>}
        {children && <div className="text-sm leading-normal">{children}</div>}
        {action}
      </div>
    </div>
  );
}

/** Bilgi kutusu: --ut-primary-soft zemin, primary ikon, 13 px metin (CounterOfferForm notu) */
export function InfoBox({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-ut bg-ut-primary-soft px-3.5 py-3 text-[13px] leading-normal", className)}>
      <IconInfo size={18} className="mt-px shrink-0 text-ut-primary" />
      <span>{children}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("ut-skeleton block", className)} aria-hidden="true" />;
}

/** Ekran okuyucular için yükleniyor duyurusu + görsel iskelet sarmalayıcı */
export function LoadingRegion({ label = "Yükleniyor…", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
