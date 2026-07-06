import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-neutral hover:bg-secondary focus-visible:ring-primary",
  secondary:
    "bg-transparent text-primary border border-primary hover:bg-primary/10 focus-visible:ring-primary",
  tertiary:
    "bg-tertiary text-neutral hover:opacity-90 focus-visible:ring-tertiary",
  ghost:
    "bg-transparent text-on-surface-muted hover:bg-border-custom/50 hover:text-on-surface",
  danger: "bg-error text-neutral hover:opacity-90 focus-visible:ring-error",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-label-md rounded-md gap-1.5",
  md: "px-6 py-3 text-label-lg rounded-lg gap-2",
  lg: "px-8 py-4 text-label-lg rounded-lg gap-2.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  isLoading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
