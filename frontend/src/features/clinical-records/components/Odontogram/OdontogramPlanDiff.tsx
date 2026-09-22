import { useEffect, useState } from "react";

import { readPlanChanges, subscribeEngine, type EnginePlanChange } from "./engine";

export function OdontogramPlanDiff() {
  const [changes, setChanges] = useState<EnginePlanChange[]>([]);

  useEffect(() => {
    const sync = () => setChanges(readPlanChanges());
    sync();
    return subscribeEngine(sync);
  }, []);

  if (changes.length === 0) {
    return null;
  }

  return (
    <ul
      className="space-y-1 rounded-xl bg-teal-50/70 px-3 py-2 text-xs text-teal-900 dark:bg-teal-950/40 dark:text-teal-100"
      aria-label="Cambios del plan respecto al estado"
    >
      {changes.map((change) => (
        <li key={`${change.toothNo}-${change.axis}-${change.from}-${change.to}`}>
          {change.toothNo} {change.axis}: {change.from} → {change.to}
        </li>
      ))}
    </ul>
  );
}
