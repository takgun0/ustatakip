"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { stageColor } from "@/lib/theme";
import { STAGE_COLORS } from "@/lib/validation";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/Field";
import { IconCheck, IconGrip, IconPlus, IconTrash } from "@/components/ui/icons";

export type DraftStage = { key: string; id: string | null; name: string; color: string };

/** Paletteki renklerin ekran okuyucu adları (design/tokens: primary, info, accent, warning, success, danger, muted) */
export const COLOR_NAMES: Record<(typeof STAGE_COLORS)[number], string> = {
  "#1E3A5F": "Lacivert",
  "#2563EB": "Mavi",
  "#F59E0B": "Amber",
  "#D97706": "Koyu amber",
  "#16A34A": "Yeşil",
  "#DC2626": "Kırmızı",
  "#6B7280": "Gri",
};

export const MAX_STAGES = 12;
export const MIN_STAGES = 2;

type Props = {
  stages: DraftStage[];
  onChange: (next: DraftStage[]) => void;
  /** İş kaydında geçen (silinemeyen) aşama kimlikleri */
  usedIds: ReadonlySet<string>;
  errors: Record<string, string>;
  onAdd: () => void;
};

/**
 * E5 aşama listesi: tutamaçtan sürükle-bırak (fare, dokunma ve klavye: Boşluk ile tut, oklarla taşı),
 * ad, renk ve silme. Kullanılan aşamalar silinemez; adı ve sırası değişebilir.
 */
export function StageListEditor({ stages, onChange, usedIds, errors, onAdd }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nameOf = (key: string | number) => {
    const i = stages.findIndex((s) => s.key === key);
    return { i, name: stages[i]?.name || "Adsız aşama" };
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const a = nameOf(active.id);
      return `${a.name} tutuldu. Sıra ${a.i + 1} / ${stages.length}.`;
    },
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id).name}, ${nameOf(over.id).i + 1}. sıraya taşınıyor.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id).name} ${nameOf(over.id).i + 1}. sıraya bırakıldı.` : `${nameOf(active.id).name} bırakıldı.`),
    onDragCancel: ({ active }) => `Taşıma iptal edildi. ${nameOf(active.id).name} yerinde kaldı.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = stages.findIndex((s) => s.key === active.id);
    const to = stages.findIndex((s) => s.key === over.id);
    onChange(arrayMove(stages, from, to));
  }

  const update = (key: string, patch: Partial<DraftStage>) => onChange(stages.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const remove = (key: string) => onChange(stages.filter((s) => s.key !== key));

  return (
    <div className="flex flex-col gap-2.5">
      <DndContext
        id="stage-list"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: "Taşımak için Boşluk tuşuna basın, yukarı ve aşağı oklarla yer değiştirin, bırakmak için yeniden Boşluk, iptal için Escape.",
          },
        }}
      >
        <SortableContext items={stages.map((s) => s.key)} strategy={verticalListSortingStrategy}>
          <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Aşamalar">
            {stages.map((s, i) => (
              <StageRow
                key={s.key}
                stage={s}
                index={i}
                used={!!s.id && usedIds.has(s.id)}
                canRemove={stages.length > MIN_STAGES}
                error={errors[`stages.${i}.name`] ?? errors[`stages.${i}.color`]}
                onUpdate={(patch) => update(s.key, patch)}
                onRemove={() => remove(s.key)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={onAdd}
        disabled={stages.length >= MAX_STAGES}
        className="flex h-12 items-center justify-center gap-2 rounded-ut border-[1.5px] border-dashed border-ut-text-muted bg-transparent text-[15px] font-semibold text-ut-primary hover:bg-ut-primary-soft disabled:cursor-not-allowed disabled:text-ut-text-muted disabled:hover:bg-transparent"
      >
        <IconPlus size={18} />
        {stages.length >= MAX_STAGES ? `En fazla ${MAX_STAGES} aşama` : "Aşama ekle"}
      </button>
    </div>
  );
}

function StageRow({
  stage,
  index,
  used,
  canRemove,
  error,
  onUpdate,
  onRemove,
}: {
  stage: DraftStage;
  index: number;
  used: boolean;
  canRemove: boolean;
  error?: string;
  onUpdate: (patch: Partial<DraftStage>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: stage.key });
  const [colorOpen, setColorOpen] = useState(false);
  const inputId = `stage-${stage.key}`;
  const label = stage.name || `${index + 1}. aşama`;
  const colorName = COLOR_NAMES[stage.color as keyof typeof COLOR_NAMES] ?? stage.color;
  const removeHint = used ? "İş kaydında geçtiği için silinemez" : !canRemove ? `En az ${MIN_STAGES} aşama olmalı` : undefined;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-col gap-2 rounded-ut border border-ut-border bg-ut-surface p-2",
        isDragging && "relative z-10 border-ut-primary shadow-ut",
      )}
    >
      <div className="flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`${label} aşamasını taşı`}
          className="flex h-11 w-8 shrink-0 cursor-grab touch-none sm:w-11 items-center justify-center rounded-ut border-0 bg-transparent text-ut-text-muted hover:bg-ut-bg active:cursor-grabbing"
        >
          <IconGrip size={20} />
        </button>
        <span className="hidden w-5 shrink-0 text-center text-sm font-bold text-ut-text-muted tabular-nums sm:block" aria-hidden="true">
          {index + 1}
        </span>
        <label htmlFor={inputId} className="sr-only">
          {index + 1}. aşamanın adı
        </label>
        <Input
          id={inputId}
          value={stage.name}
          maxLength={40}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Aşama adı"
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-err` : used ? `${inputId}-used` : undefined}
          className="h-11 min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => setColorOpen((v) => !v)}
          aria-expanded={colorOpen}
          aria-controls={`${inputId}-colors`}
          aria-label={`${label} rengi: ${colorName}. Değiştir`}
          className="flex size-11 shrink-0 items-center justify-center rounded-ut border border-ut-border bg-ut-surface hover:bg-ut-bg"
        >
          <span className="size-5 rounded-full" style={{ background: stageColor(stage.color) }} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={used || !canRemove}
          title={removeHint}
          aria-label={removeHint ? `${label} silinemez: ${removeHint}` : `${label} aşamasını sil`}
          className="flex size-11 shrink-0 items-center justify-center rounded-ut border-0 bg-transparent text-ut-danger hover:bg-ut-danger-tint disabled:cursor-not-allowed disabled:text-ut-border disabled:hover:bg-transparent"
        >
          <IconTrash size={18} />
        </button>
      </div>

      {colorOpen && (
        <div id={`${inputId}-colors`} role="radiogroup" aria-label={`${label} rengi`} className="flex flex-wrap gap-2 pb-1 pl-9 sm:pl-[68px]">
          {STAGE_COLORS.map((c) => {
            const on = stage.color === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={COLOR_NAMES[c]}
                onClick={() => {
                  onUpdate({ color: c });
                  setColorOpen(false);
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 text-white",
                  on ? "border-ut-text" : "border-transparent",
                )}
                style={{ background: stageColor(c) }}
              >
                {on && <IconCheck size={16} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}

      {(used || error) && (
        <div className="flex flex-col gap-0.5 pl-9 sm:pl-[68px] text-[13px]">
          {used && !error && (
            <span id={`${inputId}-used`} className="text-ut-text-muted">
              İşlerde kullanıldı · silinemez
            </span>
          )}
          {error && (
            <span id={`${inputId}-err`} role="alert" className="font-semibold text-ut-danger">
              {error}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
