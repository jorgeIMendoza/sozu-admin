import { useState } from "react";
import { Bell, User, LogOut, Phone } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCount } from "@/lib/portal-cliente/notification-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NotificationPopover from "./notifications/NotificationPopover";
import { ClienteImpersonationSelector } from "./ClienteImpersonationSelector";
import { PortalSearchInput } from "./PortalSearchInput";

interface TopBarProps {
  userName: string;
  userRole?: string;
  userPhone?: string;
}

const TopBar = ({ userName, userRole, userPhone }: TopBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const unreadCount = useUnreadCount();
  const [open, setOpen] = useState(false);

  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const bellTrigger = (
    <button
      aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
      className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
    >
      <Bell className="w-[18px] h-[18px]" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <header className="hidden lg:flex sticky top-0 z-20 h-16 items-center gap-4 px-6 lg:px-8 bg-card border-b border-border-soft">
      {/* Search */}
      <PortalSearchInput className="w-full max-w-[260px] min-w-0" />

      {/* Impersonation toolbar - self-guards for superadmin */}
      <ClienteImpersonationSelector />

      {/* Bell + Avatar - pushed to right */}
      <div className="flex items-center gap-2 ml-auto">
        <NotificationPopover trigger={bellTrigger} />

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Perfil de usuario"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
            >
              {initials}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-60 p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border-soft bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-semibold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[13px] font-semibold text-foreground truncate">{userName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{userRole || "-"}</p>
                  {userPhone && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Phone className="size-3 shrink-0" />
                      {userPhone}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-1.5 space-y-0.5">
              <button
                onClick={() => { navigate("/admin/portal-cliente/perfil"); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-foreground hover:bg-muted/60 transition-colors duration-150"
              >
                <User className="size-4 text-muted-foreground shrink-0" />
                Ver perfil
              </button>
              <button
                onClick={() => { signOut(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-destructive hover:bg-destructive/10 transition-colors duration-150"
              >
                <LogOut className="size-4 shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};

export default TopBar;
