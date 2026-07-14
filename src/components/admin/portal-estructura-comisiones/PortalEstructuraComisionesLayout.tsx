import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2, Store, Target, GitBranch, Users, DollarSign, UserCheck,
  SlidersHorizontal, Calculator, TrendingUp, BarChart3, Wallet,
  ArrowLeftRight, Shield, IdCard,
  ArrowLeft, LogOut, Menu, LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import { useEstructuraComisionesSubmenus } from "@/hooks/usePortalEstructuraComisiones/useEstructuraComisionesSubmenus";
import { useProjectAdminImpersonation, ProjectAdminImpersonationProvider } from "@/contexts/ProjectAdminImpersonationContext";
import { ProjectAdminImpersonationSelector } from "./ProjectAdminImpersonationSelector";
import { SimulatorProvider } from "@/lib/portal-estructura-comisiones/stores/SimulatorContext";
import { InventoryProvider } from "@/lib/portal-estructura-comisiones/stores/InventoryContext";
import { CompetitorsProvider } from "@/lib/portal-estructura-comisiones/stores/CompetitorsContext";
import { AmbassadorsProvider as PECAmbassadorsProvider } from "@/lib/portal-estructura-comisiones/stores/AmbassadorsContext";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/SozuLogo";

interface NavItem { label: string; path: string; icon: LucideIcon }
interface NavGroup { label: string; items: NavItem[] }

const BASE = "/admin/portal-estructura-comisiones";

// Los íconos no viven en BD — única fuente hardcodeada, una entrada por cada
// `vista_front_end` real que existe hoy en `submenus` (menu_id=35).
const PATH_ICONS: Record<string, LucideIcon> = {
  [`${BASE}/projects`]: Building2,
  [`${BASE}/channels`]: Store,
  [`${BASE}/benchmark`]: Target,
  [`${BASE}/org-chart`]: GitBranch,
  [`${BASE}/structure`]: Users,
  [`${BASE}/directorio`]: IdCard,
  [`${BASE}/commissions`]: DollarSign,
  [`${BASE}/broker-incentives`]: UserCheck,
  [`${BASE}/scenarios`]: SlidersHorizontal,
  [`${BASE}/dist-simulator`]: DollarSign,
  [`${BASE}/unit-commission`]: Calculator,
  [`${BASE}/monthly-flow`]: TrendingUp,
  [`${BASE}/results`]: BarChart3,
  [`${BASE}/compensation`]: Wallet,
  [`${BASE}/broker-calc`]: UserCheck,
  [`${BASE}/comm-simulator`]: ArrowLeftRight,
  [`${BASE}/competitividad`]: Shield,
};

// `submenus.orden` codifica la sección por el centenar (100=Configuración, ...).
const ORDEN_GROUP_LABEL: Record<number, string> = {
  100: "Configuración",
  200: "Estructura",
  300: "Simulación",
  400: "Resultados",
  500: "Análisis",
};
const GROUP_ORDER = ["Configuración", "Estructura", "Simulación", "Resultados", "Análisis"];

function getGroupLabel(orden: number): string {
  const bucket = Math.floor(orden / 100) * 100;
  return ORDEN_GROUP_LABEL[bucket] ?? "Otros";
}

const PortalEstructuraComisionesLayoutInner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { impersonatedUser, isImpersonating } = useProjectAdminImpersonation();
  const isSuperAdmin = profile?.rol_id === 1;
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { isPathAllowed, isSuperAdmin: hasAllMenus, isLoading: isLoadingPerms } = useAllowedMenus();
  const { data: ecSubmenus, isLoading: isLoadingSubmenus } = useEstructuraComisionesSubmenus();

  const visibleGroups = useMemo<NavGroup[]>(() => {
    if (isLoadingPerms || isLoadingSubmenus || !ecSubmenus) return [];

    const grouped = new Map<string, NavItem[]>();
    for (const s of ecSubmenus) {
      const icon = PATH_ICONS[s.vista_front_end];
      if (!icon) continue;
      if (!isPathAllowed(s.vista_front_end)) continue;
      const groupLabel = getGroupLabel(s.orden);
      if (!grouped.has(groupLabel)) grouped.set(groupLabel, []);
      grouped.get(groupLabel)!.push({ label: s.nombre, path: s.vista_front_end, icon });
    }

    return GROUP_ORDER
      .filter(g => grouped.has(g))
      .map(g => ({ label: g, items: grouped.get(g)! }));
  }, [ecSubmenus, isLoadingPerms, isLoadingSubmenus, isPathAllowed, hasAllMenus]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const currentSection = visibleGroups.flatMap(g => g.items).find(i => isActive(i.path))?.label || "Estructura de comisiones";

  const handleNavigate = (path: string) => { navigate(path); setMobileOpen(false); };

  const activeUserName = isImpersonating
    ? impersonatedUser?.nombre || impersonatedUser?.email || profile?.nombre || profile?.email || "Usuario"
    : profile?.nombre || profile?.email || "Usuario";

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Administrador";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("") || "U";
  const activeInitials = activeUserName.split(" ").filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("") || "U";

  const sidebarContent = (
    <>
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <SozuLogo className="h-6" />
        <p className="text-[10px] font-semibold tracking-[0.18em] text-gray-500">
          Estructura de comisiones
        </p>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {visibleGroups.map(group => (
          <div key={group.label}>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
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
          {canReturnToAdmin && (
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
              canReturnToAdmin ? "flex-1" : "w-full"
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
          <PECAmbassadorsProvider>
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
                  <span className="font-medium">Estructura de comisiones</span>
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

              <main className="px-8 py-4 bg-background min-h-[calc(100vh-56px)]">
                <Outlet />
              </main>
            </div>
          </div>
          </PECAmbassadorsProvider>
        </CompetitorsProvider>
      </InventoryProvider>
    </SimulatorProvider>
  );
};

export const PortalEstructuraComisionesLayout = () => (
  <ProjectAdminImpersonationProvider>
    <PortalEstructuraComisionesLayoutInner />
  </ProjectAdminImpersonationProvider>
);

export default PortalEstructuraComisionesLayout;