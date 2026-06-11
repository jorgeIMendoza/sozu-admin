import { Bell, Search, ChevronDown } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUnreadCount } from "@/lib/offers/notification-data";
import NotificationPopover from "./notifications/NotificationPopover";

interface TopBarProps {
  userName: string;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Inicio",
  "/propiedades": "Mis propiedades",
  "/documentos": "Mi expediente",
  "/notificaciones": "Notificaciones",
  "/perfil": "Mi perfil",
  "/estado-de-cuenta": "Estado de cuenta",
  "/historial-de-pagos": "Historial de pagos",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/propiedades/")) return "Detalle de propiedad";
  if (pathname.startsWith("/estado-de-cuenta/")) return "Estado de cuenta";
  if (pathname.startsWith("/historial-de-pagos/")) return "Historial de pagos";
  return "SOZU";
}

const TopBar = ({ userName }: TopBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  const pageTitle = getPageTitle(location.pathname);
  const initials = userName
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
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
    <header className="hidden md:flex sticky top-0 z-20 h-16 items-center gap-6 px-6 lg:px-8 bg-background/85 backdrop-blur-md border-b border-border-soft">
      {/* Page title */}
      <h1 className="text-[15px] font-semibold text-foreground tracking-tight">{pageTitle}</h1>

      {/* Search (visual placeholder) */}
      <div className="flex-1 max-w-md ml-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
          <input
            type="text"
            disabled
            placeholder="Buscar propiedades, documentos, pagos…"
            className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/60 border border-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Bell + Avatar */}
      <div className="flex items-center gap-2 ml-auto">
        <NotificationPopover trigger={bellTrigger} />
        <button
          onClick={() => navigate("/perfil")}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-muted transition-colors"
        >
          <div className="w-7 h-7 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
            {initials}
          </div>
          <span className="text-[13px] font-medium text-foreground">{userName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
};

export default TopBar;
