import { api } from "./api";

export type CatalogAction = {
  key: string;
  label: string;
  name: string;
};

export type CatalogModule = {
  key: string;
  label: string;
  description: string;
  actions: CatalogAction[];
};

export type CatalogSection = {
  key: string;
  label: string;
  modules: CatalogModule[];
};

export type RoleRecord = {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_system: boolean;
  permissions: string[];
};

export async function listRoles(): Promise<RoleRecord[]> {
  const { data } = await api.get<RoleRecord[]>("/accounts/roles/");
  return data;
}

export async function getRole(id: number): Promise<RoleRecord> {
  const { data } = await api.get<RoleRecord>(`/accounts/roles/${id}/`);
  return data;
}

export async function getPermissionCatalog(): Promise<CatalogSection[]> {
  const { data } = await api.get<{ catalog: CatalogSection[] }>(
    "/accounts/roles/catalog/",
  );
  return data.catalog;
}

export async function createRole(payload: {
  name: string;
  description: string;
  permissions: string[];
}): Promise<RoleRecord> {
  const { data } = await api.post<RoleRecord>("/accounts/roles/", payload);
  return data;
}

export async function updateRole(
  id: number,
  payload: {
    name: string;
    description: string;
    permissions: string[];
  },
): Promise<RoleRecord> {
  const { data } = await api.patch<RoleRecord>(`/accounts/roles/${id}/`, payload);
  return data;
}

export async function deleteRole(id: number): Promise<void> {
  await api.delete(`/accounts/roles/${id}/`);
}
