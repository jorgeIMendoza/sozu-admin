import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import { Bell, Check, X } from "lucide-react";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDismissNotification,
  getCategoryIcon,
  getTypeInfo,
  formatRelativeTime,
  type Notification,
} from "@/lib/portal-cliente/notification-data";
import SecondaryHeader from "@/components/admin/portal-cliente/SecondaryHeader";

type FilterTab = "all" | "unread";

const ClienteNotificaciones = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>("all");

  const all = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const dismissNotif = useDismissNotification();

  const list = filter === "unread" ? all.filter((n) => !n.read) : all;
  const unreadCount = all.filter((n) => !n.read).length;

  return (
    <>
      <SecondaryHeader title="Notificaciones" hideBell />
      <div className="px-4 md:px-0 pt-6 pb-10 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="md:hidden font-bold text-2xl tracking-tight text-foreground">
              Notificaciones
            </h1>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `Tienes ${unreadCount} sin leer.` : "Estás al día."}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              data-cta="cliente.notificaciones.marcar-todas-leidas"
              onClick={() => markAllAsRead.mutate()}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline flex-shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              Marcar todas como leídas
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            data-cta="cliente.notificaciones.filtrar-todas"
            onClick={() => setFilter("all")}
            className={`h-9 px-4 rounded-full text-xs font-medium border transition-colors ${
              filter === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            Todas ({all.length})
          </button>
          <button
            data-cta="cliente.notificaciones.filtrar-no-leidas"
            onClick={() => setFilter("unread")}
            className={`h-9 px-4 rounded-full text-xs font-medium border transition-colors ${
              filter === "unread"
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            Sin leer ({unreadCount})
          </button>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center rounded-2xl border border-border bg-card">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {filter === "unread" ? "Sin notificaciones nuevas" : "No tienes notificaciones"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {filter === "unread"
                ? "Ya leíste todas tus notificaciones."
                : "Aquí verás avisos importantes sobre tus propiedades."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onClick={() => {
                  markAsRead.mutate(n.id);
                  navigate(n.actionUrl);
                }}
                onDismiss={() => dismissNotif.mutate(n.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

const NotificationRow = ({
  notification: n,
  onClick,
  onDismiss,
}: {
  notification: Notification;
  onClick: () => void;
  onDismiss: () => void;
}) => {
  const iconName = getCategoryIcon(n.category);
  const Icon = ((Icons as unknown) as Record<string, typeof Bell>)[iconName] ?? Bell;
  const typeInfo = getTypeInfo(n.type);

  return (
    <div
      className={`relative rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors ${
        !n.read ? "border-l-2 border-l-primary" : ""
      }`}
    >
      <button data-cta="cliente.notificaciones.abrir" onClick={onClick} className="w-full text-left flex items-start gap-3 p-4 pr-10">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeInfo.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className={`text-sm text-foreground ${!n.read ? "font-bold" : "font-semibold"}`}>
              {n.title}
            </p>
            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
          <div className="flex items-center justify-between mt-2 gap-2">
            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(n.createdAt)}</span>
            <span className={`text-[11px] font-medium ${typeInfo.className}`}>{n.actionLabel} →</span>
          </div>
        </div>
      </button>
      <button
        data-cta="cliente.notificaciones.descartar"
        onClick={onDismiss}
        aria-label="Descartar"
        className="absolute top-3 right-3 w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default ClienteNotificaciones;
