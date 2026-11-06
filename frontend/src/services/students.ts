import { api, type PaginatedResponse } from "./api";

/** Campos que devuelve /api/accounts/users/ (UserSerializer); no hay `name`. */
export type Student = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

export function listStudents(page = 1): Promise<PaginatedResponse<Student>> {
  return api
    .get<PaginatedResponse<Student>>("/accounts/users/", {
      params: { role: "estudiante", page },
    })
    .then((response) => response.data);
}
