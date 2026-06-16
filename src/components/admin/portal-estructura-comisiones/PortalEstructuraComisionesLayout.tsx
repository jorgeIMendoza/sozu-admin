import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Network, Users2, Workflow, Coins, FileSliders,
  Calculator, Trophy, FlaskConical, GitCompare, PieChart, Wallet, CalendarRange,
  TrendingUp, BarChart3, Target, Boxes, Briefcase, Sparkles, Crown,
  ArrowLeft, LogOut, ChevronDown, ChevronRight, Menu, LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectAdminImpersonation } from "@/contexts/ProjectAdminImpersonationContext";
import { ProjectAdminImpersonationSelector } from "./ProjectAdminImpersonationSelector";
import { SimulatorProvider } from "@/lib/portal-estructura-comisiones/stores/SimulatorContext";
import { InventoryProvider } from "@/lib/portal-estructura-comisiones/stores/InventoryContext";
import { CompetitorsProvider } from "@/lib/portal-estructura-comisiones/stores/CompetitorsContext";
import { APP_VERSION, SOZU_LOGO_URL } from "@/lib/config";

interface NavLeaf { label: string; path: string; icon: LucideIcon }
interface NavParent { label: string; icon: LucideIcon; children: { label: string; path: string }[] }
type NavItem = NavLeaf | NavParent;
interface NavGroup { label: string; items: NavItem[] }
const isParent = (i: NavItem): i is NavParent => "children" in i;

const BASE = "/admin/portal-estructura-comisiones";

const navGroups: NavGroup[] = [
  {
    label: "Resumen",
    items: [
      { label: "Resumen Ejecutivo", path: `${BASE}/dashboard`, icon: LayoutDashboard },
      { label: "Dashboard Ejecutivo", path: `${BASE}/executive`, icon: Crown },
    ],
  },
  {
    label: "Configuración",
    items: [
      { label: "Proyectos", path: `${BASE}/projects`, icon: Building2 },
      { label: "Canales de Venta", path: `${BASE}/channels`, icon: Network },
      { label: "Organigrama", path: `${BASE}/org-chart`, icon: Users2 },
      { label: "Roles y Sueldos", path: `${BASE}/structure`, icon: Workflow },
    ],
  },
  {
    label: "Estructura de Comisiones",
    items: [
      { label: "Distribución de Comisiones", path: `${BASE}/commissions`, icon: Coins },
      { label: "Políticas de Pago", path: `${BASE}/payment-policies`, icon: FileSliders },
      { label: "Comisión por Unidad", path: `${BASE}/unit-commission`, icon: Calculator },
      { label: "Incentivos Dinámicos", path: `${BASE}/broker-incentives`, icon: Trophy },
    ],
  },
  {
    label: "Simulación",
    items: [
      {
        label: "Simuladores",
        icon: FlaskConical,
        children: [
          { label: "Escenarios", path: `${BASE}/scenarios` },
          { label: "Comparador de Escenarios", path: `${BASE}/comm-simulator` },
          { label: "Simulador de Distribución", path: `${BASE}/dist-simulator` },
          { label: "Ingresos Mensuales", path: `${BASE}/broker-calc` },
          { label: "Calculadora Broker", path: `${BASE}/broker-calculator` },
          { label: "Simulador Financiero", path: `${BASE}/financial-simulator` },
          { label: "Flujo Comercial", path: `${BASE}/monthly-flow` },
        ],
      },
    ],
  },
  {
    label: "Resultados",
    items: [
      { label: "Resultados Financieros", path: `${BASE}/results`, icon: PieChart },
      { label: "Costo Comercial", path: `${BASE}/compensation`, icon: Wallet },
    ],
  },
  {
    label: "Análisis",
    items: [
      { label: "Competitividad Comercial", path: `${BASE}/competitividad`, icon: TrendingUp },
      { label: "Benchmark de Mercado", path: `${BASE}/benchmark`, icon: BarChart3 },
      { label: "Benchmark Competidores", path: `${BASE}/competitors-benchmark`, icon: Target },
      { label: "Inventario Avanzado", path: `${BASE}/inventory-advanced`, icon: Boxes },
    ],
  },
  {
    label: "Portales",
    items: [
      { label: "Portal de Agentes", path: `${BASE}/agent-portal`, icon: Briefcase },
      {
        label: "Embajadores",
        icon: Sparkles,
        children: [
          { label: "Gestión de Embajadores", path: `${BASE}/ambassadors-admin` },
          { label: "Portal del Embajador", path: `${BASE}/ambassadors-portal` },
        ],
      },
    ],
  },
];

const SECTION_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const g of navGroups) {
    for (const it of g.items) {
      if (isParent(it)) it.children.forEach(c => { map[c.path] = c.label; });
      else map[it.path] = it.label;
    }
  }
  return map;
})();

export const PortalEstructuraComisionesLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { impersonatedName, impersonatedEmail, isImpersonating } = useProjectAdminImpersonation();
  const isSuperAdmin = profile?.rol_id === 1;
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const currentSection = Object.entries(SECTION_LABELS).find(([p]) => isActive(p))?.[1] || "Estructura de Comisiones";

  const handleNavigate = (path: string) => { navigate(path); setMobileOpen(false); };

  const activeUserName = isImpersonating
    ? impersonatedName || impersonatedEmail || profile?.nombre || profile?.email || "Usuario"
    : profile?.nombre || profile?.email || "Usuario";

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Administrador";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("") || "U";
  const activeInitials = activeUserName.split(" ").filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("") || "U";

  const sidebarContent = (
    <>
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <img src={SOZU_LOGO_URL} alt="SOZU" className="h-6 w-auto object-contain object-left dark:invert" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Estructura de Comisiones
        </p>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                if (isParent(item)) {
                  const groupActive = item.children.some(c => isActive(c.path));
                  const expanded = expandedMenu === item.label || groupActive;
                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => setExpandedMenu(expanded ? null : item.label)}
                        className={cn(
                          "group relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors",
                          groupActive ? "bg-primary/[0.06] text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        <span className={cn("absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary", groupActive ? "opacity-100" : "opacity-0")} />
                        <item.icon className="size-4 shrink-0 opacity-70" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {expanded ? <ChevronDown className="size-3.5 opacity-60" /> : <ChevronRight className="size-3.5 opacity-60" />}
                      </button>
                      {expanded && (
                        <div className="mt-0.5 ml-7 space-y-0.5">
                          {item.children.map(child => {
                            const childActive = isActive(child.path);
                            return (
                              <button
                                key={child.path}
                                onClick={() => handleNavigate(child.path)}
                                className={cn(
                                  "w-full flex items-center px-3 py-1.5 rounded-md text-[13px] font-medium text-left",
                                  childActive ? "bg-primary/[0.06] text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
                      "group relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium text-left",
                      active ? "bg-primary/[0.06] text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <span className={cn("absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary", active ? "opacity-100" : "opacity-0")} />
                    <item.icon className="size-4 shrink-0 opacity-70" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pt-1 pb-4 border-t border-border-soft space-y-1">
        <div className="w-full flex items-center gap-3 px-2 py-2 rounded-md">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
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
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <ArrowLeft className="size-4" /> Regresar
            </button>
          )}
          <button
            onClick={signOut}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10",
              isSuperAdmin ? "flex-1" : "w-full"
            )}
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 font-mono text-center pt-0.5">{APP_VERSION}</p>
      </div>
    </>
  );

  return (
    <SimulatorProvider>
      <InventoryProvider>
        <CompetitorsProvider>
          <div className="min-h-screen flex antialiased">
            <aside className="hidden lg:flex lg:flex-col border-r border-border bg-sidebar fixed inset-y-0 left-0 z-30 w-64">
              {sidebarContent}
            </aside>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="p-0 w-64 flex flex-col bg-sidebar">
                {sidebarContent}
              </SheetContent>
            </Sheet>

            <div className="flex-1 lg:pl-64 min-w-0">
              <header className="hidden lg:flex items-center justify-between sticky top-0 z-20 bg-card border-b border-border-soft px-6 h-14">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <span className="font-medium">Estructura de Comisiones</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{currentSection}</span>
                </div>
                <div className="flex items-center gap-3">
                  {isSuperAdmin && <ProjectAdminImpersonationSelector />}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0 text-right">
                      <p className="text-sm font-medium text-foreground truncate">{activeUserName}</p>
                      <p className="text-xs text-muted-foreground truncate">Admin de Proyectos</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-semibold">
                      {activeInitials}
                    </div>
                  </div>
                </div>
              </header>

              <header className="flex lg:hidden items-center justify-between sticky top-0 z-20 bg-card border-b border-border px-3 h-14">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setMobileOpen(true)} className="p-2 -ml-1 rounded-md text-foreground hover:bg-muted" aria-label="Abrir menú">
                    <Menu className="h-5 w-5" />
                  </button>
                  <p className="text-[15px] font-semibold text-foreground tracking-tight truncate">{currentSection}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
                  {initials}
                </div>
              </header>

              <main className="p-4 lg:px-10 lg:py-8 bg-background min-h-[calc(100vh-56px)]">
                <Outlet />
              </main>
            </div>
          </div>
        </CompetitorsProvider>
      </InventoryProvider>
    </SimulatorProvider>
  );
};

export default PortalEstructuraComisionesLayout;