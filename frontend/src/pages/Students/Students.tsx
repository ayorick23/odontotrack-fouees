import { listStudents, type Student  } from "@/services/students";
import {useEffect, useMemo, useState} from "react";
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


  const columns = useMemo(
    () =>  [{
      header: "Nombre",
      render: (student: Student) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {student.name}
        </span>
      ),
    },
    {
      header:"Correo",
      render: (student: Student) => student.email,
    },
  ],
  [],
  );

  const pageCount = state.status === "ready" ? Math.max(Math.ceil(state.count / PAGE_SIZE), 1) : 1; 


  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-5">
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
        Mostrar {from} a {to} de {count} estudiantes
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
