import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Button — design/Main.dc.html "Button" bileşeni.
 * Yükseklik 44 px, köşe 12 px, 15/600.
 *  primary   · ana karar (Onayla, Kabul Et)
 *  accent    · yeni kayıt, gönder (Yeni İş, Karşı Teklif Gönder)
 *  secondary · alternatif yol (Pazarlık Yap, Linki kopyala)
 *  danger    · reddetme
 *  ghost     · Vazgeç, Geri al
 *  whatsapp  · WhatsApp ile mesaj / paylaşım (koyu yeşil dolgu)
 */
export type ButtonVariant =
  "primary" | "accent" | "secondary" | "danger" | "ghost" | "whatsapp";
export type ButtonSize = "md" | "lg" | "xl" | "2xl";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border-0 bg-ut-primary text-white shadow-[0_1px_2px_rgba(15,23,42,.10),inset_0_1px_0_rgba(255,255,255,.14)] hover:bg-ut-primary-hover hover:text-white",
  accent:
    "border-0 bg-ut-accent text-ut-text shadow-[0_1px_2px_rgba(15,23,42,.10)] hover:brightness-105",
  secondary:
    "border border-ut-border bg-ut-surface text-ut-primary shadow-[0_1px_2px_rgba(15,23,42,.05)] hover:border-ut-primary/30 hover:bg-ut-primary-soft",
  danger:
    "border border-ut-danger bg-ut-surface text-ut-danger hover:bg-ut-danger-tint",
  ghost: "border-0 bg-transparent text-ut-primary hover:bg-ut-primary-soft",
  whatsapp:
    "border-0 bg-ut-whatsapp text-white shadow-[0_1px_2px_rgba(15,23,42,.10),inset_0_1px_0_rgba(255,255,255,.14)] hover:text-white hover:brightness-110",
};

const sizeClass: Record<ButtonSize, string> = {
  md: "h-11 text-[15px]",
  lg: "h-12 text-[15px]",
  xl: "h-[52px] text-base",
  "2xl": "h-14 text-base",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-ut font-semibold no-underline transition duration-150 active:translate-y-px",
    variant === "ghost" ? "px-3.5" : "px-[18px]",
    "disabled:cursor-not-allowed disabled:border-0 disabled:bg-ut-border disabled:text-ut-text-muted disabled:shadow-none disabled:brightness-100 disabled:active:translate-y-0",
    variantClass[variant],
    sizeClass[size],
    extra,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  block?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  loadingText = "Gönderiliyor…",
  block,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, cn(block && "w-full", className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        loadingText
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  block?: boolean;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  block,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClass(variant, size, cn(block && "w-full", className))}
      {...rest}
    >
      {icon}
      {children}
    </Link>
  );
}
