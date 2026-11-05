import { X } from "./icons";
import { useEffect, type ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-ink/25 backdrop-blur-[6px] dark:bg-black/45 animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className="relative w-full max-w-md rounded-[24px] bg-surface p-6 shadow-[0_30px_70px_-20px_rgba(22,24,28,0.35)] animate-in fade-in-0 zoom-in-95 duration-200 dark:ring-1 dark:ring-white/10"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          {title ? (
            <h2
              id="modal-title"
              className="text-lg font-semibold text-slate-800 dark:text-slate-100"
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
