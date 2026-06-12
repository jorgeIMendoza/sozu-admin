import { Home, ShoppingBag, Wallet, FileText, User } from "lucide-react";
import { useUnreadCountsByNavTab } from "@/lib/offers/notification-data";
import { filterPortfolioByCategory, mockPortfolio } from "@/lib/offers/mock-data";

export type NavTab = "home" | "pre_reservation" | "acquisition" | "patrimony" | "documents" | "profile";

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const tabs = [
  { id: "home" as NavTab, label: "Inicio", icon: Home },
  { id: "acquisition" as NavTab, label: "Adquisición", icon: ShoppingBag },
  { id: "patrimony" as NavTab, label: "Patrimonio", icon: Wallet },
  { id: "documents" as NavTab, label: "Documentos", icon: FileText },
  { id: "profile" as NavTab, label: "Perfil", icon: User },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const counts = useUnreadCountsByNavTab();
  // Map old "property" notif bucket onto the acquisition tab.
  const tabUnread: Record<NavTab, number> = {
    home: counts.home ?? 0,
    pre_reservation: 0,
    acquisition: counts.property ?? 0,
    patrimony: 0,
    documents: counts.documents ?? 0,
    profile: counts.profile ?? 0,
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const unread = tabUnread[tab.id] ?? 0;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isActive && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-all ${isActive ? "scale-110" : ""}`} />
                {unread > 0 && (
                  <span
                    className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-destructive border border-card"
                    aria-label={`${unread} sin leer`}
                  />
                )}
              </div>
              <span className={`text-[10px] font-semibold ${isActive ? "text-primary" : ""}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
// Re-export for convenience (counts used by Sidebar too)
export const getCategoryCounts = () => ({
  acquisition: filterPortfolioByCategory(mockPortfolio, "in_acquisition").length,
  patrimony: filterPortfolioByCategory(mockPortfolio, "active_patrimony").length,
});
