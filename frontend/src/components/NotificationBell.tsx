import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../services/notifications";

// Poll liviano del conteo (ODO-70): sin WebSockets.
const POLL_MS = 60_000;

export function NotificationBell() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);

  const refreshCount = useCallback(() => {
    getUnreadCount()
      .then(setUnread)
      .catch(() => {
        // El conteo es secundario: si falla, la campana sigue usable.
      });
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setFailed(false);
    listNotifications()
      .then(setItems)
      .catch(() => setFailed(true));
    refreshCount();
  }

  async function handleSelect(notification: AppNotification) {
    if (!notification.is_read) {
      const updated = await markNotificationRead(notification.id).catch(
        () => null,
      );
      if (updated) {
        setItems((current) =>
          current?.map((item) => (item.id === updated.id ? updated : item)) ??
          null,
        );
        setUnread((count) => Math.max(0, count - 1));
      }
    }
    setOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  }

  async function handleReadAll() {
    await markAllNotificationsRead().catch(() => null);
    const now = new Date().toISOString();
    setItems(
      (current) =>
        current?.map((item) =>
          item.is_read ? item : { ...item, is_read: true, read_at: now },
        ) ?? null,
    );
    setUnread(0);
  }

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={
          unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"
        }
        aria-expanded={open}
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
              Notificaciones
            </p>
            <button
              type="button"
              onClick={handleReadAll}
              disabled={unread === 0}
              className="text-xs font-medium text-sky-600 hover:underline disabled:cursor-default disabled:text-slate-300 disabled:no-underline dark:text-sky-400 dark:disabled:text-slate-600"
            >
              Marcar todas como leídas
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {failed ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                No se pudieron cargar las notificaciones.
              </p>
            ) : items === null ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                Cargando…
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                No tienes notificaciones.
              </p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        item.is_read ? "" : "bg-sky-50/60 dark:bg-sky-950/30"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${
                          item.is_read ? "bg-transparent" : "bg-sky-500"
                        }`}
                      />
                      <span className="min-w-0">
                        <span
                          className={`block text-sm ${
                            item.is_read
                              ? "text-slate-600 dark:text-slate-300"
                              : "font-semibold text-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.body ? (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {item.body}
                          </span>
                        ) : null}
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
