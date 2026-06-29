import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Inbox, FileText, CreditCard, FileCheck,
  AlertTriangle, Handshake, Megaphone, HardHat, BarChart3, Settings,
  ArrowLeft, LogOut, LucideIcon, ChevronDown, ChevronRight, Menu,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCobranzaImpersonation } from "@/contexts/CobranzaImpersonationContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { CobranzaImpersonationSelector } from "./CobranzaImpersonationSelector";
import { APP_VERSION, SOZU_LOGO_URL } from "@/lib/config";

interface NavLeaf {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface NavParent {
  label: string;
  icon: LucideIcon;
  children: { label: string; path: string }[];
}

type NavItem = NavLeaf | NavParent;

interface NavGroup {
  label: string;
  items: NavItem[];
}

const isParent = (i: NavItem): i is NavParent => "children" in i;

const navGroups: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { label: "Dashboard",            path: "/admin/portal-cobranza/dashboard",     icon: LayoutDashboard },
      { label: "Bandeja Operativa",    path: "/admin/portal-cobranza/bandeja",       icon: Inbox },
      { label: "Atención de Clientes", path: "/admin/portal-cobranza/atencion",      icon: FileText },
      { label: "Relación de Pagos",    path: "/admin/portal-cobranza/pagos",         icon: CreditCard },
      { label: "CEPs Pendientes",      path: "/admin/portal-cobranza/ceps",          icon: FileCheck },
      { label: "Conciliaciones",       path: "/admin/portal-cobranza/conciliaciones",icon: AlertTriangle },
      { label: "Promesas de Pago",     path: "/admin/portal-cobranza/promesas",      icon: Handshake },
    ],
  },
  {
    label: "Comunicación",
    items: [
      {
        label: "Comunicación",
        icon: Megaphone,
        children: [
          { label: "Administrar Avisos", path: "/admin/portal-cobranza/comunicacion/avisos" },
          { label: "Enviar Avisos",      path: "/admin/portal-cobranza/comunicacion/enviar" },
          { label: "Ejecuciones",        path: "/admin/portal-cobranza/comunicacion/ejecuciones" },
          { label: "Plantillas",         path: "/admin/portal-cobranza/comunicacion/plantillas" },
        ],
      },
    ],
  },
  {
    label: "Herramientas",
    items: [
      { label: "Inputs de Obra", path: "/admin/portal-cobranza/inputs-obra",  icon: HardHat },
      { label: "Reportes",       path: "/admin/portal-cobranza/reportes",     icon: BarChart3 },
      { label: "Configuración",  path: "/admin/portal-cobranza/configuracion",icon: Settings },
    ],
  },
];

const SECTION_LABELS: Record<string, string> = {
  "/admin/portal-cobranza/dashboard": "Dashboard",
  "/admin/portal-cobranza/bandeja": "Bandeja Operativa",
  "/admin/portal-cobranza/atencion": "Atención de Clientes",
  "/admin/portal-cobranza/pagos": "Relación de Pagos",
  "/admin/portal-cobranza/ceps": "CEPs Pendientes",
  "/admin/portal-cobranza/conciliaciones": "Conciliaciones",
  "/admin/portal-cobranza/promesas": "Promesas de Pago",
  "/admin/portal-cobranza/comunicacion/avisos": "Administrar Avisos",
  "/admin/portal-cobranza/comunicacion/enviar": "Enviar Avisos",
  "/admin/portal-cobranza/comunicacion/ejecuciones": "Ejecuciones",
  "/admin/portal-cobranza/comunicacion/plantillas": "Plantillas",
  "/admin/portal-cobranza/inputs-obra": "Inputs de Obra",
  "/admin/portal-cobranza/reportes": "Reportes",
  "/admin/portal-cobranza/configuracion": "Configuración",
  "/admin/portal-cobranza/cuenta": "Detalle de Cuenta",
};

export const PortalCobranzaLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { impersonatedName, impersonatedEmail, impersonatedRoleId, isImpersonating } = useCobranzaImpersonation();
  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const { data: personaName } = useQuery({
    queryKey: ["cobranza-persona-name", profile?.id_persona],
    queryFn: async () => {
      if (!profile?.id_persona) return null;
      const { data } = await (supabase as any)
        .from("personas")
        .select("nombre_comercial, nombre_legal")
        .eq("id", profile.id_persona)
        .single();
      return data?.nombre_comercial || data?.nombre_legal || null;
    },
    enabled: !!profile?.id_persona,
  });

  const { data: impersonatedAllowedRoutes } = useQuery({
    queryKey: ["cobranza-impersonated-routes", impersonatedRoleId],
    queryFn: async () => {
      if (!impersonatedRoleId) return null;
      const { data: menuData } = await (supabase as any)
        .from("menus")
        .select("id")
        .eq("nombre", "Portal Cobranza")
        .single();
      if (!menuData) return null;
      const { data: subData } = await (supabase as any)
        .from("submenus")
        .select("id, vista_front_end")
        .eq("menu_id", menuData.id)
        .eq("activo", true);
      if (!subData || subData.length === 0) return null;
      const { data: permData } = await (supabase as any)
        .from("submenus_permisos")
        .select("submenu_id")
        .in("submenu_id", subData.map((s: any) => s.id))
        .eq("rol_id", impersonatedRoleId)
        .eq("activo", true);
      const allowedIds = new Set((permData || []).map((p: any) => p.submenu_id));
      return new Set<string>(
        subData
          .filter((s: any) => allowedIds.has(s.id))
          .map((s: any) => s.vista_front_end as string)
      );
    },
    enabled: isImpersonating && !!impersonatedRoleId,
  });

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  const currentSection = Object.entries(SECTION_LABELS).find(([path]) => isActive(path))?.[1] || "Cobranza";

  const filteredNavGroups = isImpersonating && impersonatedAllowedRoutes
    ? navGroups
        .map(group => {
          const items = group.items
            .map(item => {
              if (isParent(item)) {
                const allowedChildren = item.children.filter(c =>
                  (impersonatedAllowedRoutes as Set<string>).has(c.path)
                );
                return allowedChildren.length > 0 ? { ...item, children: allowedChildren } : null;
              }
              return (impersonatedAllowedRoutes as Set<string>).has(item.path) ? item : null;
            })
            .filter((i): i is NavItem => i !== null);
          return { ...group, items };
        })
        .filter(g => g.items.length > 0)
    : navGroups;

  const activeUserName = isImpersonating
    ? impersonatedName || impersonatedEmail || profile?.nombre || profile?.email || "Usuario"
    : personaName || profile?.nombre || profile?.email || "Usuario";

  const rawName = personaName || profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Cobranza";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join("") || "U";

  const activeInitials = activeUserName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p.charAt(0).toUpperCase())
    .join("") || "U";

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <img src={SOZU_LOGO_URL} alt="SOZU" className="h-6 w-auto object-contain object-left dark:invert" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal Cobranza
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {isImpersonating && (
          <div className="mx-1 mb-1 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate">
            Viendo como: {impersonatedName || impersonatedEmail}
          </div>
        )}
        {filteredNavGroups.map((group) => (
          <div key={group.label}>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (isParent(item)) {
                  const groupActive = item.children.some((c) => isActive(c.path));
                  const expanded = expandedMenu === item.label || groupActive;
                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => setExpandedMenu(expanded ? null : item.label)}
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
    <PortalTrackingProvider portal="cobranza">
      <div className="min-h-screen flex antialiased">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col border-r border-border bg-sidebar fixed inset-y-0 left-0 z-30 w-64">
          {sidebarContent}
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64 flex flex-col bg-sidebar">
            {sidebarContent}
          </SheetContent>
        </Sheet>

        <div className="flex-1 lg:pl-64 min-w-0">
          {/* Desktop header */}
          <header className="hidden lg:flex items-center justify-between sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border-soft px-6 h-14 shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]">
            {/* Section title */}
            <h1 className="text-xl font-bold text-foreground tracking-tight">{currentSection}</h1>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              {isSuperAdmin && <CobranzaImpersonationSelector />}

              <Popover open={profileOpen} onOpenChange={setProfileOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "relative group flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold shrink-0 transition-all duration-200 focus:outline-none",
                      "bg-primary text-primary-foreground",
                      isImpersonating
                        ? "ring-2 ring-amber-400/70 ring-offset-1 ring-offset-card"
                        : "hover:ring-2 hover:ring-primary/35 hover:ring-offset-1 hover:ring-offset-card"
                    )}
                    aria-label="Perfil"
                  >
                    {initials}
                    <span className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-card",
                      isImpersonating ? "bg-amber-400" : "bg-emerald-400"
                    )} />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-64 p-0 overflow-hidden rounded-xl shadow-xl border border-border/50"
                >
                  {/* Light identity header */}
                  <div className="relative px-4 pt-4 pb-3.5 border-b border-border/60">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-t-xl" />
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-[13px] font-bold text-primary-foreground">
                          {initials}
                        </div>
                        <span className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                          isImpersonating ? "bg-amber-400" : "bg-emerald-400"
                        )} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-foreground truncate leading-tight">{userName}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">{userRole}</p>
                      </div>
                    </div>
                    {profile?.email && (
                      <p className="mt-2.5 text-[10.5px] text-muted-foreground/70 truncate font-mono tracking-tight">{profile.email}</p>
                    )}
                    {isImpersonating && (
                      <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 truncate">Vista: {impersonatedName || impersonatedEmail}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); signOut(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-destructive hover:bg-destructive/8 transition-colors duration-150"
                    >
                      <LogOut className="size-3.5 shrink-0" />
                      Cerrar sesión
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </header>

          {/* Mobile header */}
          <header className="flex lg:hidden items-center justify-between sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border px-3 h-14 shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-1.5 -ml-1 rounded-lg text-foreground hover:bg-muted transition-colors"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </button>
              <p className="text-[16px] font-bold text-foreground tracking-tight truncate">{currentSection}</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold shrink-0 focus:outline-none">
                  {initials}
                  <span className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-card",
                    isImpersonating ? "bg-amber-400" : "bg-emerald-400"
                  )} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-64 p-0 overflow-hidden rounded-xl shadow-xl border border-border/50">
                <div className="relative px-4 pt-4 pb-3.5 border-b border-border/60">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-t-xl" />
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-[13px] font-bold text-primary-foreground">
                        {initials}
                      </div>
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                        isImpersonating ? "bg-amber-400" : "bg-emerald-400"
                      )} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-foreground truncate leading-tight">{userName}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">{userRole}</p>
                    </div>
                  </div>
                  {profile?.email && (
                    <p className="mt-2.5 text-[10.5px] text-muted-foreground/70 truncate font-mono tracking-tight">{profile.email}</p>
                  )}
                </div>
                <div className="p-1.5">
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-destructive hover:bg-destructive/8 transition-colors duration-150"
                  >
                    <LogOut className="size-3.5 shrink-0" />
                    Cerrar sesión
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </header>

          <main className="px-8 py-4 bg-background min-h-[calc(100vh-56px)]">
            <Outlet />
          </main>
        </div>
      </div>
    </PortalTrackingProvider>
  );
};
