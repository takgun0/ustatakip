"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/cn";
import { formatCode } from "@/lib/tracking";
import { buttonClass, Button } from "./Button";
import { Eyebrow } from "./Card";
import { IconCheck, IconCopy, IconDownload, IconLink, IconPrinter, IconWhatsApp } from "./icons";

/**
 * CodeDisplay — design/Main.dc.html "Kod · link · QR".
 *  card · bileşen kartı (QR 120 px, kod 28 px, 44 px butonlar) — E3 başarı ekranı
 *  wide · E4 "Takip kodu ve paylaşım" şeridi (QR 108 px, kod 30 px, 48 px butonlar)
 */

/** QR modüllerini tek bir SVG path'ine çevirir (21×21 ve üstü) */
export function qrPath(text: string): { size: number; d: string } {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const { size, data } = qr.modules;
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, d };
}

export function QrImage({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, d } = useMemo(() => qrPath(value), [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("block size-full", className)}
    >
      <path d={d} fill="#111827" />
    </svg>
  );
}

type Props = {
  code: string;
  url: string;
  /** Hazır WhatsApp mesajı linki (wa.me) */
  whatsappHref?: string;
  layout?: "card" | "wide";
  /** E3: QR Yazdır · E4: QR indir */
  qrAction?: "print" | "download";
  /** Yazdırma sayfasında QR'ın altında görünür */
  printTitle?: string;
  className?: string;
};

export function CodeDisplay({ code, url, whatsappHref, layout = "card", qrAction = "print", printTitle, className }: Props) {
  const pretty = formatCode(code);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wide = layout === "wide";

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(what: "code" | "link") {
    try {
      await navigator.clipboard.writeText(what === "code" ? pretty : url);
      setCopied(what);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  async function download() {
    const png = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 1024, color: { dark: "#111827", light: "#FFFFFF" } });
    const a = document.createElement("a");
    a.href = png;
    a.download = `${pretty}-qr.png`;
    a.click();
  }

  const btnSize = wide ? "lg" : "md";
  const displayUrl = url.replace(/^https?:\/\//, "");

  return (
    <section
      aria-label="Takip kodu ve paylaşım"
      className={cn(
        "rounded-ut border border-ut-border bg-ut-surface shadow-ut",
        wide ? "flex flex-wrap items-center gap-5 px-5 py-[18px]" : "flex flex-col gap-4 p-6",
        className,
      )}
    >
      <div className={cn("flex items-center gap-5", wide && "contents")}>
        <div
          className={cn(
            "box-border shrink-0 rounded-ut border border-ut-border bg-white",
            wide ? "size-[108px] p-[7px]" : "size-[120px] p-2",
          )}
        >
          <QrImage value={url} label="Takip sayfası QR kodu" />
        </div>
        <div className={cn("flex min-w-0 flex-col gap-1.5", wide && "flex-[1_1_260px]")}>
          <Eyebrow>Takip kodu</Eyebrow>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-mono font-bold tracking-[0.04em] whitespace-nowrap text-ut-primary",
                wide ? "text-[30px]" : "text-[28px]",
              )}
            >
              {pretty}
            </span>
            <button
              type="button"
              onClick={() => copy("code")}
              aria-label="Takip kodunu kopyala"
              className="flex size-11 shrink-0 items-center justify-center rounded-ut text-ut-text-muted hover:bg-ut-primary-soft hover:text-ut-primary"
            >
              {copied === "code" ? <IconCheck size={20} className="text-ut-success" /> : <IconCopy size={20} />}
            </button>
          </div>
          <span className={cn("truncate text-ut-text-muted", wide ? "text-sm" : "text-[13px]")} title={url}>
            {displayUrl}
          </span>
        </div>
      </div>

      <div className={cn("flex flex-wrap gap-2.5", wide && "flex-[1_1_300px] justify-end")}>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("primary", btnSize, cn(wide && "flex-[1_1_auto]"))}
          >
            <IconWhatsApp size={18} />
            WhatsApp&apos;ta Paylaş
          </a>
        )}
        <Button variant="secondary" size={btnSize} onClick={() => copy("link")} icon={copied === "link" ? <IconCheck size={18} /> : <IconLink size={18} />}>
          {copied === "link" ? "Kopyalandı" : "Linki kopyala"}
        </Button>
        {qrAction === "print" ? (
          <Button variant="secondary" size={btnSize} onClick={() => window.print()} icon={<IconPrinter size={18} />}>
            QR Yazdır
          </Button>
        ) : (
          <Button variant="secondary" size={btnSize} onClick={download} icon={<IconDownload size={18} />}>
            QR indir
          </Button>
        )}
      </div>

      <span className="sr-only" aria-live="polite">
        {copied === "code" ? "Takip kodu kopyalandı" : copied === "link" ? "Takip linki kopyalandı" : ""}
      </span>

      {/* Yalnızca yazdırırken görünür: tezgâha/fişe iliştirilecek QR etiketi */}
      <div className="ut-print-only" aria-hidden="true">
        <div className="flex flex-col items-center gap-4 text-center">
          {printTitle && <span className="text-xl font-bold">{printTitle}</span>}
          <div className="size-[70mm]">
            <QrImage value={url} label="" />
          </div>
          <span className="font-mono text-[32px] font-bold tracking-[0.04em]">{pretty}</span>
          <span className="max-w-[120mm] text-base">
            Telefonunuzun kamerasıyla QR kodu okutun ya da takip sayfasında kodu ve telefonunuzun son 4 hanesini girin.
          </span>
        </div>
      </div>
    </section>
  );
}
