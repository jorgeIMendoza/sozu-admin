import { useState, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCrmSubmenus } from "@/hooks/useCrmSubmenus";
import {
  LayoutDashboard,
  Bell,
  ShieldCheck,
  Zap,
  ArrowLeft,
  LogOut,
  Menu,
  Users,
  Briefcase,
  Calendar,
  ListTodo,
  Workflow,
  Route as RouteIcon,
  Cog,
  AlertTriangle,
  Sparkles,
  UserCheck,
  BarChart3,
  Megaphone,
  Users2,
  GitBranch,
  Image as ImageIcon,
  Link2,
  FlaskConical,
  LayoutTemplate,
  FileInput,
  Plug,
  Wallet,
  Target,
  LineChart as LineChartIcon,
  Activity,
  Briefcase as BriefcaseIcon,
  Layers,
  TrendingDown,
  FileText,
  Inbox as InboxIcon,
  ListChecks,
  Timer,
  UserCog,
  KeyRound,
  SlidersHorizontal,
  ListTree,
  Webhook,
  Plug2,
  FileClock,
  RefreshCw,
  ChevronRight,
  Phone,
  User,
  LucideIcon,
  Facebook,
  Search as SearchIcon,
  Building2,
  Wand2,
  Bot,
  Settings,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { APP_VERSION, SOZU_LOGO_URL } from "@/lib/config";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CrmImpersonationSelector } from "./CrmImpersonationSelector";
import { CrmOrgSwitcher } from "./CrmOrgSwitcher";

const sozuLogo = SOZU_LOGO_URL;

interface NavItem { label: string; path: string; icon: LucideIcon }
interface NavGroup { label: string; items: NavItem[] }

// Icons por ruta — única fuente hardcodeada (los icons no pueden venir de DB)
const PATH_ICONS: Record<string, LucideIcon> = {
  "/admin/portal-crm/dashboard":                              LayoutDashboard,
  "/admin/portal-crm/alertas":                                Bell,
  "/admin/portal-crm/salud-tracking":                         ShieldCheck,
  "/admin/portal-crm/eventos-conversion":                     Zap,
  "/admin/portal-crm/direccion/dashboard":                    LayoutDashboard,
  "/admin/portal-crm/direccion/cola-decisiones":              Activity,
  "/admin/portal-crm/direccion/resumen-semanal":              Sparkles,
  "/admin/portal-crm/ventas/contactos":                       Users,
  "/admin/portal-crm/ventas/negocios":                        Briefcase,
  "/admin/portal-crm/ventas/tareas":                          ListTodo,
  "/admin/portal-crm/ventas/citas":                           Calendar,
  "/admin/portal-crm/ventas/rendimiento-asesores":            UserCheck,
  "/admin/portal-crm/ventas/inteligencia-prospectos":         Sparkles,
  "/admin/portal-crm/ventas/asignacion":                      RouteIcon,
  "/admin/portal-crm/ventas/operacion-comercial":             BarChart3,
  "/admin/portal-crm/ventas/reglas-automatizacion":           Cog,
  "/admin/portal-crm/ventas/secuencias":                      Workflow,
  "/admin/portal-crm/ventas/escalamientos":                   AlertTriangle,
  "/admin/portal-crm/marketing/rendimiento":                  Activity,
  "/admin/portal-crm/marketing/atribucion":                   GitBranch,
  "/admin/portal-crm/marketing/campanas":                     Megaphone,
  "/admin/portal-crm/marketing/creativos":                    ImageIcon,
  "/admin/portal-crm/marketing/meta":                         Facebook,
  "/admin/portal-crm/marketing/google":                       SearchIcon,
  "/admin/portal-crm/marketing/desarrollos":                  Building2,
  "/admin/portal-crm/marketing/embudo":                       Activity,
  "/admin/portal-crm/marketing/mapeo-campanas":               Megaphone,
  "/admin/portal-crm/marketing/sincronizaciones":             RefreshCw,
  "/admin/portal-crm/marketing/audiencias":                   Users2,
  "/admin/portal-crm/marketing/utms":                         Link2,
  "/admin/portal-crm/marketing/pruebas-ab":                   FlaskConical,
  "/admin/portal-crm/marketing/paginas-aterrizaje":           LayoutTemplate,
  "/admin/portal-crm/marketing/formularios":                  FileInput,
  "/admin/portal-crm/marketing/integraciones":                Plug,
  "/admin/portal-crm/marketing/presupuesto":                  Wallet,
  "/admin/portal-crm/ingresos/pronostico":                    LineChartIcon,
  "/admin/portal-crm/ingresos/atribucion":                    GitBranch,
  "/admin/portal-crm/ingresos/velocidad":                     Zap,
  "/admin/portal-crm/ingresos/metas":                         Target,
  "/admin/portal-crm/ingresos/kpis-ejecutivos":               BarChart3,
  "/admin/portal-crm/ingresos/revision-pipeline":             Layers,
  "/admin/portal-crm/ingresos/operaciones":                   BriefcaseIcon,
  "/admin/portal-crm/ingresos/cohortes":                      Users2,
  "/admin/portal-crm/ingresos/desercion":                     TrendingDown,
  "/admin/portal-crm/ingresos/reportes":                      FileText,
  "/admin/portal-crm/operacion/constructor":                  Wand2,
  "/admin/portal-crm/operacion/copiloto":                     Bot,
  "/admin/portal-crm/operacion/desarrollos":                  Building2,
  "/admin/portal-crm/operacion/bandeja":                      InboxIcon,
  "/admin/portal-crm/operacion/colas":                        ListChecks,
  "/admin/portal-crm/operacion/sla":                          Timer,
  "/admin/portal-crm/configuracion/conexiones":               Plug,
  "/admin/portal-crm/configuracion/preparacion-despliegue":   ShieldCheck,
  "/admin/portal-crm/configuracion/registros-api":            FileClock,
  "/admin/portal-crm/configuracion/checklist-integracion":    ListChecks,
  "/admin/portal-crm/configuracion/organizacion":             Settings,
  "/admin/portal-crm/configuracion/usuarios":                 UserCog,
  "/admin/portal-crm/configuracion/desarrollos":              Building2,
  "/admin/portal-crm/configuracion/pipelines":                Briefcase,
  "/admin/portal-crm/configuracion/roles":                    KeyRound,
  "/admin/portal-crm/configuracion/etapas-pipeline":          ListTree,
  "/admin/portal-crm/configuracion/campos-personalizados":    SlidersHorizontal,
  "/admin/portal-crm/configuracion/webhooks":                 Webhook,
  "/admin/portal-crm/configuracion/auditoria":                FileClock,
};

// Segmento de ruta → etiqueta de sección en el sidebar
const SEGMENT_LABEL: Record<string, string> = {
  dashboard:         "Resumen",
  alertas:           "Resumen",
  "salud-tracking":  "Tracking y conversiones",
  "eventos-conversion": "Tracking y conversiones",
  direccion:         "Dirección",
  ventas:            "CRM",
  marketing:         "Inteligencia de marketing",
  ingresos:          "Inteligencia de ingresos",
  operacion:         "Operación",
  configuracion:     "Configuración",
};

const GROUP_ORDER = [
  "Resumen",
  "Dirección",
  "CRM",
  "Inteligencia de marketing",
  "Tracking y conversiones",
  "Inteligencia de ingresos",
  "Operación",
  "Configuración",
];

function getGroupLabel(path: string): string {
  const segment = path.replace("/admin/portal-crm/", "").split("/")[0];
  return SEGMENT_LABEL[segment] ?? "Resumen";
}

function truncateName(full: string, max = 22): string {
  const parts = full.trim().split(/\s+/);
  const short = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : (parts[0] ?? full);
  return short.length > max ? short.slice(0, max - 1).trimEnd() + "…" : short;
}

export const PortalCRMLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const { isPathAllowed, allowedPaths, isSuperAdmin, isLoading: isLoadingPerms, error: permsError, refetch } = useAllowedMenus();
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const { data: crmSubmenus, isLoading: isLoadingSubmenus } = useCrmSubmenus();

  const { data: myPersonaData } = useQuery({
    queryKey: ["crm-my-persona", profile?.id_persona],
    queryFn: async () => {
      if (!profile?.id_persona) return null;
      const { data } = await supabase
        .from("personas")
        .select("nombre_legal, clave_pais_telefono, telefono")
        .eq("id", profile.id_persona)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id_persona,
  });

  const myRawName = myPersonaData?.nombre_legal || profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = truncateName(myRawName);
  const userRole = profile?.rol_nombre ?? "CRM";
  const myPhone = myPersonaData?.clave_pais_telefono && myPersonaData?.telefono
    ? `${myPersonaData.clave_pais_telefono} ${myPersonaData.telefono}`
    : myPersonaData?.telefono ?? undefined;

  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "U";

  const visibleGroups = useMemo<NavGroup[]>(() => {
    if (isLoadingPerms || isLoadingSubmenus || !crmSubmenus) return [];

    const grouped = new Map<string, NavItem[]>();
    for (const s of crmSubmenus) {
      const icon = PATH_ICONS[s.vista_front_end];
      if (!icon) continue;
      if (!isPathAllowed(s.vista_front_end)) continue;
      const groupLabel = getGroupLabel(s.vista_front_end);
      if (!grouped.has(groupLabel)) grouped.set(groupLabel, []);
      grouped.get(groupLabel)!.push({ label: s.nombre, path: s.vista_front_end, icon });
    }

    return GROUP_ORDER
      .filter((g) => grouped.has(g))
      .map((g) => ({ label: g, items: grouped.get(g)! }));
  }, [crmSubmenus, isLoadingPerms, isLoadingSubmenus, allowedPaths, isSuperAdmin]);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const currentSection =
    visibleGroups
      .flatMap((g) => g.items)
      .find((i) => isActive(i.path))?.label || "Panel principal";

  const profilePopoverContent = (onClose: () => void) => (
    <PopoverContent align="end" sideOffset={8} className="w-60 p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border-soft bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-[13px] font-semibold text-foreground truncate">{userName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userRole}</p>
            {myPhone && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Phone className="size-3 shrink-0" />
                {myPhone}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="p-1.5 space-y-0.5">
        <button
          onClick={() => { navigate("/admin/portal-crm/perfil"); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-foreground hover:bg-muted/60 transition-colors duration-150"
        >
          <User className="size-4 text-muted-foreground shrink-0" />
          Ver perfil
        </button>
        <button
          onClick={() => { signOut(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-destructive hover:bg-destructive/10 transition-colors duration-150"
        >
          <LogOut className="size-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </PopoverContent>
  );

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <img src={sozuLogo} alt="SOZU" className="h-6 w-auto object-contain object-left dark:invert" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal CRM
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {(isLoadingPerms || isLoadingSubmenus) && (
          <div className="space-y-4 px-1 pt-1">
            {[0, 1, 2].map((g) => (
              <div key={g} className="space-y-1.5">
                <Skeleton className="h-3 w-24 mx-1" />
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-md" />
                ))}
              </div>
            ))}
          </div>
        )}

        {!isLoadingPerms && !isLoadingSubmenus && permsError && (
          <div className="mx-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-xs font-semibold">No se pudieron cargar los permisos</p>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-3">{permsError}</p>
            <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3 mr-1.5" /> Reintentar
            </Button>
          </div>
        )}

        {!isLoadingPerms && !isLoadingSubmenus && !permsError && visibleGroups.length === 0 && (
          <div className="mx-1 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Tu rol no tiene submenús habilitados en este portal. Contacta a un administrador.
            </p>
          </div>
        )}

        {!isLoadingPerms && !isLoadingSubmenus && !permsError && visibleGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
              {group.label}
            </p>
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
                  <span
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary transition-opacity duration-150",
                      active ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <item.icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "" : "opacity-60 group-hover:opacity-100 transition-opacity duration-150"
                    )}
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-1 pb-4 border-t border-border-soft space-y-1">
        <button
          onClick={() => navigate("/admin/portal-crm/perfil")}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors group/profile"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{userName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userRole}</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover/profile:opacity-100 transition-opacity" />
        </button>

        <div className="flex gap-2">
          {canReturnToAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Regresar
            </button>
          )}
          <button
            onClick={signOut}
            className={`${canReturnToAdmin ? "flex-1" : "w-full"} flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10 transition-colors`}
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
    <PortalTrackingProvider portal="crm">
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
          {/* Desktop header — mismo diseño que TopBar del portal cliente */}
          <header className="hidden lg:flex sticky top-0 z-20 h-16 items-center gap-4 px-6 lg:px-8 bg-card border-b border-border-soft">
            <CrmOrgSwitcher />

            {/* Impersonation selector — self-guards for superadmin */}
            {isSuperAdmin && <CrmImpersonationSelector />}

            {/* Avatar + perfil — pushed to right */}
            <div className="flex items-center gap-2 ml-auto">
              <Popover open={profileOpen} onOpenChange={setProfileOpen}>
                <PopoverTrigger asChild>
                  <button
                    aria-label="Perfil de usuario"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                  >
                    {initials}
                  </button>
                </PopoverTrigger>
                {profilePopoverContent(() => setProfileOpen(false))}
              </Popover>
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
                <p className="text-[15px] font-semibold text-foreground tracking-tight truncate">{currentSection}</p>
              </div>
              <Popover open={mobileProfileOpen} onOpenChange={setMobileProfileOpen}>
                <PopoverTrigger asChild>
                  <button
                    aria-label="Mi perfil"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                  >
                    {initials}
                  </button>
                </PopoverTrigger>
                {profilePopoverContent(() => setMobileProfileOpen(false))}
              </Popover>
            </div>

            <div className="px-4 pb-3">
              <CrmOrgSwitcher className="w-full max-w-none" />
            </div>
            {isSuperAdmin && (
              <div className="px-4 pb-3">
                <CrmImpersonationSelector />
              </div>
            )}
          </header>

          <main className="px-8 py-4 bg-background min-h-[calc(100vh-64px)]">
            <Outlet />
          </main>
        </div>
      </div>
    </PortalTrackingProvider>
  );
};

export default PortalCRMLayout;
