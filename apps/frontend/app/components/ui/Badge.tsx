interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "primary";
  className?: string;
}

const variantClasses: Record<string, string> = {
  default: "bg-border-custom text-on-surface-muted",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
  info: "bg-info/15 text-info",
  primary: "bg-primary/15 text-primary",
};

export function Badge({ label, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm font-semibold ${variantClasses[variant]} ${className}`}
    >
      {label}
    </span>
  );
}
