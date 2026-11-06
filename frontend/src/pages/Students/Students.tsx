import { listStudents, type Student  } from "@/services/students";
import {useEffect, useMemo, useState} from "react";
import { GLASS_PANEL, PANEL_HEADER, SECONDARY_BUTTON, SOLID_BLOCK } from "../../components/listing/styles";
import { Table } from "../../components/Table";
import { primaryActionClass } from "../../lib/actions";

const PAGE_SIZE = 20;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; students: Student[]; count: number }
;


// /api/accounts/users/ filtrado por rol.
export function Students() {
  
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] =useState<LoadState>({ status: "loading" });
  const [page, setPage ] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    listStudents(page).then((payload) => {
      if (!cancelled) {
        setState(
          {
            status: "ready",
            students: payload.results,
            count: payload.count,
          }
        );
      }

    }).catch(() => {
      if (!cancelled){
        setState({
          status: "error",
          message: "No se pudo cargar la lista de estudiantes.",
        });
      }
    });

    return () =>  {
      cancelled = true;

    };
  }, [page, reloadToken]);


  // La columna Usuario solo existe en el formato completo del API (admin);
  // docente y recepción reciben la vista reducida (ver services/students.ts).
  const showUsername =
    state.status === "ready" &&
    state.students.some((student) => student.username !== null);

  const columns = useMemo(
    () => [
      {
        header: "Nombre",
        render: (student: Student) => (
          <span className="flex items-center gap-3">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-lavender text-xs font-semibold text-ink"
              aria-hidden="true"
            >
              {initialsOf(student.name)}
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{student.name}</span>
          </span>
        ),
      },
      ...(showUsername
        ? [{ header: "Usuario", render: (student: Student) => student.username }]
        : []),
      {
        header: "Correo",
        // Hay cuentas sin correo: sin el guion la fila podía quedar en blanco.
        render: (student: Student) => student.email || "—",
      },
    ],
    [showUsername],
  );

  const pageCount = state.status === "ready" ? Math.max(Math.ceil(state.count / PAGE_SIZE), 1) : 1; 


  return (
    // Doble fondo: título y conteo sobre el vidrio, la tabla en el bloque sólido.
    <section className={GLASS_PANEL}>
      <div className={PANEL_HEADER}>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink dark:text-white">Estudiantes</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {state.status === "ready"
              ? `${state.count} ${state.count === 1 ? "estudiante registrado" : "estudiantes registrados"}`
              : "Quienes pueden tomar pacientes del banco"}
          </p>
        </div>
      </div>
      <div className={SOLID_BLOCK}>
      {state.status === "loading" ? (
        <p className="px-2 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Cargando estudiantes...
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="px-2 py-8 text-center">
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className={`${primaryActionClass} mt-4`}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <>
          <Table
            caption="Base de estudiantes"
            columns={columns}
            rows={state.students}
            getRowKey={(student) => student.id}
            emptyMessage="Aún no hay estudiantes registrados."
          />
          {state.count > 0 ? (
            <Pagination
              page={page}
              pageCount={pageCount}
              from={(page - 1) * PAGE_SIZE + 1}
              to={Math.min(page * PAGE_SIZE, state.count)}
              count={state.count}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : null}
      </div>
    </section>
  );
}


function Pagination({
  page,
  pageCount,
  from,
  to,
  count,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  count: number;
  onPageChange: (page: number) => void;
}) {
return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 px-1 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
      <p>
        Mostrando {from} a {to} de {count} estudiantes
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={SECONDARY_BUTTON}
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className={SECONDARY_BUTTON}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
