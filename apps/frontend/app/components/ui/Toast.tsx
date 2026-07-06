import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "border-l-4 border-l-success bg-surface",
  error: "border-l-4 border-l-error bg-surface",
  warning: "border-l-4 border-l-warning bg-surface",
  info: "border-l-4 border-l-info bg-surface",
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-success flex-shrink-0" />,
  error: <AlertCircle size={18} className="text-error flex-shrink-0" />,
  warning: <AlertTriangle size={18} className="text-warning flex-shrink-0" />,
  info: <Info size={18} className="text-info flex-shrink-0" />,
};

export function Toast({ message, variant = "info", onDismiss }: ToastProps) {
  return (
    <output
      role="status"
      className={`toast-enter flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg min-w-72 max-w-96 ${variantStyles[variant]}`}
    >
      {variantIcons[variant]}
      <p className="text-body-sm text-on-surface flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-on-surface-muted hover:text-on-surface transition-colors flex-shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </output>
  );
}
