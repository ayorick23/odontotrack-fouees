import { useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";

type UnsavedChangesGuardProps = {
  /** Si hay cambios sin guardar. */
  when: boolean;
  /** Qué se está editando, para el mensaje ("el odontograma"). */
  subject: string;
  /** Guarda; devuelve false si falló (entonces no se sale). */
  onSave: () => Promise<boolean>;
  /** Se llama antes de salir sin guardar. */
  onDiscard?: () => void;
};

/**
 * Pregunta antes de salir de la pantalla con cambios sin guardar.
 *
 * Dentro de la app (menú, enlaces, atrás) muestra un diálogo propio con
 * Guardar / Descartar / Seguir editando. Al cerrar o recargar la pestaña el
 * navegador solo permite su aviso genérico, sin botones propios.
 *
 * Solo bloquea si cambia la ruta: cambiar parámetros de la URL dentro de la
 * misma pantalla no cuenta como salir.
 */
export function UnsavedChangesGuard({
  when,
  subject,
  onSave,
  onDiscard,
}: UnsavedChangesGuardProps) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!when) {
      return;
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Chrome todavía lo exige para mostrar el aviso.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  const open = blocker.state === "blocked";

  async function saveAndLeave() {
    setSaving(true);
    try {
      const ok = await onSave();
      if (blocker.state === "blocked") {
        if (ok) {
          blocker.proceed();
        } else {
          blocker.reset();
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving && blocker.state === "blocked") {
          blocker.reset();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hay cambios sin guardar</AlertDialogTitle>
          <AlertDialogDescription>
            Hiciste cambios en {subject} que todavía no se guardan. Si sales
            ahora sin guardar, se pierden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => blocker.state === "blocked" && blocker.reset()}
          >
            Seguir editando
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              if (blocker.state === "blocked") {
                onDiscard?.();
                blocker.proceed();
              }
            }}
          >
            Descartar y salir
          </Button>
          <Button disabled={saving} onClick={() => void saveAndLeave()}>
            {saving ? "Guardando..." : "Guardar y salir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
