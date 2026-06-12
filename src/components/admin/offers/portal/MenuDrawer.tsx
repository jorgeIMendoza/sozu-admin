import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Home, ShoppingBag, Wallet, User, Bell, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { NavTab } from "./BottomNav";
import sozuLogo from "@/assets/sozu-logo.png";
import { useUnreadCount } from "@/lib/offers/notification-data";
import {
  getAllAdvisors,
  buildContextualWhatsAppMessage,
  buildWhatsAppLink,
} from "@/lib/offers/advisor-data";

interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
}

const MenuDrawer = ({ open, onClose, onNavigate }: MenuDrawerProps) => {
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();

  const items = [
    { icon: Home, label: "Inicio", tab: "home" as NavTab },
    { icon: ShoppingBag, label: "En adquisición", tab: "acquisition" as NavTab },
    { icon: Wallet, label: "Mi patrimonio", tab: "patrimony" as NavTab },
    { icon: User, label: "Mi perfil", tab: "profile" as NavTab },
  ];

  const handleNotificationsClick = () => {
    onClose();
    navigate("/notificaciones");
  };

  const handleContactAdvisor = () => {
    const advisors = getAllAdvisors();
    const advisor = advisors[0];
    if (!advisor) return;
    const message = buildContextualWhatsAppMessage(
      {
        propertyId: "",
        propertyName: "Portal SOZU",
        unitNumber: "",
        flowName: "Consulta general desde menú",
      },
      advisor.name,
    );
    const link = buildWhatsAppLink(advisor, message);
    window.open(link, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-72">
        <SheetHeader className="text-left pb-6 pt-2">
          <SheetTitle asChild>
            <div className="flex items-center">
              <img
                src={sozuLogo}
                alt="SOZU"
                className="h-6 w-auto object-contain dark:invert"
              />
            </div>
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Portal del inversionista</p>
        </SheetHeader>

        <nav className="space-y-1">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                onNavigate(item.tab);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent transition-colors"
            >
              <item.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}

          <button
            onClick={handleNotificationsClick}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent transition-colors"
          >
            <span className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Notificaciones</span>
            </span>
            {unreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </nav>

        <div className="my-4 border-t border-border" />

        <nav className="space-y-1">
          <button
            onClick={handleContactAdvisor}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span className="text-sm">Contactar asesor</span>
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MenuDrawer;
