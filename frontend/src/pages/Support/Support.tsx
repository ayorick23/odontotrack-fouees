import { useEffect, useState, type ReactNode } from "react";

import { ArrowUpRight } from "../../components/icons";
import {
  GLASS_PANEL,
  PANEL_HEADER,
  SECONDARY_BUTTON,
  SOLID_BLOCK,
} from "../../components/listing/styles";
import { useAuth } from "../../hooks/useAuth";
import { checkApiHealth, getApiBaseUrl } from "../../services/health";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready" };

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

  return (
    // Doble fondo: título y "Verificar" sobre el vidrio; estado y datos en el bloque sólido.
    <section className={`${GLASS_PANEL} max-w-4xl`} aria-labelledby="support-title">
      <div className={PANEL_HEADER}>
        <div>
          <h2 id="support-title" className="text-[15px] font-semibold tracking-tight text-ink dark:text-white">
            Estado del sistema
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Información de mantenimiento para soporte técnico.
          </p>
        </div>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          disabled={state.status === "loading"}
          onClick={() => setReloadToken((token) => token + 1)}
        >
          {state.status === "loading" ? "Verificando..." : "Verificar"}
        </button>
      </div>

      <div className={`${SOLID_BLOCK} flex flex-col gap-5`}>
        <ApiStatus state={state} />

        <dl className="grid gap-x-6 gap-y-4 border-t border-ink/5 pt-4 sm:grid-cols-3 dark:border-white/10">
          <Fact label="URL de la API">
            <span className="break-all">{apiUrl}</span>
          </Fact>
          <Fact label="Entorno del frontend">{import.meta.env.MODE}</Fact>
          <Fact label="Sesión actual">
            {user ? `${user.username} (${user.role})` : "Sin sesión"}
          </Fact>
        </dl>

        <div>
          <a
            href={`${apiUrl}/docs/`}
            target="_blank"
            rel="noreferrer"
            className={`${SECONDARY_BUTTON} anim-arrow`}
          >
            Abrir documentación de la API (Swagger)
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ApiStatus({ state }: { state: LoadState }) {
  const tone = {
    loading: { dot: "bg-slate-400", text: "Verificando la API...", detail: "Consultando /api/health/." },
    ready: { dot: "bg-lime", text: "API activa", detail: "El backend responde con normalidad." },
    error: {
      dot: "bg-red-500",
      text: "API sin respuesta",
      detail: "El backend no respondió. Revisa que el contenedor esté levantado.",
    },
  }[state.status];

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/[.03]">
      <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-ink dark:bg-white/[.06]">
        {state.status === "ready" ? (
          <span className={`absolute size-3 animate-ping rounded-full ${tone.dot} opacity-60`} aria-hidden="true" />
        ) : null}
        <span className={`relative size-3 rounded-full ${tone.dot}`} aria-hidden="true" />
      </span>
      <div>
        <p
          className={`text-base font-semibold ${state.status === "error" ? "text-red-600 dark:text-red-400" : "text-ink dark:text-white"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {tone.text}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{tone.detail}</p>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}
