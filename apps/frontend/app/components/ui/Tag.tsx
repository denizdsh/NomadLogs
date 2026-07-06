import { X } from "lucide-react";
import { useTheme } from "~/hooks/useTheme";

interface TagProps {
  label: string;
  isActive?: boolean;
  isRemovable?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  variant?: "default" | "content-type" | "location" | "status";
  size?: "sm" | "md";
}

const variantBase: Record<string, string> = {
  default: "border-border-custom text-on-surface-muted",
  "content-type": "border-primary/30 text-primary",
  location: "border-info/30 text-info",
  status: "border-warning/30 text-warning",
};

const variantActive: Record<string, string> = {
  default: "bg-primary text-neutral border-primary",
  "content-type": "bg-primary text-neutral border-primary",
  location: "bg-info text-neutral border-info",
  status: "bg-warning text-neutral border-warning",
};

function getHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function Tag({
  label,
  isActive = false,
  isRemovable = false,
  onToggle,
  onRemove,
  variant = "default",
  size = "md",
}: TagProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-label-sm" : "px-3 py-1 text-label-md";

  const colorClasses = variant === "location"
    ? ""
    : isActive ? variantActive[variant] : variantBase[variant];

  let style: React.CSSProperties | undefined = undefined;
  if (variant === "location") {
    const hash = getHashCode(label);
    const hue = hash % 360;
    style = {
      backgroundColor: isActive
        ? `hsl(${hue}, 45%, ${isDark ? "25%" : "45%"})`
        : `hsl(${hue}, ${isDark ? "15%" : "30%"}, ${isDark ? "12%" : "96%"})`,
      borderColor: isActive
        ? `hsl(${hue}, 50%, ${isDark ? "35%" : "40%"})`
        : `hsl(${hue}, ${isDark ? "20%" : "30%"}, ${isDark ? "22%" : "82%"})`,
      color: isActive
        ? "#ffffff"
        : `hsl(${hue}, ${isDark ? "55%" : "50%"}, ${isDark ? "80%" : "25%"})`,
    };
  }

  return (
    <span
      role={onToggle ? "button" : undefined}
      tabIndex={onToggle ? 0 : undefined}
      style={style}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (onToggle && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`inline-flex items-center gap-1 rounded-full border transition-all duration-200 ${sizeClasses} ${colorClasses} ${
        onToggle ? "cursor-pointer hover:opacity-80" : ""
      }`}
    >
      {label}
      {isRemovable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:text-error transition-colors ml-0.5"
          aria-label={`Remove ${label}`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
