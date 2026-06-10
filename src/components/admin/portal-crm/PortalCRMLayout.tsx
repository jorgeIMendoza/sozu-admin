import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
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
  Settings as SettingsIcon,
  UserCog,
  KeyRound,
  SlidersHorizontal,
  ListTree,
  Webhook,
  Plug2,
  FileClock,
  LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { APP_VERSION } from "@/lib/config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";

interface NavItem { label: string; path: string; icon: LucideIcon }
interface NavGroup { label: string; items: NavItem[] }

// Fase 1: solo se incluyen las secciones Resumen y Tracking.
// Fases posteriores irán agregando CRM, Marketing, Ingresos, Operación, Configuración.
const navGroups: NavGroup[] = [
  {
    label: "Resumen",
    items: [
      { label: "Panel principal", path: "/admin/portal-crm/dashboard", icon: LayoutDashboard },
      { label: "Alertas",         path: "/admin/portal-crm/alertas",   icon: Bell },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Contactos",            path: "/admin/portal-crm/crm/contacts",           icon: Users },
      { label: "Pipeline",             path: "/admin/portal-crm/crm/deals",              icon: Briefcase },
      { label: "Citas",                path: "/admin/portal-crm/crm/appointments",       icon: Calendar },
      { label: "Tareas",               path: "/admin/portal-crm/crm/tasks",              icon: ListTodo },
      { label: "Secuencias",           path: "/admin/portal-crm/crm/sequences",          icon: Workflow },
      { label: "Routing de leads",     path: "/admin/portal-crm/crm/routing",            icon: RouteIcon },
      { label: "Reglas automatización",path: "/admin/portal-crm/crm/automation-rules",   icon: Cog },
      { label: "Escalaciones",         path: "/admin/portal-crm/crm/escalations",        icon: AlertTriangle },
      { label: "Lead Intelligence",    path: "/admin/portal-crm/crm/lead-intelligence",  icon: Sparkles },
      { label: "Perf. de agentes",     path: "/admin/portal-crm/crm/agent-performance",  icon: UserCheck },
      { label: "Operaciones de ventas",path: "/admin/portal-crm/crm/sales-operations",   icon: BarChart3 },
    ],
  },
  {
    label: "Tracking y conversiones",
    items: [
      { label: "Salud de tracking",     path: "/admin/portal-crm/tracking-health",    icon: ShieldCheck },
      { label: "Eventos de conversión", path: "/admin/portal-crm/conversion-events",  icon: Zap },
    ],
  },
  {
    label: "Inteligencia de marketing",
    items: [
      { label: "Campañas",              path: "/admin/portal-crm/marketing/campaigns",      icon: Megaphone },
      { label: "Audiencias",            path: "/admin/portal-crm/marketing/audiences",      icon: Users2 },
      { label: "Atribución",            path: "/admin/portal-crm/marketing/attribution",    icon: GitBranch },
      { label: "Creatividades",         path: "/admin/portal-crm/marketing/creatives",      icon: ImageIcon },
      { label: "UTMs",                  path: "/admin/portal-crm/marketing/utms",           icon: Link2 },
      { label: "A/B Tests",             path: "/admin/portal-crm/marketing/ab-tests",       icon: FlaskConical },
      { label: "Landing pages",         path: "/admin/portal-crm/marketing/landing-pages",  icon: LayoutTemplate },
      { label: "Formularios",           path: "/admin/portal-crm/marketing/forms",          icon: FileInput },
      { label: "Integraciones de ads",  path: "/admin/portal-crm/marketing/integrations",   icon: Plug },
      { label: "Costos y presupuesto",  path: "/admin/portal-crm/marketing/budget",         icon: Wallet },
    ],
  },
  {
    label: "Dirección · Inteligencia de ingresos",
    items: [
      { label: "KPIs ejecutivos",  path: "/admin/portal-crm/revenue/executive-kpis",  icon: Target },
      { label: "Forecast",         path: "/admin/portal-crm/revenue/forecast",        icon: LineChartIcon },
      { label: "Pipeline review",  path: "/admin/portal-crm/revenue/pipeline-review", icon: BriefcaseIcon },
      { label: "Revenue ops",      path: "/admin/portal-crm/revenue/revenue-ops",     icon: Activity },
      { label: "Cohorts",          path: "/admin/portal-crm/revenue/cohorts",         icon: Layers },
      { label: "Churn",            path: "/admin/portal-crm/revenue/churn",           icon: TrendingDown },
      { label: "Reportería",       path: "/admin/portal-crm/revenue/reporting",       icon: FileText },
    ],
  },
  {
    label: "Operación",
    items: [
      { label: "Bandeja unificada", path: "/admin/portal-crm/operations/inbox",  icon: InboxIcon },
      { label: "Colas",             path: "/admin/portal-crm/operations/queues", icon: ListChecks },
      { label: "Monitor de SLA",    path: "/admin/portal-crm/operations/sla",    icon: Timer },
    ],
  },
  {
    label: "Configuración",
    items: [
      { label: "Usuarios CRM",          path: "/admin/portal-crm/settings/users",                       icon: UserCog },
      { label: "Roles y permisos CRM",  path: "/admin/portal-crm/settings/roles",                       icon: KeyRound },
      { label: "Etapas del pipeline",   path: "/admin/portal-crm/settings/pipeline-stages",             icon: ListTree },
      { label: "Campos personalizados", path: "/admin/portal-crm/settings/custom-fields",               icon: SlidersHorizontal },
      { label: "Webhooks",              path: "/admin/portal-crm/settings/webhooks",                    icon: Webhook },
      { label: "Callback OAuth Google", path: "/admin/portal-crm/settings/connections/google/callback", icon: Plug2 },
      { label: "Callback OAuth Meta",   path: "/admin/portal-crm/settings/connections/meta/callback",   icon: Plug2 },
      { label: "Log de auditoría",      path: "/admin/portal-crm/settings/audit-log",                   icon: FileClock },
    ],
  },
];

export const PortalCRMLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isPathAllowed, isLoading: isLoadingPerms } = useAllowedMenus();

  // Filtrar grupos/items por permisos reales de la BD (submenus_permisos).
  // Mientras cargan los permisos no mostramos nada para evitar parpadeos.
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

  const userName = profile?.nombre || profile?.email || "Usuario";
  const initials =
    userName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "U";

  const sidebar = (
    <>
      <div className="px-4 pt-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shrink-0">
            S
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground leading-tight">SOZU</p>
            <p className="text-[11px] text-muted-foreground leading-tight">CRM Sozu</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
        {visibleGroups.map((group) => (
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
                      "w-full flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-sm font-medium transition-all duration-150 text-left",
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className="h-[18px] w-[18px] shrink-0"
                      strokeWidth={active ? 2 : 1.75}
                    />
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
    <div className="min-h-screen flex">
      <aside
        className="hidden lg:flex lg:flex-col border-r border-border bg-card fixed inset-y-0 left-0 z-30"
        style={{ width: 244 }}
      >
        {sidebar}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-[270px] flex flex-col bg-card">
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex-1 lg:ml-[244px]">
        <header className="hidden lg:flex items-center justify-between sticky top-0 z-20 bg-card border-b border-border px-6 h-14">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="font-medium">CRM Sozu</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{currentSection}</span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 text-right">
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">CRM</p>
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
                CRM Sozu
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

        <main className="p-4 lg:px-8 lg:py-6 bg-background min-h-[calc(100vh-56px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PortalCRMLayout;
