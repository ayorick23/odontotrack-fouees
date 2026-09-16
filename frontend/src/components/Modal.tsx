import type { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

// Modal genérico reutilizable, sin librería externa. Se muestra solo
// si isOpen es true. Todavía sin animaciones ni manejo de foco/teclado
// (ej. cerrar con Escape); eso se puede agregar cuando haga falta.
export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true">
      {title && <h2>{title}</h2>}
      {children}
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}
