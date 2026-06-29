import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import { Bell, Check, X, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAsUnread,
  useMarkAllAsRead,
  useDismissNotification,
  getCategoryIcon,
  getTypeInfo,
  formatRelativeTime,
  type Notification,
} from "@/lib/portal-cliente/notification-data";

interface NotificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "all" | "unread";

const NotificationSheet = ({ open, onOpenChange }: NotificationSheetProps) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");

  const notifications = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAsUnread = useMarkAsUnread();
  const markAllAsRead = useMarkAllAsRead();
  const dismissNotif = useDismissNotification();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const list = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const handleClick = (n: Notification) => {
    markAsRead.mutate(n.id);
    onOpenChange(false);
    navigate(n.actionUrl);
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dismissNotif.mutate(id);
  };

  const handleToggleRead = (e: React.MouseEvent, n: Notification) => {
    e.stopPropagation();
    if (n.read) {
      markAsUnread.mutate(n.id);
    } else {
      markAsRead.mutate(n.id);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 rounded-t-2xl max-h-[90dvh] flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-[15px] font-semibold">Notificaciones</SheetTitle>
              {unreadCount > 0 && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{unreadCount} sin leer</p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Check className="w-3 h-3" />
                Marcar todas
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-muted rounded-lg p-0.5">
            {(["all", "unread"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "all" ? "Todas" : `Sin leer${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {tab === "unread" ? "No hay sin leer" : "Estás al día"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {tab === "unread"
                  ? "Todas las notificaciones han sido leídas."
                  : "Sin notificaciones nuevas por ahora."}
              </p>
            </div>
          ) : (
            <ul>
              {list.map((n) => {
                const iconName = getCategoryIcon(n.category);
                const Icon =
                  ((Icons as unknown) as Record<string, typeof Bell>)[iconName] ?? Bell;
                const typeInfo = getTypeInfo(n.type);
                return (
                  <li key={n.id} className="relative">
                    <button
                      onClick={() => handleClick(n)}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0 ${
                        !n.read ? "bg-primary/[0.02]" : ""
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${typeInfo.iconBg}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 pr-16">
                        <div className="flex items-start gap-2">
                          <p
                            className={`text-[13px] text-foreground truncate leading-snug ${
                              !n.read ? "font-bold" : "font-semibold"
                            }`}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.description}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>
                    </button>
                    <div className="absolute top-3.5 right-3 flex items-center gap-0.5">
                      <button
                        onClick={(e) => handleToggleRead(e, n)}
                        aria-label={n.read ? "Marcar como no leída" : "Marcar como leída"}
                        title={n.read ? "Marcar como no leída" : "Marcar como leída"}
                        className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                      >
                        {n.read ? <Bell className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={(e) => handleDismiss(e, n.id)}
                        aria-label="Descartar"
                        className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3 shrink-0">
          <button
            onClick={() => {
              onOpenChange(false);
              navigate("/admin/portal-cliente/notificaciones");
            }}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline py-1"
          >
            Ver todas las notificaciones
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationSheet;
