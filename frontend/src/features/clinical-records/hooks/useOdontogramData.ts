import { useCallback, useEffect, useRef, useState } from "react";

import { getOdontogram, saveOdontogram } from "../../../services/odontogram";
import { domainKey } from "../components/Odontogram/mapEngineState";
import { emptyOdontogram, type OdontogramValue } from "../types";

type LoadStatus = "loading" | "ready" | "error";

function cloneOdontogram(value: OdontogramValue): OdontogramValue {
  return JSON.parse(JSON.stringify(value)) as OdontogramValue;
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
  const requestIdRef = useRef(0);

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
        const cloned = rememberSaved(loaded);
        setValue(cloned);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (requestId === requestIdRef.current) {
          setLoadStatus("error");
        }
      });
  }, [patientId, rememberSaved]);

  useEffect(() => {
    load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  const onChange = useCallback((next: OdontogramValue) => {
    setValue(next);
  }, []);

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      const saved = await saveOdontogram(patientId, value);
      const cloned = rememberSaved(saved);
      setValue(cloned);
      return cloned;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, rememberSaved, value]);

  const discard = useCallback(() => {
    setValue(cloneOdontogram(savedValue));
    setEditorKey((key) => key + 1);
  }, [savedValue]);

  return {
    value,
    onChange,
    save,
    discard,
    reload: load,
    loadStatus,
    isSaving,
    isDirty: domainKey(value) !== savedKey,
    editorKey,
  };
}
