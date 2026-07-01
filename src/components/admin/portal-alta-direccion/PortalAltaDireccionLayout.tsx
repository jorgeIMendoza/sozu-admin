import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarCheck,
  UserSearch,
  Briefcase,
  Percent,
  ArrowLeft,
  ArrowLeftRight,
  LogOut,
  Menu,
  Inbox,
  Workflow,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Banknote,
  Activity,
  BarChart3,
  MousePointerClick,
  SlidersHorizontal,
  LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/SozuLogo";
import { AltaDireccionFiltersProvider } from "@/contexts/AltaDireccionFiltersContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { GlobalFilterBar } from "./GlobalFilterBar";

const ROUTES_SIN_FILTER_BAR = [
  "/admin/portal-alta-direccion/dashboard",
  "/admin/portal-alta-direccion/notificaciones",
  "/admin/portal-alta-direccion/prospectos",
  "/admin/portal-alta-direccion/pipeline",
  "/admin/portal-alta-direccion/bandeja",
  "/admin/portal-alta-direccion/ciclo-venta",
  "/admin/portal-alta-direccion/comisiones-externas",
  "/admin/portal-alta-direccion/comisiones-internas",
  "/admin/portal-alta-direccion/historico-comercial",
  "/admin/portal-alta-direccion/analisis-cobranza",
  "/admin/portal-alta-direccion/ingresos-egresos",
  "/admin/portal-alta-direccion/forecast-ingresos",
  "/admin/portal-alta-direccion/estructura-comisiones",
  "/admin/portal-alta-direccion/mediciones/portales",
  "/admin/portal-alta-direccion/mediciones/menus",
  "/admin/portal-alta-direccion/mediciones/ctas",
];

type NavLeaf   = { label: string; path: string; icon: LucideIcon };
type NavParent = { label: string; icon: LucideIcon; children: { label: string; path: string }[] };
type NavItem   = NavLeaf | NavParent;

interface NavGroup {
  label: string;
  items: NavItem[];
}

const isParent = (i: NavItem): i is NavParent => "children" in i;

const navGroups: NavGroup[] = [
  {
    label: "Resumen",
    items: [
      { label: "Dashboard General", path: "/admin/portal-alta-direccion/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Citas Comerciales", path: "/admin/portal-alta-direccion/citas",      icon: CalendarCheck },
      { label: "Prospectos",        path: "/admin/portal-alta-direccion/prospectos", icon: UserSearch },
      { label: "Pipeline",          path: "/admin/portal-alta-direccion/pipeline",   icon: Briefcase },
    ],
  },
  {
    label: "Operación",
    items: [
      { label: "Bandeja de Validaciones", path: "/admin/portal-alta-direccion/bandeja",      icon: Inbox },
      { label: "Ciclo de Venta",          path: "/admin/portal-alta-direccion/ciclo-venta",  icon: Workflow },
      {
        label: "Comisiones",
        icon: Percent,
        children: [
          { label: "Externas", path: "/admin/portal-alta-direccion/comisiones-externas" },
          { label: "Internas", path: "/admin/portal-alta-direccion/comisiones-internas" },
        ],
      },
      { label: "Estructura de Comisiones", path: "/admin/portal-alta-direccion/estructura-comisiones", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Análisis",
    items: [
      { label: "Histórico Comercial",  path: "/admin/portal-alta-direccion/historico-comercial", icon: TrendingUp },
      { label: "Análisis de Cobranza", path: "/admin/portal-alta-direccion/analisis-cobranza",   icon: Banknote },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { label: "Ingresos y Egresos",   path: "/admin/portal-alta-direccion/ingresos-egresos",   icon: ArrowLeftRight },
      { label: "Forecast de Ingresos", path: "/admin/portal-alta-direccion/forecast-ingresos",  icon: TrendingUp },
    ],
  },
  {
    label: "Mediciones",
    items: [
      { label: "Uso por portal",         path: "/admin/portal-alta-direccion/mediciones/portales", icon: Activity },
      { label: "Mapa de calor de menús", path: "/admin/portal-alta-direccion/mediciones/menus",    icon: BarChart3 },
      { label: "Mapa de calor de CTAs",  path: "/admin/portal-alta-direccion/mediciones/ctas",     icon: MousePointerClick },
    ],
  },
];

export const PortalAltaDireccionLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { isPathAllowed } = useAllowedMenus();
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        const items = group.items
          .map((item) => {
            if (isParent(item)) {
              const children = item.children.filter((c) => isPathAllowed(c.path));
              return children.length ? { ...item, children } : null;
            }
            return isPathAllowed(item.path) ? item : null;
          })
          .filter(Boolean) as NavItem[];
        return items.length ? { ...group, items } : null;
      })
      .filter(Boolean) as NavGroup[];
  }, [isPathAllowed]);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const currentSection = (() => {
    for (const g of navGroups) {
      for (const item of g.items) {
        if (isParent(item)) {
          const child = item.children.find((c) => isActive(c.path));
          if (child) return `${item.label} · ${child.label}`;
        } else if (isActive(item.path)) {
          return item.label;
        }
      }
    }
    return "Alta Dirección";
  })();

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Alta Dirección";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join("") || "U";

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <SozuLogo className="h-6" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal Alta Dirección
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (isParent(item)) {
                  const groupActive = item.children.some((c) => isActive(c.path));
                  const expanded = expandedGroups.has(item.label) || groupActive;
                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => toggleGroup(item.label)}
                        className={cn(
                          "group relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150",
                          groupActive
                            ? "bg-primary/[0.06] text-primary"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        <span className={cn(
                          "absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary transition-opacity duration-150",
                          groupActive ? "opacity-100" : "opacity-0"
                        )} />
                        <item.icon className={cn(
                          "size-4 shrink-0",
                          groupActive ? "" : "opacity-60 group-hover:opacity-100 transition-opacity duration-150"
                        )} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {expanded
                          ? <ChevronDown className="size-3.5 shrink-0 opacity-60" />
                          : <ChevronRight className="size-3.5 shrink-0 opacity-60" />}
                      </button>
                      {expanded && (
                        <div className="mt-0.5 ml-7 space-y-0.5">
                          {item.children.map((child) => {
                            const childActive = isActive(child.path);
                            return (
                              <button
                                key={child.path}
                                onClick={() => handleNavigate(child.path)}
                                className={cn(
                                  "w-full flex items-center px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors duration-150 text-left",
                                  childActive
                                    ? "bg-primary/[0.06] text-primary"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )}
                              >
                                {child.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
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
                    <span className="flex-1 text-left">{item.label}</span>
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
          {/* Regresar al admin panel: Super Admin o quien tenga acceso a menús del admin panel */}
          {canReturnToAdmin && (
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
              canReturnToAdmin ? "flex-1" : "w-full"
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
    <PortalTrackingProvider portal="alta-direccion">
      <AltaDireccionFiltersProvider>
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

            <main className="px-8 py-4 bg-background min-h-screen">
              {!ROUTES_SIN_FILTER_BAR.some((r) => location.pathname.startsWith(r)) && (
                <GlobalFilterBar />
              )}
              <Outlet />
            </main>
          </div>
        </div>
      </AltaDireccionFiltersProvider>
    </PortalTrackingProvider>
  );
};

export default PortalAltaDireccionLayout;
