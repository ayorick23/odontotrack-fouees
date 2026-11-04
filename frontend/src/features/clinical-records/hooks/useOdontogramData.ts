import { useCallback, useEffect, useRef, useState } from "react";

import { getOdontogram, saveOdontogram } from "../../../services/odontogram";
import { domainKey } from "../components/Odontogram/mapEngineState";
import { emptyOdontogram, type OdontogramValue } from "../types";

type LoadStatus = "loading" | "ready" | "error";

/** Pasos de deshacer que se recuerdan. */
const UNDO_LIMIT = 100;

function cloneOdontogram(value: OdontogramValue): OdontogramValue {
  return JSON.parse(JSON.stringify(value)) as OdontogramValue;
}

function clinicalKey(value: OdontogramValue): string {
  return JSON.stringify({ teeth: value.teeth, oralMarks: value.oralMarks });
}

export function useOdontogramData(patientId: number) {
  const [value, setValue] = useState<OdontogramValue>(() => emptyOdontogram());
  const [savedValue, setSavedValue] = useState<OdontogramValue>(() =>
    emptyOdontogram(),
  );
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [savedKey, setSavedKey] = useState(domainKey(emptyOdontogram()));
  const [editorKey, setEditorKey] = useState(0);
  const [undoCount, setUndoCount] = useState(0);
  const requestIdRef = useRef(0);
  // Refs y no estado: varias ediciones seguidas (antes de re-renderizar)
  // deben apilarse cada una sobre la anterior.
  const valueRef = useRef(value);
  const pastRef = useRef<OdontogramValue[]>([]);

  /** Reemplaza el valor; `history` decide qué pasa con la pila de deshacer. */
  const commit = useCallback(
    (next: OdontogramValue, history: "push" | "keep" | "clear") => {
      if (history === "push") {
        pastRef.current = [
          ...pastRef.current.slice(-(UNDO_LIMIT - 1)),
          valueRef.current,
        ];
      } else if (history === "clear") {
        pastRef.current = [];
      }
      valueRef.current = next;
      setValue(next);
      setUndoCount(pastRef.current.length);
    },
    [],
  );

  const rememberSaved = useCallback((next: OdontogramValue) => {
    const saved = cloneOdontogram(next);
    setSavedValue(saved);
    setSavedKey(domainKey(saved));
    return cloneOdontogram(saved);
  }, []);

  const load = useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoadStatus("loading");
    getOdontogram(patientId)
      .then((loaded) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        commit(rememberSaved(loaded), "clear");
        setLoadStatus("ready");
      })
      .catch(() => {
        if (requestId === requestIdRef.current) {
          setLoadStatus("error");
        }
      });
  }, [patientId, rememberSaved, commit]);

  useEffect(() => {
    load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  const onChange = useCallback(
    (next: OdontogramValue) => commit(next, "push"),
    [commit],
  );

  /** Un paso atrás (Ctrl+Z). */
  const undo = useCallback(() => {
    const previous = pastRef.current.at(-1);
    if (!previous) {
      return;
    }
    pastRef.current = pastRef.current.slice(0, -1);
    commit(previous, "keep");
  }, [commit]);

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      const saved = await saveOdontogram(patientId, valueRef.current);
      const cloned = rememberSaved(saved);
      commit(cloned, "clear");
      return cloned;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, rememberSaved, commit]);

  /** Descarta todos los cambios sin guardar. */
  const discard = useCallback(() => {
    commit(cloneOdontogram(savedValue), "clear");
    setEditorKey((key) => key + 1);
  }, [savedValue, commit]);

  // Un odontograma nunca guardado llega sin snapshot y el editor genera uno
  // al dibujarlo; eso solo no cuenta como cambio sin guardar.
  const isDirty = savedValue.visualSnapshot
    ? domainKey(value) !== savedKey
    : clinicalKey(value) !== clinicalKey(savedValue);

  return {
    value,
    /** Lo último guardado: para contar las piezas con cambios. */
    savedValue,
    onChange,
    save,
    undo,
    canUndo: undoCount > 0,
    discard,
    reload: load,
    loadStatus,
    isSaving,
    isDirty,
    editorKey,
  };
}
