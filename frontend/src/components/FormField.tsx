import type { ReactNode } from "react";

// Etiqueta + control, con el error (o la ayuda) debajo y fuera del <label>
// para que no se sume al nombre accesible del campo. Las clases del input
// están en lib/forms.ts.
export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
        {children}
      </label>
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
