import { useState } from "react";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, Inbox, FileText, Bell, Archive, Stamp,
  ArrowLeft, LogOut, Menu, LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { APP_VERSION, SOZU_LOGO_URL } from "@/lib/config";
import { mockNotifications } from "@/data/legalFlow/mockData";

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const BASE = "/admin/legal-flow";

const navGroups: NavGroup[] = [
  {
    label: "Operaciones",
    items: [
      { label: "Panel de Operaciones", path: BASE,                               icon: LayoutDashboard, end: true },
      { label: "Solicitudes Legales",  path: `${BASE}/requests`,                 icon: Inbox },
    ],
  },
  {
    label: "Escrituración",
    items: [
      { label: "Expedientes", path: `${BASE}/escrituracion/expedientes`, icon: Stamp },
    ],
  },
  {
    label: "Registro Legal",
    items: [
      { label: "Catálogo de Plantillas", path: `${BASE}/templates`, icon: FileText },
      { label: "Expedientes Archivados", path: `${BASE}/archived`,  icon: Archive },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Notificaciones", path: `${BASE}/notifications`, icon: Bell },
    ],
  },
];

const ROUTE_LABELS: Record<string, string> = {
  "/admin/legal-flow":                              "Panel de Operaciones",
  "/admin/legal-flow/requests":                     "Solicitudes Legales",
  "/admin/legal-flow/requests/new":                 "Nueva Solicitud",
  "/admin/legal-flow/templates":                    "Catálogo de Plantillas",
  "/admin/legal-flow/escrituracion/expedientes":    "Escrituración · Expedientes",
  "/admin/legal-flow/archived":                     "Expedientes Archivados",
  "/admin/legal-flow/notifications":                "Notificaciones",
  "/admin/legal-flow/settings":                     "Configuración",
};

export function LegalFlowLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const unreadCount = mockNotifications.filter((n) => !n.read).length;
  const isSuperAdmin = profile?.rol_id === 1;
  const currentLabel = ROUTE_LABELS[location.pathname] || "Expediente";

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Legal";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join("") || "U";

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const go = (path: string) => { navigate(path); setMobileOpen(false); };

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <img src={SOZU_LOGO_URL} alt="SOZU" className="h-6 w-auto object-contain object-left dark:invert" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal Legal Flow
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path, item.end);
                return (
                  <button
                    key={item.path}
                    onClick={() => go(item.path)}
                    className={cn(
                      "group relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 text-left",
                      active
                        ? "bg-primary/[0.06] text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <span className={cn(
                      "absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary transition-opacity duration-150",
                      active ? "opacity-100" : "opacity-0"
                    )} />
                    <item.icon className={cn(
                      "size-4 shrink-0",
                      active ? "" : "opacity-60 group-hover:opacity-100 transition-opacity duration-150"
                    )} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-1 pb-4 border-t border-border-soft space-y-1">
        <div className="w-full flex items-center gap-3 px-2 py-2 rounded-md">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{userName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userRole}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {isSuperAdmin && (
            <button
              onClick={() => go("/admin")}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Regresar
            </button>
          )}
          <button
            onClick={() => signOut()}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10 transition-colors",
              isSuperAdmin ? "flex-1" : "w-full"
            )}
          >
            <LogOut className="size-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/40 font-mono text-center pt-0.5">{APP_VERSION}</p>
      </div>
    </>
  );

  return (
    <PortalTrackingProvider portal="legal-flow">
      <div className="min-h-screen flex antialiased">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col border-r border-border bg-sidebar fixed inset-y-0 left-0 z-30 w-64">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64 flex flex-col bg-sidebar">
            {sidebar}
          </SheetContent>
        </Sheet>

        <div className="flex-1 lg:pl-64 min-w-0">
          {/* Desktop header */}
          <header className="hidden lg:flex h-14 items-center justify-between border-b border-border-soft bg-card px-6 shrink-0 sticky top-0 z-10">
            <div className="flex items-center text-[13px] text-muted-foreground gap-1.5">
              <span className="font-medium text-foreground">Portal Legal Flow</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{currentLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin/legal-flow/notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent"
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-[16px] w-[16px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </header>

          {/* Mobile header */}
          <header className="flex lg:hidden flex-col sticky top-0 z-20 bg-card border-b border-border">
            <div className="flex items-center px-4 pt-3 pb-2 gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-1.5 -ml-1 rounded-md text-foreground hover:bg-muted transition-colors"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-foreground tracking-tight truncate">{currentLabel}</p>
              </div>
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shrink-0">
                {initials}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto"><Outlet /></main>
        </div>
      </div>
    </PortalTrackingProvider>
  );
}
