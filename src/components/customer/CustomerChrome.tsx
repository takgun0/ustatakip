import type { ReactNode } from "react";

/** Başlıktaki geri düğmesinin hedefi ve ekran okuyucu adı */
type Back = { href: string; label: string };
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";
import { formatCode } from "@/lib/tracking";
import { waMeLink } from "@/lib/notifications";
import type { ApiError } from "@/lib/customer-api";
import type { CustomerView } from "@/lib/customer-view";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BrandMark } from "@/components/ui/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BackIconLink } from "@/components/ui/BackLink";
import { ErrorState, LoadingRegion, Skeleton } from "@/components/ui/States";
import { IconPhone, IconSearch, IconWhatsApp } from "@/components/ui/icons";

/** Müşteri ekranlarının mobil çerçevesi (design/M2: 390 px genişlik, --ut-bg zemin) */
export function CustomerFrame({
  header,
  children,
  footer,
}: {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto box-border flex min-h-dvh max-w-[480px] flex-col bg-ut-bg">
      {header}
      <main className="flex flex-col gap-3 p-4">{children}</main>
      {footer}
    </div>
  );
}

/** M2 başlığı: işletme logosu (yoksa baş harfler), adı ve kısa tanıtımı */
export function BusinessHeader({
  business,
  back,
}: {
  business: CustomerView["business"];
  back?: Back;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 border-b border-ut-border/80 bg-ut-surface/85 py-4 pr-3 backdrop-blur-md",
        back ? "pl-2" : "pl-5",
      )}
    >
      {back && <BackIconLink href={back.href} label={back.label} />}
      {business.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- statik dışa aktarımda görsel optimizasyonu yok
        <img
          src={business.logoUrl}
          alt={`${business.name} logosu`}
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-ut object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`${business.name} logosu`}
          className="flex size-12 shrink-0 items-center justify-center rounded-ut bg-linear-to-br from-[#6366F1] to-[#4338CA] text-[17px] font-bold tracking-[0.02em] text-white shadow-[0_4px_12px_-2px_rgba(79,70,229,.4)]"
        >
          {initials(business.name)}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[17px] font-bold">{business.name}</span>
        {business.tagline && (
          <span className="truncate text-[13px] text-ut-text-muted">
            {business.tagline}
          </span>
        )}
      </div>
      <ThemeToggle />
    </header>
  );
}

export function PlainHeader({ back }: { back?: Back } = {}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 border-b border-ut-border/80 bg-ut-surface/85 py-4 pr-3 backdrop-blur-md",
        back ? "pl-2" : "pl-5",
      )}
    >
      {back && <BackIconLink href={back.href} label={back.label} />}
      <BrandMark tone="onLight" size={40} />
      <span className="text-[17px] font-extrabold tracking-[-0.02em]">
        UstaTakip
      </span>
      <span className="flex-1" />
      <ThemeToggle />
    </header>
  );
}

/** Alt sabit çubuk: Ara + WhatsApp (design/M2) */
export function ContactBar({
  business,
  code,
}: {
  business: CustomerView["business"];
  code: string;
}) {
  if (!business.phone) return null;
  const text = `Merhaba, ${formatCode(code)} takip kodlu işim hakkında bilgi almak istiyorum.`;
  return (
    <div className="sticky bottom-0 mt-auto flex gap-2.5 border-t border-ut-border/80 bg-ut-surface/90 px-4 pt-3 pb-5 backdrop-blur-md">
      <a
        href={`tel:${business.phone}`}
        className={buttonClass("primary", "xl", "flex-1")}
      >
        <IconPhone size={20} />
        Ara
      </a>
      <a
        href={waMeLink(text, business.phone)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("whatsapp", "xl", "flex-1")}
      >
        <IconWhatsApp size={20} />
        WhatsApp
      </a>
    </div>
  );
}

export function TrackingSkeleton() {
  return (
    <CustomerFrame
      header={
        <div className="flex items-center gap-3 border-b border-ut-border bg-ut-surface px-5 py-4">
          <Skeleton className="size-12 rounded-ut" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      }
    >
      <LoadingRegion
        label="Takip bilgileri yükleniyor…"
        className="flex flex-col gap-3"
      >
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-14 w-full rounded-ut" />
        </Card>
        <Card className="flex flex-col gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
        </Card>
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </Card>
      </LoadingRegion>
    </CustomerFrame>
  );
}

/** Token eksik/geçersiz/süresi dolmuş ya da bağlantı hatası */
export function TrackingProblem({
  error,
  onRetry,
}: {
  error: ApiError | null;
  onRetry: () => void;
}) {
  const terminal = !error || error.status === 404 || error.status === 410;
  const title = !error
    ? "Takip bağlantısı eksik"
    : error.status === 404
      ? "Takip bağlantısı geçersiz"
      : error.status === 410
        ? error.code === "cancelled"
          ? "Bu iş kapatıldı"
          : "Takip süresi doldu"
        : "Takip bilgisi alınamadı";
  const text = !error
    ? "Bağlantının tamamını açtığınızdan emin olun ya da takip kodunuzla sorgulayın."
    : error.message;
  return (
    <CustomerFrame
      header={
        <PlainHeader
          back={{ href: "/takip/", label: "Takip sorgulamaya dön" }}
        />
      }
    >
      {terminal ? (
        <div className="flex flex-col items-center gap-3 rounded-ut border border-dashed border-ut-border bg-ut-surface px-6 py-10 text-center">
          <span
            className="flex size-12 items-center justify-center rounded-full bg-ut-primary-soft text-ut-primary"
            aria-hidden="true"
          >
            <IconSearch size={22} />
          </span>
          <h1 className="m-0 text-lg font-bold">{title}</h1>
          <p className="m-0 max-w-sm text-sm leading-normal text-ut-text-muted">
            {text}
          </p>
          <ButtonLink href="/takip/" variant="primary" size="lg">
            Takip koduyla sorgula
          </ButtonLink>
        </div>
      ) : (
        <ErrorState title={title} description={text} onRetry={onRetry} />
      )}
    </CustomerFrame>
  );
}
