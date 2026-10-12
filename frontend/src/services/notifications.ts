import { api, type PaginatedResponse } from "./api";

export type NotificationKind =
  | "patient_assigned"
  | "diagnosis_pending"
  | "diagnosis_validated"
  | "case_finalized";

export type AppNotification = {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

const BASE = "/accounts/notifications/";

export function listNotifications(): Promise<AppNotification[]> {
  return api
    .get<PaginatedResponse<AppNotification>>(BASE)
    .then((response) => response.data.results);
}

export function getUnreadCount(): Promise<number> {
  return api
    .get<{ count: number }>(`${BASE}unread-count/`)
    .then((response) => response.data.count);
}

export function markNotificationRead(id: number): Promise<AppNotification> {
  return api
    .post<AppNotification>(`${BASE}${id}/read/`)
    .then((response) => response.data);
}

export function markAllNotificationsRead(): Promise<number> {
  return api
    .post<{ updated: number }>(`${BASE}read-all/`)
    .then((response) => response.data.updated);
}
