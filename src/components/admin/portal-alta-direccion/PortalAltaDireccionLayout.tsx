import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
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
  LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { APP_VERSION } from "@/lib/config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AltaDireccionFiltersProvider } from "@/contexts/AltaDireccionFiltersContext";
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
];

type NavLeaf = { label: string; path: string; icon: LucideIcon };
type NavParent = { label: string; icon: LucideIcon; children: { label: string; path: string }[] };
type NavItem = NavLeaf | NavParent;

interface NavGroup {
  label: string;
  items: NavItem[];
}

const isParent = (i: NavItem): i is NavParent => "children" in i;

const navGroups: NavGroup[] = [
  {
    label: "Comercial",
    items: [
      { label: "Citas Comerciales", path: "/admin/portal-alta-direccion/citas",      icon: CalendarCheck },
      { label: "Prospectos",        path: "/admin/portal-alta-direccion/prospectos", icon: UserSearch },
      { label: "Pipeline",          path: "/admin/portal-alta-direccion/pipeline",   icon: Briefcase },
      // "Ofertas" oculto en esta fase de demo; ruta sigue viva en App.tsx por URL directa.
    ],
  },
  {
    label: "Operación",
    items: [
      { label: "Bandeja de Validaciones", path: "/admin/portal-alta-direccion/bandeja",      icon: Inbox },
      { label: "Ciclo de Venta",          path: "/admin/portal-alta-direccion/ciclo-venta",  icon: Workflow },
      // "Cobranza" y "Contratos" ocultas en esta fase de demo; rutas vivas en App.tsx por URL directa.
      {
        label: "Comisiones",
        icon: Percent,
        children: [
          { label: "Externas", path: "/admin/portal-alta-direccion/comisiones-externas" },
          { label: "Internas", path: "/admin/portal-alta-direccion/comisiones-internas" },
        ],
      },
    ],
  },
  {
    label: "Análisis",
    items: [
      { label: "Histórico Comercial", path: "/admin/portal-alta-direccion/historico-comercial", icon: TrendingUp },
      { label: "Análisis de Cobranza", path: "/admin/portal-alta-direccion/analisis-cobranza", icon: Banknote },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { label: "Ingresos y Egresos", path: "/admin/portal-alta-direccion/ingresos-egresos", icon: ArrowLeftRight },
    ],
  },
  // Sección "Administración" (Reportes / Red Comercial / Auditoría / Configuración)
  // ocultada en esta fase. Las rutas siguen vivas en App.tsx por URL directa.
];

export const PortalAltaDireccionLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const userName = profile?.nombre || profile?.email || "Usuario";
  const initials =
    userName.split(" ").filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "U";

  const sidebar = (
    <>
      <div className="px-4 pt-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shrink-0">
            S
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground leading-tight">SOZU</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Alta Dirección</p>
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
                if (isParent(item)) {
                  const groupActive = item.children.some((c) => isActive(c.path));
                  const expanded = expandedGroups.has(item.label) || groupActive;
                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => toggleGroup(item.label)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-sm font-medium transition-all duration-150",
                          groupActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={groupActive ? 2 : 1.75} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {expanded
                          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                      </button>
                      {expanded && (
                        <div className="mt-0.5 ml-6 space-y-0.5">
                          {item.children.map((child) => {
                            const childActive = isActive(child.path);
                            return (
                              <button
                                key={child.path}
                                onClick={() => handleNavigate(child.path)}
                                className={cn(
                                  "w-full flex items-center px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150",
                                  childActive
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                      "w-full flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary/10 text-primary font-semibold"
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
    <AltaDireccionFiltersProvider>
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
              <span className="font-medium">Portal Alta Dirección</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{currentSection}</span>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0 text-right">
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">Alta Dirección</p>
              </div>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-[13px] font-bold">
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
                  Alta Dirección
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight truncate">{currentSection}</p>
              </div>
            </div>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-[12px] font-bold">
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
    </AltaDireccionFiltersProvider>
  );
};

export default PortalAltaDireccionLayout;