import { useLocation, useNavigate } from "react-router-dom";
import { useUnreadCount } from "@/lib/portal-cliente/notification-data";
import { usePortalNavItems, isNavItemActive } from "@/lib/portal-cliente/portal-nav-data";
import { Bell } from "lucide-react";

export type NavTab = string;

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: items = [] } = usePortalNavItems();
  const totalUnread = useUnreadCount();

  // Max 5 items on mobile - slice if DB has more
  const visibleItems = items.slice(0, 5);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {visibleItems.map((item) => {
          const isActive = isNavItemActive(item.route, location.pathname);
          const Icon = item.icon;
          const isNotif = item.route.includes("notificaciones");
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.route)}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isActive && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-all ${isActive ? "scale-110" : ""}`} />
                {isNotif && totalUnread > 0 && (
                  <span
                    className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-destructive border border-card"
                    aria-label={`${totalUnread} sin leer`}
                  />
                )}
              </div>
              <span className={`text-[10px] font-semibold ${isActive ? "text-primary" : ""}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
