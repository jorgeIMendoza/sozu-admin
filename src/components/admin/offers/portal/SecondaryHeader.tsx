import { ArrowLeft, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUnreadCount } from "@/lib/offers/notification-data";

interface SecondaryHeaderProps {
  title: string;
  onBack?: () => void;
  /** Si true, oculta la campana (útil en /notificaciones para no duplicar). */
  hideBell?: boolean;
}

const SecondaryHeader = ({ title, onBack, hideBell = false }: SecondaryHeaderProps) => {
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();

  return (
    <header className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center gap-3 px-5 h-14">
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="Volver"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-9 h-9 flex-shrink-0" />
        )}
        <h1 className="flex-1 font-display font-semibold text-base text-foreground truncate">
          {title}
        </h1>
        {!hideBell ? (
          <button
            onClick={() => navigate("/notificaciones")}
            aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors flex-shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        ) : (
          <div className="w-9 h-9 flex-shrink-0" />
        )}
      </div>
    </header>
  );
};

export default SecondaryHeader;
