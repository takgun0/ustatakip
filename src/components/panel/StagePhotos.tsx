"use client";

import { useRef } from "react";
import { ALLOWED_IMAGE_TYPES } from "@/lib/image";
import type { JobMedia } from "@/lib/media";
import { cn } from "@/lib/cn";
import { IconCamera, IconPlus, IconX } from "@/components/ui/icons";

export type PhotoItem = JobMedia & { url?: string };

type Props = {
  stageName: string;
  photos: PhotoItem[];
  /** Yüklenmekte olan fotoğraf sayısı (iskelet kutular) */
  uploading: number;
  onAdd: (files: File[]) => void;
  onDelete?: (photo: PhotoItem) => void;
  /** grid: aktif aşama (design/E4: 96 px karolar + "Fotoğraf ekle" karosu); row: biten aşama (56 px + 44 px düğme) */
  variant: "grid" | "row";
  disabled?: boolean;
};

/** E4 aşama fotoğrafları: küçük resimler, silme ve ekleme. Görseller imzalı URL ile gelir. */
export function StagePhotos({ stageName, photos, uploading, onAdd, onDelete, variant, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const grid = variant === "grid";

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={ALLOWED_IMAGE_TYPES.join(",")}
      multiple
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length) onAdd(files);
      }}
    />
  );

  return (
    <div className={cn(grid ? "grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5" : "flex flex-wrap items-center gap-2")}>
      {photos.map((p, i) => (
        <div key={p.id} className={cn("group relative", grid ? "aspect-square" : "size-14")}>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "block size-full overflow-hidden border border-ut-border bg-ut-primary-soft",
              grid ? "rounded-[10px]" : "rounded-lg",
              !p.url && "pointer-events-none",
            )}
            aria-label={`${stageName} fotoğrafı ${i + 1}: büyük göster`}
          >
            {p.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- imzalı URL, statik dışa aktarım
              <img src={p.url} alt={p.caption ?? ""} loading="lazy" decoding="async" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-ut-text-muted">
                <IconCamera size={16} />
              </span>
            )}
          </a>
          {onDelete && grid && (
            <button
              type="button"
              onClick={() => onDelete(p)}
              disabled={disabled}
              aria-label={`${stageName} fotoğrafı ${i + 1}: sil`}
              className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full border-0 bg-ut-text/70 text-white hover:bg-ut-danger disabled:opacity-50"
            >
              <IconX size={16} />
            </button>
          )}
        </div>
      ))}

      {Array.from({ length: uploading }, (_, i) => (
        <span
          key={`up-${i}`}
          className={cn("ut-skeleton flex items-center justify-center text-ut-text-muted", grid ? "aspect-square rounded-[10px]" : "size-14 rounded-lg")}
          role="status"
          aria-label="Fotoğraf yükleniyor"
        />
      ))}

      {grid ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-ut-primary bg-ut-surface text-[13px] font-semibold text-ut-primary hover:bg-ut-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          <IconCamera size={22} />
          Fotoğraf ekle
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="inline-flex h-11 items-center gap-1.5 rounded-ut border border-dashed border-ut-text-muted bg-transparent px-3 text-sm font-semibold text-ut-primary hover:bg-ut-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          <IconPlus size={16} />
          Fotoğraf ekle
        </button>
      )}
      {picker}
    </div>
  );
}
