import { displayName } from "../context/AuthContext";
import { api, type PaginatedResponse } from "./api";

/**
 * /api/accounts/users/?role=estudiante responde con DOS formatos según quién
 * pregunta (accounts/views.py, get_serializer_class):
 * - con `users.view` (admin): UserSerializer → first_name, last_name, username…
 * - solo con `students.view` (docente, recepción): StudentListSerializer →
 *   id, name, email (vista reducida a propósito, ODO-16).
 * Se normalizan aquí para que la pantalla trabaje con una sola forma.
 */
type StudentApiRow =
  | { id: number; name: string; email: string }
  | {
      id: number;
      username: string;
      email: string;
      first_name: string;
      last_name: string;
    };

export type Student = {
  id: number;
  name: string;
  email: string;
  /** Solo llega en el formato completo (quien gestiona usuarios). */
  username: string | null;
};

export function toStudent(row: StudentApiRow): Student {
  if ("name" in row) {
    return { id: row.id, name: row.name, email: row.email, username: null };
  }
  return {
    id: row.id,
    name: displayName(row),
    email: row.email,
    username: row.username,
  };
}

export function listStudents(page = 1): Promise<PaginatedResponse<Student>> {
  return api
    .get<PaginatedResponse<StudentApiRow>>("/accounts/users/", {
      params: { role: "estudiante", page },
    })
    .then(({ data }) => ({ ...data, results: data.results.map(toStudent) }));
}
