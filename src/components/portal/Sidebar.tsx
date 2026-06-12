import { Home, ShoppingBag, Wallet, FileText, LogOut, Bell, ChevronRight, Clock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import type { NavTab } from "./BottomNav";
import { useUnreadCountsByNavTab, useUnreadCount } from "@/lib/offers/notification-data";
import { filterPortfolioByCategory, mockPortfolio } from "@/lib/offers/mock-data";
import { useOfferStore } from "@/lib/offers/offer-data";
import sozuLogo from "@/assets/sozu-logo.png";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const USER_NAME = "Alejandro García";
const USER_INITIALS = "AG";
const USER_LABEL = "Inversionista";

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const counts = useUnreadCountsByNavTab();
  const totalUnread = useUnreadCount();
  const isNotificationsActive = location.pathname.startsWith("/notificaciones");

  const inAcquisitionCount = filterPortfolioByCategory(mockPortfolio, "in_acquisition").length;
  const patrimonyCount = filterPortfolioByCategory(mockPortfolio, "active_patrimony").length;
  const allPreReservations = useOfferStore((s) => s.preReservations);
  const activePreReservations = allPreReservations.filter((r) => r.status === "active");
  const preReservationCount = activePreReservations.length;
  const preReservationHasNew = activePreReservations.some((r) => {
    const days = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return days < 3;
  });

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: typeof Home;
    count: number | undefined;
    visible: boolean;
    hasNew?: boolean;
  }> = [
    { id: "home", label: "Inicio", icon: Home, count: undefined, visible: true },
    {
      id: "pre_reservation",
      label: "Pre-apartado",
      icon: Clock,
      count: preReservationCount,
      visible: preReservationCount > 0,
      hasNew: preReservationHasNew,
    },
    { id: "acquisition", label: "En adquisición", icon: ShoppingBag, count: inAcquisitionCount, visible: inAcquisitionCount > 0 },
    { id: "patrimony", label: "Mi patrimonio", icon: Wallet, count: patrimonyCount, visible: patrimonyCount > 0 },
    { id: "documents", label: "Documentos", icon: FileText, count: undefined, visible: true },
  ];

  const handleLogout = () => {
    toast.info("Cerrar sesión estará disponible próximamente.");
  };

  return (
    <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 z-30 flex-col bg-sidebar border-r border-border">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-border-soft">
        <img src={sozuLogo} alt="SOZU" className="h-7 w-auto object-contain dark:invert" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mt-3">
          Portal del inversionista
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.filter((i) => i.visible).map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const unread = (item.id === "acquisition" ? counts.property : (counts as Record<string, number>)[item.id]) ?? 0;
          const count = item.count;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`group relative w-full flex items-center justify-between gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-primary/[0.06] text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-primary" />
              )}
              <span className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? "" : "opacity-60 group-hover:opacity-100"}`} />
                {item.label}
              </span>
              <span className="flex items-center gap-1.5">
                {typeof count === "number" && (
                  <span
                    className={`min-w-[20px] h-[18px] px-1.5 flex items-center justify-center text-[10px] font-semibold rounded-full ${
                      count > 0
                        ? "bg-primary/12 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {(unread > 0 || item.hasNew) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" aria-label="novedades" />
                )}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => navigate("/notificaciones")}
          className={`group relative w-full flex items-center justify-between gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
            isNotificationsActive
              ? "bg-primary/[0.06] text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
        >
          {isNotificationsActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-primary" />
          )}
          <span className="flex items-center gap-3">
            <Bell className={`w-4 h-4 ${isNotificationsActive ? "" : "opacity-60 group-hover:opacity-100"}`} />
            Notificaciones
          </span>
          {totalUnread > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </button>
      </nav>

      {/* User block */}
      <div className="px-3 pt-3 pb-4 border-t border-border-soft space-y-1">
        <button
          onClick={() => onTabChange("profile")}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
            {USER_INITIALS}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{USER_NAME}</p>
            <p className="text-[11px] text-muted-foreground truncate">{USER_LABEL}</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
