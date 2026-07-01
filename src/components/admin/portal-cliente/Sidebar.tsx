import { SozuLogo } from "@/components/ui/SozuLogo";
import { useUnreadCount } from "@/lib/portal-cliente/notification-data";
import { usePortalNavItems, isNavItemActive } from "@/lib/portal-cliente/portal-nav-data";
import { ArrowLeft, ChevronRight, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

interface SidebarProps {
  appVersion?: string;
  showBackToAdmin?: boolean;
  onBackToAdmin?: () => void;
  onSignOut?: () => void;
  displayName?: string;
  userRole?: string;
  isClient?: boolean;
  onAfterNavigate?: () => void;
}

export const SidebarContent = ({
  appVersion,
  showBackToAdmin,
  onBackToAdmin,
  onSignOut,
  displayName = "Usuario",
  userRole = "Cliente",
  isClient = true,
  onAfterNavigate,
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const totalUnread = useUnreadCount();
  const { data: items = [] } = usePortalNavItems();

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <SozuLogo className="h-6" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal del cliente
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = isNavItemActive(item.route, location.pathname);
          const Icon = item.icon;
          const isNotif = item.route.includes("notificaciones");
          return (
            <button
              key={item.id}
              onClick={() => { navigate(item.route); onAfterNavigate?.(); }}
              className={`group relative w-full flex items-center justify-between gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-primary/[0.06] text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <span className={`absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-0"}`} />
              <span className="flex items-center gap-3">
                <Icon className={`size-4 shrink-0 ${isActive ? "" : "opacity-60 group-hover:opacity-100 transition-opacity duration-150"}`} />
                {item.label}
              </span>
              {isNotif && totalUnread > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-1 pb-4 border-t border-border-soft space-y-1">
        <button
          onClick={() => { navigate("/admin/portal-cliente/perfil"); onAfterNavigate?.(); }}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors group/profile"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{displayName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userRole}</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover/profile:opacity-100 transition-opacity" />
        </button>

        {isClient ? (
          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            Cerrar sesión
          </button>
        ) : (
          <div className="flex gap-2">
            {showBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <ArrowLeft className="size-4 shrink-0" />
                Regresar
              </button>
            )}
            <button
              onClick={onSignOut}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-4 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        )}

        {appVersion && (
          <p className="text-[10px] text-muted-foreground/40 font-mono text-center pt-0.5">{appVersion}</p>
        )}
      </div>
    </>
  );
};

const Sidebar = (props: SidebarProps) => (
  <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-64 z-30 flex-col bg-sidebar border-r border-border">
    <SidebarContent {...props} />
  </aside>
);

export default Sidebar;
