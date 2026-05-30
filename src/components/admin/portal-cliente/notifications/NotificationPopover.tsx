import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import { Bell, Check, X, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface PopoverProps {
  trigger: React.ReactNode;
}

const NotificationPopover = ({ trigger }: PopoverProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const notifications = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const dismissNotif = useDismissNotification();

  const previewList = notifications.slice(0, 8);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleClick = (n: Notification) => {
    markAsRead.mutate(n.id);
    setOpen(false);
    navigate(n.actionUrl);
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dismissNotif.mutate(id);
  };

  const handleMarkAll = () => {
    markAllAsRead.mutate();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 overflow-hidden rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Notificaciones</span>
            {unreadCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {unreadCount} sin leer
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Check className="w-3 h-3" />
              Marcar todas
            </button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[420px] overflow-y-auto">
          {previewList.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Estás al día</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Sin notificaciones nuevas por ahora.
              </p>
            </div>
          ) : (
            <ul>
              {previewList.map((n) => {
                const iconName = getCategoryIcon(n.category);
                const Icon =
                  ((Icons as unknown) as Record<string, typeof Bell>)[iconName] ?? Bell;
                const typeInfo = getTypeInfo(n.type);
                return (
                  <li key={n.id} className="relative">
                    <button
                      onClick={() => handleClick(n)}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0 ${
                        !n.read ? "bg-primary/[0.02]" : ""
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeInfo.iconBg}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-start gap-2">
                          <p
                            className={`text-xs text-foreground truncate ${
                              !n.read ? "font-bold" : "font-semibold"
                            }`}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                          {n.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleDismiss(e, n.id)}
                      aria-label="Descartar"
                      className="absolute top-3 right-3 w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2">
          <button
            onClick={() => {
              setOpen(false);
              navigate("/notificaciones");
            }}
            className="w-full flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline py-1"
          >
            Ver todas las notificaciones
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationPopover;
