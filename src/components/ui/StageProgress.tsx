import { cn } from "@/lib/cn";
import { IconCheck } from "./icons";

/**
 * StageProgress — "Biten aşama yeşil + onay işareti, aktif aşama amber halka, sıradakiler gri çerçeve.
 * Mini sürüm (kartlarda): 6 px yüksek segment çubuğu." Aşamalar esnaftan gelir (2–12).
 *
 * 5'ten fazla aşamada dar kartta (42rem altı, kapsayıcı sorgusu) adlar birbirine biniyordu ("Geliştirme", "Değerlendirme"):
 * orada yalnızca aktif aşamanın adı yazılır, diğerleri ekran okuyucuda kalır; altta sıradaki aşama belirtilir.
 */
export type StageItem = { id: string; name: string };

type Props = {
  stages: StageItem[];
  /** 0 tabanlı aktif aşama sırası */
  activeIndex: number;
  /** Son aşamaya gelinmiş ya da iş teslim edilmişse tüm segmentler yeşil */
  finished?: boolean;
  className?: string;
};

export function StageProgress({ stages, activeIndex, className }: Props) {
  const dense = stages.length > 5;
  const next = stages[activeIndex + 1];
  const list = (
    <ol className={cn("m-0 flex list-none items-start p-0", !dense && className)} aria-label="İş aşamaları">
      {stages.map((s, i) => {
        const done = i < activeIndex;
        const act = i === activeIndex;
        return (
          <li
            key={s.id}
            className="relative flex min-w-0 flex-1 basis-0 flex-col items-center gap-2"
            aria-current={act ? "step" : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn("absolute top-[11px] -left-1/2 h-[3px] w-full", i <= activeIndex ? "bg-ut-success" : "bg-ut-border")}
              />
            )}
            <span
              className={cn(
                // z-10: sonraki aşamanın bağlantı çizgisi DOM'da sonra geldiği için daireyi örtmesin
                "relative z-10 box-border flex size-6 items-center justify-center rounded-full text-white",
                done && "bg-ut-success",
                act && "bg-ut-accent shadow-[0_0_0_4px_rgba(245,158,11,.25)]",
                !done && !act && "border-2 border-ut-border bg-white",
              )}
            >
              {done && <IconCheck size={14} strokeWidth={3} />}
              {act && <span className="size-2 rounded-full bg-ut-text" />}
            </span>
            <span
              className={cn(
                "px-px text-center text-[11.5px] leading-tight",
                dense && (act ? "@max-2xl:w-max" : "@max-2xl:sr-only"),
                i <= activeIndex ? "text-ut-text" : "text-ut-text-muted",
                act ? "font-bold" : "font-medium",
              )}
            >
              {s.name}
              <span className="sr-only">{done ? " (tamamlandı)" : act ? " (aktif aşama)" : " (sırada)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
  if (!dense) return list;
  return (
    <div className={cn("@container flex flex-col gap-2", className)}>
      {list}
      {next && (
        <p className="m-0 text-[13px] text-ut-text-muted @2xl:hidden" aria-hidden="true">
          Sıradaki aşama: <span className="font-semibold text-ut-text">{next.name}</span>
        </p>
      )}
    </div>
  );
}

export function StageProgressMini({ stages, activeIndex, finished, className }: Props) {
  return (
    <div className={cn("flex gap-1", className)} aria-hidden="true">
      {stages.map((s, i) => (
        <span
          key={s.id}
          className={cn(
            "h-1.5 flex-1 rounded-[3px]",
            i < activeIndex || (i === activeIndex && finished)
              ? "bg-ut-success"
              : i === activeIndex
                ? "bg-ut-accent"
                : "bg-ut-border",
          )}
        />
      ))}
    </div>
  );
}
