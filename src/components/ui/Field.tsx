import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Form alanı kenarı --ut-text-muted (palet notu: "Form alanı kenarı: --ut-text-muted"). */
const fieldBase =
  "box-border w-full rounded-ut border border-ut-text-muted bg-ut-surface text-[15px] text-ut-text placeholder:text-ut-text-muted aria-[invalid=true]:border-ut-danger";

export function Label({ htmlFor, children, optional, className }: { htmlFor: string; children: ReactNode; optional?: boolean | string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-semibold", className)}>
      {children}
      {optional && (
        <span className="font-normal text-ut-text-muted"> ({typeof optional === "string" ? optional : "isteğe bağlı"})</span>
      )}
    </label>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} className="text-[13px] text-ut-text-muted">
      {children}
    </span>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <span id={id} role="alert" className="text-[13px] font-semibold text-ut-danger">
      {children}
    </span>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-12 px-3.5", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(fieldBase, "resize-y px-3.5 py-3 leading-[1.45]", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, "h-12 px-3", className)} {...rest}>
      {children}
    </select>
  );
});

/** CounterOfferForm'daki tutar alanı: 52 px, büyük rakam, sağda ₺ */
export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function MoneyInput(
  { className, ...rest },
  ref,
) {
  return (
    <div className={cn("box-border flex h-[52px] items-center rounded-ut border border-ut-text-muted bg-ut-surface px-3.5 has-[[aria-invalid=true]]:border-ut-danger", className)}>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className="min-w-0 flex-1 border-0 bg-transparent text-xl font-semibold text-ut-text tabular-nums outline-none placeholder:text-ut-text-muted"
        {...rest}
      />
      <span className="text-lg font-bold text-ut-text-muted" aria-hidden="true">₺</span>
    </div>
  );
});

/** Etiket + alan + ipucu/hata dikey yığını */
export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}
