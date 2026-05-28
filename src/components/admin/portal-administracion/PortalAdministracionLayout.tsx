import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Inbox,
  Workflow,
  FileOutput,
  HandCoins,
  Users,
  CheckCircle2,
  FileText,
  GitMerge,
  BarChart3,
  ArrowLeft,
  LogOut,
  Menu,
  LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { APP_VERSION } from "@/lib/config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdministracionFiltersProvider } from "@/contexts/AdministracionFiltersContext";
import { GlobalFilterBar } from "./GlobalFilterBar";

const ROUTES_SIN_FILTER_BAR = [
  "/admin/portal-administracion/dashboard",
  "/admin/portal-administracion/notificaciones",
  "/admin/portal-administracion/bandeja-ejecucion",
  "/admin/portal-administracion/ciclo-venta",
  "/admin/portal-administracion/facturas-por-cobrar",
  "/admin/portal-administracion/facturas-por-pagar",
  "/admin/portal-administracion/comisiones-externas",
  "/admin/portal-administracion/comisiones-internas",
  "/admin/portal-administracion/pagos-ejecutados",
  "/admin/portal-administracion/cfdis-emitidos",
  "/admin/portal-administracion/conciliacion-stp",
  "/admin/portal-administracion/reportes",
];

type NavLeaf = { label: string; path: string; icon: LucideIcon };

interface NavGroup {
  label: string;
  items: NavLeaf[];
}

// El cockpit de Administración EJECUTA decisiones que Dirección ya validó.
// Por eso la taxonomía agrupa por fase del flujo operativo (Ejecución,
// Pagos y Cobranza, Historial) en lugar de calcar el sidebar de Alta Dirección.
const navGroups: NavGroup[] = [
  {
    label: "Ejecución",
    items: [
      { label: "Bandeja de Ejecución", path: "/admin/portal-administracion/bandeja-ejecucion", icon: Inbox },
      { label: "Ciclo de Venta",       path: "/admin/portal-administracion/ciclo-venta",       icon: Workflow },
    ],
  },
  {
    label: "Pagos y Cobranza",
    items: [
      { label: "Facturas por Cobrar", path: "/admin/portal-administracion/facturas-por-cobrar", icon: FileOutput },
      { label: "Facturas por Pagar",  path: "/admin/portal-administracion/facturas-por-pagar",  icon: Inbox },
      { label: "Comisiones Externas", path: "/admin/portal-administracion/comisiones-externas", icon: HandCoins },
      { label: "Comisiones Internas", path: "/admin/portal-administracion/comisiones-internas", icon: Users },
    ],
  },
  {
    label: "Historial",
    items: [
      { label: "Pagos Ejecutados", path: "/admin/portal-administracion/pagos-ejecutados", icon: CheckCircle2 },
      { label: "CFDIs Emitidos",   path: "/admin/portal-administracion/cfdis-emitidos",   icon: FileText },
      { label: "Conciliación STP", path: "/admin/portal-administracion/conciliacion-stp", icon: GitMerge },
    ],
  },
  {
    label: "Administración",
    items: [
      { label: "Reportes", path: "/admin/portal-administracion/reportes", icon: BarChart3 },
    ],
  },
];

// Diferenciación visual respecto a Alta Dirección (que es bg-primary verde).
const BADGE_CLASS = "bg-teal-600 text-white";
const AVATAR_CLASS = "bg-teal-600 text-white";

export const PortalAdministracionLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const currentSection = (() => {
    for (const g of navGroups) {
      for (const item of g.items) {
        if (isActive(item.path)) return item.label;
      }
    }
    return "Administración";
  })();

  const userName = profile?.nombre || profile?.email || "Usuario";
  const initials =
    userName.split(" ").filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "U";

  const sidebar = (
    <>
      <div className="px-4 pt-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shrink-0",
            BADGE_CLASS,
          )}>
            S
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground leading-tight">SOZU</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Administración</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-teal-600/10 text-teal-700 dark:text-teal-300 font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.75} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-2">
        <div className="min-w-0 px-1">
          <p className="text-xs text-muted-foreground truncate">{profile?.email || "—"}</p>
          <p className="text-[10px] text-muted-foreground/50 font-mono">{APP_VERSION}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNavigate("/admin")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Menú principal
          </button>
          <button
            onClick={signOut}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </div>
    </>
  );

  return (
    <AdministracionFiltersProvider>
      <div className="min-h-screen flex">
        <aside
          className="hidden lg:flex lg:flex-col border-r border-border bg-card fixed inset-y-0 left-0 z-30"
          style={{ width: 232 }}
        >
          {sidebar}
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-[270px] flex flex-col bg-card">
            {sidebar}
          </SheetContent>
        </Sheet>

        <div className="flex-1 lg:ml-[232px]">
          <header className="hidden lg:flex items-center justify-between sticky top-0 z-20 bg-card border-b border-border px-6 h-14">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="font-medium">Portal de Administración</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{currentSection}</span>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0 text-right">
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">Administración</p>
              </div>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className={cn("text-[13px] font-bold", AVATAR_CLASS)}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          <header className="flex lg:hidden items-center justify-between sticky top-0 z-20 bg-card border-b border-border px-3 h-14">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 -ml-1 rounded-md text-foreground hover:bg-muted transition-colors"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
                  Administración
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight truncate">{currentSection}</p>
              </div>
            </div>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className={cn("text-[12px] font-bold", AVATAR_CLASS)}>
                {initials}
              </AvatarFallback>
            </Avatar>
          </header>

          <main className="p-4 lg:px-10 lg:py-8 bg-background min-h-[calc(100vh-56px)]">
            {!ROUTES_SIN_FILTER_BAR.some((r) => location.pathname.startsWith(r)) && (
              <GlobalFilterBar />
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </AdministracionFiltersProvider>
  );
};

export default PortalAdministracionLayout;
