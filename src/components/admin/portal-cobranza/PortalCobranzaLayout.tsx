import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Inbox, FileText, CreditCard, FileCheck,
  AlertTriangle, Handshake, Megaphone, BarChart3,
  ArrowLeft, LogOut, LucideIcon, ChevronDown, ChevronRight, Menu,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { useCobranzaImpersonation } from "@/contexts/CobranzaImpersonationContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { CobranzaImpersonationSelector } from "./CobranzaImpersonationSelector";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/SozuLogo";

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

const isParent = (i: NavItem): i is NavParent => "children" in i;

interface CobranzaSubmenu {
  id: number;
  nombre: string;
  vista_front_end: string;
  orden: number;
}

// Íconos por nombre de submenú (estable ante rename de vista_front_end).
const NAV_ICONS: Record<string, LucideIcon> = {
  "Dashboard": LayoutDashboard,
  "Cuentas de Cobranza": Inbox,
  "Atención a Clientes": FileText,
  "Relación de Pagos": CreditCard,
  "CEPs Pendientes": FileCheck,
  "Conciliaciones": AlertTriangle,
  "Promesas de Pago": Handshake,
  "Reportes": BarChart3,
};

// Roles que ven todos los submenús activos sin filtrar por submenus_permisos.
const SUPER_ADMIN_ROLES = new Set([1, 2]);

// Etiquetas de header para rutas de detalle que no aparecen en el nav.
const DETAIL_SECTION_LABELS: Record<string, string> = {
  "/admin/portal-cobranza/expediente": "Expediente",
};

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Agrupaciones fijas del sidebar. El ORDEN de grupos es fijo; los ÍTEMS dentro
// de cada grupo vienen de BD (orden por `orden`). Submenú no mapeado → "Operación".
const GROUP_ORDER = ["Operación", "Comunicación", "Herramientas"];
const GROUP_BY_NOMBRE: Record<string, string> = {
  "Reportes": "Herramientas",
};

// Construye los grupos del sidebar desde los submenús de BD.
// Los submenús bajo /comunicacion/ se anidan en un desplegable dentro de "Comunicación".
const buildNavGroups = (subs: CobranzaSubmenu[]): NavGroup[] => {
  const byGroup = new Map<string, NavItem[]>();
  const push = (group: string, item: NavItem) => {
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group)!.push(item);
  };
  let comunicacion: NavParent | null = null;
  for (const s of subs) {
    if (s.vista_front_end.includes("/comunicacion/")) {
      if (!comunicacion) {
        comunicacion = { label: "Comunicación", icon: Megaphone, children: [] };
        push("Comunicación", comunicacion);
      }
      comunicacion.children.push({ label: s.nombre, path: s.vista_front_end });
    } else {
      const group = GROUP_BY_NOMBRE[s.nombre] || "Operación";
      push(group, { label: s.nombre, path: s.vista_front_end, icon: NAV_ICONS[s.nombre] || FileText });
    }
  }
  const ordered = [...GROUP_ORDER, ...[...byGroup.keys()].filter((g) => !GROUP_ORDER.includes(g))];
  return ordered.filter((g) => byGroup.has(g)).map((g) => ({ label: g, items: byGroup.get(g)! }));
};

export const PortalCobranzaLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { impersonatedName, impersonatedEmail, impersonatedRoleId, isImpersonating } = useCobranzaImpersonation();
  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  const { canReturnToAdmin } = useCanReturnToAdmin();
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

  // Rol efectivo: el impersonado si hay impersonation, sino el del usuario.
  const effectiveRoleId = isImpersonating ? impersonatedRoleId : (profile?.rol_id ?? null);
  // Super Admin / Admin Cobranza ven todos los submenús activos sin filtrar por permisos.
  const showAll = !isImpersonating && profile?.rol_id != null && SUPER_ADMIN_ROLES.has(profile.rol_id);

  // Navegación 100% desde BD (tabla submenus del menú "Portal Cobranza").
  // Sin fallback hardcoded: lo que no esté activo/permitido en BD no aparece,
  // y el path usado es el vista_front_end de BD (revela rutas desincronizadas).
  const { data: navGroups = [], isLoading: navLoading } = useQuery({
    queryKey: ["cobranza-nav", effectiveRoleId, showAll],
    queryFn: async () => {
      const { data: menu } = await (supabase as any)
        .from("menus")
        .select("id")
        .eq("nombre", "Portal Cobranza")
        .eq("activo", true)
        .maybeSingle();
      if (!menu) return [];
      const { data: subs } = await (supabase as any)
        .from("submenus")
        .select("id, nombre, vista_front_end, orden")
        .eq("menu_id", menu.id)
        .eq("activo", true)
        .order("orden");
      if (!subs || subs.length === 0) return [];
      let allowed: Set<number> | null = null;
      if (!showAll) {
        if (!effectiveRoleId) return [];
        const { data: perms } = await (supabase as any)
          .from("submenus_permisos")
          .select("submenu_id")
          .in("submenu_id", subs.map((s: any) => s.id))
          .eq("rol_id", effectiveRoleId)
          .eq("activo", true);
        allowed = new Set((perms || []).map((p: any) => p.submenu_id));
      }
      const visible = (subs as CobranzaSubmenu[]).filter(
        (s) => s.vista_front_end && (!allowed || allowed.has(s.id))
      );
      return buildNavGroups(visible);
    },
    enabled: showAll || !!effectiveRoleId,
  });

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  const sectionFromNav = navGroups
    .flatMap((g) => g.items)
    .flatMap((i) => (isParent(i) ? i.children : [{ label: i.label, path: i.path }]))
    .find((c) => isActive(c.path))?.label;
  const sectionFromDetail = Object.entries(DETAIL_SECTION_LABELS).find(([p]) => isActive(p))?.[1];
  const currentSection = sectionFromNav || sectionFromDetail || "Cobranza";

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
        <SozuLogo className="h-6" />
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
        {navLoading ? (
          <div className="px-1 space-y-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-9 rounded-md bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : navGroups.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-muted-foreground">
            Sin menús asignados en BD para este rol.
          </p>
        ) : (
          navGroups.map((group) => (
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
          ))
        )}
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
