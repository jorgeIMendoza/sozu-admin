import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CrmImpersonationSelector } from "./CrmImpersonationSelector";
import { CrmOrgSwitcher } from "./CrmOrgSwitcher";

const sozuLogo = SOZU_LOGO_URL;

interface NavItem { label: string; path: string; icon: LucideIcon }
interface NavGroup { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: "Resumen",
    items: [
      { label: "Panel principal", path: "/admin/portal-crm/dashboard", icon: LayoutDashboard },
      { label: "Alertas",         path: "/admin/portal-crm/alertas",   icon: Bell },
    ],
  },
  {
    label: "Dirección",
    items: [
      { label: "Panel ejecutivo",    path: "/admin/portal-crm/direccion/dashboard",     icon: LayoutDashboard },
      { label: "Cola de decisiones", path: "/admin/portal-crm/direccion/cola-decisiones", icon: Activity },
      { label: "Resumen semanal",    path: "/admin/portal-crm/direccion/resumen-semanal",  icon: Sparkles },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Contactos",               path: "/admin/portal-crm/ventas/contactos",          icon: Users },
      { label: "Pipeline",                path: "/admin/portal-crm/ventas/negocios",             icon: Briefcase },
      { label: "Tareas",                  path: "/admin/portal-crm/ventas/tareas",             icon: ListTodo },
      { label: "Citas",                   path: "/admin/portal-crm/ventas/citas",      icon: Calendar },
      { label: "Desempeño de asesores",   path: "/admin/portal-crm/ventas/rendimiento-asesores", icon: UserCheck },
      { label: "Inteligencia de leads",   path: "/admin/portal-crm/ventas/inteligencia-prospectos", icon: Sparkles },
      { label: "Asignación de leads",     path: "/admin/portal-crm/ventas/asignacion",           icon: RouteIcon },
      { label: "Operación comercial",     path: "/admin/portal-crm/ventas/operacion-comercial",  icon: BarChart3 },
      { label: "Reglas de automatización", path: "/admin/portal-crm/ventas/reglas-automatizacion", icon: Cog },
      { label: "Secuencias",              path: "/admin/portal-crm/ventas/secuencias",         icon: Workflow },
      { label: "Escalaciones",            path: "/admin/portal-crm/ventas/escalamientos",       icon: AlertTriangle },
    ],
  },
  {
    label: "Inteligencia de marketing",
    items: [
      { label: "Resumen de desempeño", path: "/admin/portal-crm/marketing/rendimiento",      icon: Activity },
      { label: "Atribución",           path: "/admin/portal-crm/marketing/atribucion",      icon: GitBranch },
      { label: "Explorador de campañas", path: "/admin/portal-crm/marketing/campanas",      icon: Megaphone },
      { label: "Creativos",            path: "/admin/portal-crm/marketing/creativos",        icon: ImageIcon },
      { label: "Meta Ads",             path: "/admin/portal-crm/marketing/meta",             icon: Facebook },
      { label: "Google Ads",           path: "/admin/portal-crm/marketing/google",           icon: SearchIcon },
      { label: "Por desarrollo",       path: "/admin/portal-crm/marketing/desarrollos",     icon: Building2 },
      { label: "Embudo Mkt → CRM",     path: "/admin/portal-crm/marketing/embudo",           icon: Activity },
      { label: "Mapeo de campañas",    path: "/admin/portal-crm/marketing/mapeo-campanas", icon: Megaphone },
      { label: "Sincronizaciones",     path: "/admin/portal-crm/marketing/sincronizaciones",        icon: RefreshCw },
    ],
  },
  {
    label: "Tracking y conversiones",
    items: [
      { label: "Salud de tracking",     path: "/admin/portal-crm/salud-tracking",   icon: ShieldCheck },
      { label: "Eventos de conversión", path: "/admin/portal-crm/eventos-conversion", icon: Zap },
    ],
  },
  {
    label: "Inteligencia de ingresos",
    items: [
      { label: "Pronóstico",            path: "/admin/portal-crm/ingresos/pronostico",    icon: LineChartIcon },
      { label: "Atribución de ingresos", path: "/admin/portal-crm/ingresos/atribucion", icon: GitBranch },
      { label: "Velocidad",             path: "/admin/portal-crm/ingresos/velocidad",    icon: Zap },
      { label: "Metas y cuotas",        path: "/admin/portal-crm/ingresos/metas",       icon: Target },
    ],
  },
  {
    label: "Operación",
    items: [
      { label: "Constructor de campañas", path: "/admin/portal-crm/operacion/constructor",      icon: Wand2 },
      { label: "Copiloto IA",             path: "/admin/portal-crm/operacion/copiloto",      icon: Bot },
      { label: "Desarrollos",             path: "/admin/portal-crm/operacion/desarrollos", icon: Building2 },
    ],
  },
  {
    label: "Configuración",
    items: [
      { label: "Preparación de integraciones", path: "/admin/portal-crm/configuracion/conexiones",           icon: Plug },
      { label: "Preparación para despliegue",  path: "/admin/portal-crm/configuracion/preparacion-despliegue",  icon: ShieldCheck },
      { label: "Registros de API",             path: "/admin/portal-crm/configuracion/registros-api",              icon: FileClock },
      { label: "Checklist de integración",     path: "/admin/portal-crm/configuracion/checklist-integracion", icon: ListChecks },
      { label: "Organización",                 path: "/admin/portal-crm/configuracion/organizacion",          icon: Settings },
      { label: "Usuarios y roles",             path: "/admin/portal-crm/configuracion/usuarios",                 icon: UserCog },
      { label: "Administración de desarrollos", path: "/admin/portal-crm/configuracion/desarrollos",        icon: Building2 },
      { label: "Administración de pipelines",  path: "/admin/portal-crm/configuracion/pipelines",            icon: Briefcase },
    ],
  },
];

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
  const { isPathAllowed, isLoading: isLoadingPerms, error: permsError, refetch } = useAllowedMenus();

  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;

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

  const visibleGroups = isLoadingPerms
    ? []
    : navGroups
        .map((g) => ({ ...g, items: g.items.filter((i) => isPathAllowed(i.path)) }))
        .filter((g) => g.items.length > 0);

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
        {isLoadingPerms && (
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

        {!isLoadingPerms && permsError && (
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

        {!isLoadingPerms && !permsError && visibleGroups.length === 0 && (
          <div className="mx-1 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Tu rol no tiene submenús habilitados en este portal. Contacta a un administrador.
            </p>
          </div>
        )}

        {!isLoadingPerms && !permsError && visibleGroups.map((group) => (
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
          <button
            onClick={() => navigate("/admin")}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Regresar
          </button>
          <button
            onClick={signOut}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10 transition-colors"
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

          <main className="p-4 lg:px-8 lg:py-6 bg-background min-h-[calc(100vh-64px)]">
            <Outlet />
          </main>
        </div>
      </div>
    </PortalTrackingProvider>
  );
};

export default PortalCRMLayout;
