"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { IconX } from "@/components/ui/icons";

type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

type Phase = "starting" | "scanning" | "unsupported" | "denied" | "error";

function detectorCtor(): DetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ?? null;
}

/**
 * Tarayıcıda QR okuma (BarcodeDetector). Desteklenmeyen tarayıcılarda (ör. iOS Safari)
 * telefonun kendi kamera uygulamasını önerir: QR doğrudan takip sayfasını açar.
 */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>(() => (detectorCtor() ? "starting" : "unsupported"));

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const Ctor = detectorCtor();
    if (!Ctor) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const detector = new Ctor({ formats: ["qr_code"] });

    async function tick() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          if (raw) return onResult(raw);
        } catch {
          // kare okunamadı; sonraki karede yeniden denenir
        }
      }
      timer = setTimeout(tick, 250);
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        await video.play().catch(() => undefined);
        setPhase("scanning");
        void tick();
      })
      .catch((err: unknown) => setPhase(err instanceof DOMException && err.name === "NotAllowedError" ? "denied" : "error"));

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  const camera = phase === "starting" || phase === "scanning";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ut-text/70 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        className="flex w-full max-w-[420px] flex-col gap-4 rounded-ut bg-ut-surface p-5 shadow-ut"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="qr-title" className="m-0 text-[17px] font-bold">
            QR Okut
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex size-11 items-center justify-center rounded-ut text-ut-text-muted hover:bg-ut-primary-soft"
          >
            <IconX size={20} />
          </button>
        </div>

        {camera && (
          <>
            <div className="relative aspect-square overflow-hidden rounded-ut bg-ut-text">
              <video ref={videoRef} muted playsInline className="size-full object-cover" aria-label="Kamera görüntüsü" />
              <span className="pointer-events-none absolute inset-[15%] rounded-ut border-[3px] border-ut-accent" aria-hidden="true" />
            </div>
            <p className="m-0 text-center text-sm text-ut-text-muted" aria-live="polite">
              {phase === "starting" ? "Kamera açılıyor…" : "Fişteki QR kodu çerçevenin içine getirin."}
            </p>
          </>
        )}
        {phase === "unsupported" && (
          <Notice tone="neutral" title="Bu tarayıcı QR okuyamıyor">
            Telefonunuzun kamera uygulamasını açıp fişteki QR koda tutun; takip sayfanız doğrudan açılır.
          </Notice>
        )}
        {phase === "denied" && (
          <Notice tone="warning" title="Kamera izni verilmedi">
            Tarayıcı ayarlarından kamera iznini açabilir ya da takip kodunu elle girebilirsiniz.
          </Notice>
        )}
        {phase === "error" && (
          <Notice tone="warning" title="Kamera açılamadı">
            Takip kodunu ve telefonunuzun son 4 hanesini elle girebilirsiniz.
          </Notice>
        )}
        {!camera && (
          <Button variant="secondary" size="lg" block onClick={onClose}>
            Kodu elle gir
          </Button>
        )}
      </div>
    </div>
  );
}
