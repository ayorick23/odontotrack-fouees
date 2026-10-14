import {api, type PaginatedResponse } from "./api";


export type Student = {
    id: number;
    name: string;
    email: string;
}

export function listStudents(page = 1): Promise<PaginatedResponse<Student>>{
    return api.get<PaginatedResponse<Student>>("/accounts/users/", {params: {role: "estudiante", page},}).then((response) => response.data );
}
