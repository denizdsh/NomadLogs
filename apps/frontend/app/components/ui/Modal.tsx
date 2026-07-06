import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "~/components/ui/Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  variant?: "default" | "danger";
  isLoading?: boolean;
  confirmDisabled?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  variant = "default",
  isLoading = false,
  confirmDisabled = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto max-w-lg w-full rounded-2xl bg-surface p-0 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="flex items-center justify-between border-b border-border-custom px-6 py-4">
        <h2 className="text-headline-md text-on-surface">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-on-surface-muted hover:text-on-surface transition-colors rounded-full p-1"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
      </header>

      <section className="px-6 py-5 text-body-md text-on-surface">
        {children}
      </section>

      {(confirmLabel || cancelLabel) && (
        <footer className="flex items-center justify-end gap-3 border-t border-border-custom px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          {confirmLabel && onConfirm && (
            <Button
              variant={variant === "danger" ? "danger" : "primary"}
              size="sm"
              onClick={onConfirm}
              isLoading={isLoading}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          )}
        </footer>
      )}
    </dialog>
  );
}
