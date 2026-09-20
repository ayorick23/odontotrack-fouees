import { Search, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { can } from "../../acl/can";
import { Table } from "../../components/Table";
import { TableRowActions } from "../../components/TableRowActions";
import { useAuth } from "../../hooks/useAuth";
import { listRoles, type RoleRecord } from "../../services/roles";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; roles: RoleRecord[] };

export function RoleList() {
  const { user } = useAuth();
  const canEdit = can(user, "roles.edit");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    listRoles()
      .then((roles) => {
        if (!cancelled) {
          setState({ status: "ready", roles });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudieron cargar los roles.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return state.roles;
    }
    return state.roles.filter((role) => {
      const haystack = `${role.name} ${role.slug} ${role.description}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [search, state]);

  const columns = useMemo(
    () => [
      {
        header: "Rol",
        render: (role: RoleRecord) => (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <Shield className="size-4" />
            </span>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {role.name}
              </p>
              {role.is_system ? (
                <p className="text-xs text-slate-400">Rol de sistema</p>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        header: "Descripción",
        render: (role: RoleRecord) => (
          <p className="max-w-md text-slate-500 dark:text-slate-400">
            {role.description || "—"}
          </p>
        ),
      },
      {
        header: "Permisos",
        render: (role: RoleRecord) => (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {role.permissions.length}
          </span>
        ),
      },
      {
        header: "Acciones",
        align: "right" as const,
        render: (role: RoleRecord) => (
          <TableRowActions
            editTo={canEdit ? `/roles/${role.id}/edit` : undefined}
          />
        ),
      },
    ],
    [canEdit],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Roles del sistema
        </h2>
        <label className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300 dark:ring-1 dark:ring-white/10">
          <Search className="size-4 shrink-0" />
          <span className="sr-only">Buscar rol</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar rol"
            className="w-52 bg-transparent outline-none placeholder:text-slate-400"
          />
        </label>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-5">
        {state.status === "loading" ? (
          <p className="px-2 py-10 text-center text-sm text-slate-400">
            Cargando roles...
          </p>
        ) : null}

        {state.status === "error" ? (
          <p className="px-2 py-8 text-center text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "ready" ? (
          <Table
            caption="Roles del sistema"
            columns={columns}
            rows={rows}
            getRowKey={(role) => role.id}
            emptyMessage={
              search.trim()
                ? "Ningún rol coincide con la búsqueda."
                : "No hay roles para mostrar."
            }
          />
        ) : null}
      </section>
    </section>
  );
}
