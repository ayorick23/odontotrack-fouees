import { useEffect, useState } from "react";
 
import { useAuth } from "../../hooks/useAuth";
import { secondaryActionClass } from "../../lib/actions";
import { checkApiHealth, getApiBaseUrl } from "../../services/health";
 
type LoadState = { status: "loading" } | { status: "error" } | { status: "ready" };

const cardClass =
  "rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-5";
const rowClass = "flex flex-col gap-0.5 sm:flex-row sm:gap-4";
const labelClass =
  "w-48 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

// Pantalla de soporte técnico. Pendiente: definir qué necesita ver/
// hacer el rol "soporte" en el sistema.
export function Support() {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const apiUrl = getApiBaseUrl();
 
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    checkApiHealth()
      .then(() => {
        if (!cancelled) {
          setState({ status: "ready" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);
 
  const rows = [
    { label: "URL de la API", value: apiUrl },
    { label: "Entorno del frontend", value: import.meta.env.MODE },
    { label: "Sesión actual", value: user ? `${user.username} (${user.role})` : "Sin sesión" },
  ];
 
  return (
    <section className={cardClass} aria-labelledby="support-title">
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <h2
          id="support-title"
          className="text-base font-semibold text-slate-800 dark:text-slate-100"
        >
          Información de mantenimiento
        </h2>
        <button
          type="button"
          className={secondaryActionClass}
          disabled={state.status === "loading"}
          onClick={() => setReloadToken((token) => token + 1)}
        >
          {state.status === "loading" ? "Verificando..." : "Verificar"}
        </button>
      </div>
 
      <dl className="flex flex-col gap-3 px-1">
        <div className={rowClass}>
          <dt className={labelClass}>Estado de la API</dt>
          <dd className="text-sm">
            {state.status === "loading" ? (
              <span className="text-slate-500 dark:text-slate-400">Verificando...</span>
            ) : null}
            {state.status === "ready" ? (
              <span className="font-semibold text-emerald-700 dark:text-emerald-400" role="status">
                API activa
              </span>
            ) : null}
            {state.status === "error" ? (
              <span className="font-semibold text-red-700 dark:text-red-400" role="alert">
                API sin respuesta
              </span>
            ) : null}
          </dd>
        </div>
 
        {rows.map((row) => (
          <div key={row.label} className={rowClass}>
            <dt className={labelClass}>{row.label}</dt>
            <dd className="break-all text-sm text-slate-800 dark:text-slate-100">{row.value}</dd>
          </div>
        ))}
 
        <div className={rowClass}>
          <dt className={labelClass}>Documentación de la API</dt>
          <dd className="text-sm">
            <a
              href={`${apiUrl}/docs/`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand hover:underline"
            >
              Abrir Swagger
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );
}