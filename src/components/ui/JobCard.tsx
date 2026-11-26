import Link from "next/link";
import { cn } from "@/lib/cn";
import { StageProgressMini, type StageItem } from "./StageProgress";
import { StatusBadge } from "./StatusBadge";
import { formatCode } from "@/lib/tracking";

/** JobCard — esnaf panelindeki iş kartı (design/E2.dc.html). */
export type JobCardProps = {
  href: string;
  customerName: string;
  itemLabel?: string | null;
  title: string;
  trackingCode: string;
  stages: StageItem[];
  activeIndex: number;
  delivered?: boolean;
  /** waiting: yanıt bekleyen teklif · counter: karşı teklif geldi */
  flag?: "waiting" | "counter" | null;
  offerAmountText?: string;
  dueText?: string;
  updatedText?: string;
};

export function JobCard(p: JobCardProps) {
  const last = p.delivered || p.activeIndex === p.stages.length - 1;
  const stageName = p.stages[p.activeIndex]?.name ?? "—";
  return (
    <Link
      href={p.href}
      className={cn(
        "flex flex-col gap-3 rounded-ut-lg bg-ut-surface p-4 text-ut-text no-underline shadow-ut transition duration-200 hover:-translate-y-0.5 hover:border-ut-primary/30 hover:text-ut-text hover:shadow-ut-lg",
        p.flag === "counter"
          ? "border-[1.5px] border-ut-info"
          : "border border-ut-border/80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-bold">{p.customerName}</span>
          <span className="truncate text-sm text-ut-text-muted">
            {p.itemLabel ? `${p.itemLabel} · ${p.title}` : p.title}
          </span>
        </div>
        <span className="shrink-0 rounded-md bg-ut-bg px-2 py-1 font-mono text-xs font-semibold whitespace-nowrap text-ut-text-muted">
          {formatCode(p.trackingCode)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={last ? "success" : "active"} size="sm">
          {p.delivered ? "Teslim edildi" : stageName}
        </StatusBadge>
        <span className="text-[13px] text-ut-text-muted">
          Aşama {Math.min(p.activeIndex + 1, p.stages.length)} /{" "}
          {p.stages.length}
        </span>
      </div>
      <StageProgressMini
        stages={p.stages}
        activeIndex={p.activeIndex}
        finished={last}
      />
      {p.flag === "waiting" && (
        <StatusBadge tone="warning" size="sm" className="self-start">
          Yanıt bekleyen teklif
          {p.offerAmountText ? ` · ${p.offerAmountText}` : ""}
        </StatusBadge>
      )}
      {p.flag === "counter" && (
        <StatusBadge tone="info" size="sm" className="self-start">
          Karşı teklif geldi{p.offerAmountText ? ` · ${p.offerAmountText}` : ""}
        </StatusBadge>
      )}
      <div className="mt-auto flex justify-between gap-2 border-t border-ut-border pt-2.5 text-[13px] text-ut-text-muted">
        <span>{p.dueText ? `Teslim: ${p.dueText}` : "Teslim tarihi yok"}</span>
        <span>{p.updatedText}</span>
      </div>
    </Link>
  );
}

export function JobCardSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 rounded-ut border border-ut-border bg-ut-surface p-4 shadow-ut"
      aria-hidden="true"
    >
      <div className="flex justify-between gap-2">
        <div className="flex flex-col gap-2">
          <span className="ut-skeleton block h-4 w-32" />
          <span className="ut-skeleton block h-3.5 w-48" />
        </div>
        <span className="ut-skeleton block h-6 w-20" />
      </div>
      <span className="ut-skeleton block h-[26px] w-36 rounded-full" />
      <span className="ut-skeleton block h-1.5 w-full" />
      <span className="ut-skeleton mt-2 block h-3.5 w-full" />
    </div>
  );
}
