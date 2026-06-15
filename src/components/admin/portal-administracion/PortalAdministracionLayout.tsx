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
import { APP_VERSION, SOZU_LOGO_URL } from "@/lib/config";
import { AdministracionFiltersProvider } from "@/contexts/AdministracionFiltersContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
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

export const PortalAdministracionLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSuperAdmin = profile?.rol_nombre === "Super Administrador";

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

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Administración";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join("") || "U";

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <img src={SOZU_LOGO_URL} alt="SOZU" className="h-6 w-auto object-contain object-left dark:invert" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal Administración
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
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
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
              onClick={() => handleNavigate("/admin")}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Regresar
            </button>
          )}
          <button
            onClick={signOut}
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
    <PortalTrackingProvider portal="admin">
      <AdministracionFiltersProvider>
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
                  <p className="text-[15px] font-semibold text-foreground tracking-tight truncate">{currentSection}</p>
                </div>
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shrink-0">
                  {initials}
                </div>
              </div>
            </header>

            <main className="p-4 lg:px-10 lg:py-8 bg-background min-h-screen">
              {!ROUTES_SIN_FILTER_BAR.some((r) => location.pathname.startsWith(r)) && (
                <GlobalFilterBar />
              )}
              <Outlet />
            </main>
          </div>
        </div>
      </AdministracionFiltersProvider>
    </PortalTrackingProvider>
  );
};

export default PortalAdministracionLayout;
