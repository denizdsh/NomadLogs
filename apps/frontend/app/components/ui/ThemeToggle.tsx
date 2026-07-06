import { Sun, Moon } from "lucide-react";
import { useTheme } from "~/hooks/useTheme";
import { Tooltip } from "~/components/ui/Tooltip";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <Tooltip content={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`} position="bottom">
      <button
        type="button"
        onClick={toggleTheme}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-border-custom bg-surface hover:border-primary/50 text-on-surface-muted hover:text-on-surface shadow-sm transition-all active:scale-90 cursor-pointer outline-none"
        aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
      >
        {resolvedTheme === "dark" ? (
          <Sun size={16} className="text-warning animate-fade-in" />
        ) : (
          <Moon size={16} className="text-info animate-fade-in" />
        )}
      </button>
    </Tooltip>
  );
}
