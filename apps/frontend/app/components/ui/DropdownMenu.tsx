import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
}

interface DropdownMenuProps {
  items: DropdownItem[];
  triggerLabel?: string;
}

export function DropdownMenu({ items, triggerLabel = "Actions" }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg text-on-surface-muted hover:text-on-surface hover:bg-border-custom/50 transition-all"
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <menu className="absolute right-0 top-full mt-1 z-40 min-w-48 rounded-xl bg-surface border border-border-custom shadow-xl py-1.5 animate-slide-down">
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-body-sm transition-colors ${
                  item.variant === "danger"
                    ? "text-error hover:bg-error/10"
                    : "text-on-surface hover:bg-border-custom/50"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </menu>
      )}
    </nav>
  );
}
