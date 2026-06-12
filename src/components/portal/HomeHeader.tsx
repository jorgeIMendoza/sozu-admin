import { Menu, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import sozuLogo from "@/assets/sozu-logo.png";
import { useUnreadCount } from "@/lib/offers/notification-data";

interface HomeHeaderProps {
  onMenuOpen: () => void;
}

const HomeHeader = ({ onMenuOpen }: HomeHeaderProps) => {
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();

  return (
    <header className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-5 h-14">
        <div className="flex items-center">
          <img
            src={sozuLogo}
            alt="SOZU"
            className="h-5 w-auto object-contain dark:invert"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/notificaciones")}
            aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={onMenuOpen}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            aria-label="Menú"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default HomeHeader;
