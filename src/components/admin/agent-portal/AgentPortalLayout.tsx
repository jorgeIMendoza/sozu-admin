import { useState, useLayoutEffect, useEffect, useMemo, useRef } from "react";
import { OptImg } from "@/components/ui/opt-img";
import { Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { Home, Building2, BarChart3, DollarSign, User, Users, LucideIcon, Menu, ChevronRight, Eye, EyeOff, LogOut, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentPresentationProvider, useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { useAgentViewRestrictions } from "@/hooks/useAgentViewRestrictions";
import { AgentPortalImpersonationSelector } from "./AgentPortalImpersonationSelector";
import { ImpersonationViewModeBanner } from "@/components/admin/ImpersonationViewModeToggle";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/sozu-logo";

const AGENT_MENU_ID = 16;

/** Toggle de Modo presentación - oculta info sensible en todo el portal.
 *  Lleva su etiqueta a la vista (sin tooltip): es un estado, no una acción
 *  puntual, y el agente necesita ver de un golpe si está activo. */
const PresentationToggle = () => {
  const { presentationMode, toggle } = useAgentPresentation();
  return (
    <button
      onClick={toggle}
      aria-pressed={presentationMode}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
        presentationMode
          ? "border-amber-300 bg-orange-100 text-orange-700"
          : "border-border bg-card text-muted-foreground hover:bg-muted"
      )}
    >
      {presentationMode ? (
        <EyeOff className="h-[18px] w-[18px] shrink-0" />
      ) : (
        <Eye className="h-[18px] w-[18px] shrink-0" />
      )}
      <span>Presentación</span>
    </button>
  );
};

const iconMap: Record<string, LucideIcon> = {
  '/admin/agent/inicio': Home,
  '/admin/agent/inventario': Building2,
  '/admin/agent/prospectos': Users,
  '/admin/agent/pipeline': BarChart3,
  '/admin/agent/comisiones': DollarSign,
  '/admin/agent/perfil': User,
};

/**
 * Cache local del menú ya resuelto (permisos + dependencia de inmobiliaria),
 * por email del usuario logueado. Al recargar se pinta al instante y luego se
 * reconcilia en silencio con la respuesta real; si no hay cache, va el skeleton.
 */
const TABS_CACHE_PREFIX = "sozu-agent-portal-tabs:";

type CachedTab = { path: string; label: string };

function readTabsCache(email: string | null): CachedTab[] | null {
  if (!email || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${TABS_CACHE_PREFIX}${email}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const clean = parsed.filter(
      (t: any) => typeof t?.path === "string" && typeof t?.label === "string"
    );
    return clean.length > 0 ? clean : null;
  } catch {
    return null;
  }
}

const FALLBACK_TABS = [
  { path: "/admin/agent/inicio",      label: "Inicio",      icon: Home },
  { path: "/admin/agent/inventario",  label: "Inventario",  icon: Building2 },
  { path: "/admin/agent/pipeline",    label: "Pipeline",    icon: BarChart3 },
  { path: "/admin/agent/comisiones",  label: "Comisiones",  icon: DollarSign },
  { path: "/admin/agent/perfil",      label: "Perfil",      icon: User },
];

export const AgentPortalLayout = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { permissions, isLoading: permLoading } = useAgentPortalPermissions();
  const { isPathDisabled } = useAllowedMenus();
  // Los recortes por dependencia ya no se calculan aquí: los resuelve el
  // registro de reglas (`lib/impersonation/rules/agente-dependiente`).
  const { isHidden, isLoading: inmobLoading } = useAgentViewRestrictions();
  const { theme, setTheme } = useTheme();
  const previousThemeRef = useRef(theme ?? "system");
  const [mobileOpen, setMobileOpen] = useState(false);

  const { profile, signOut } = useAuth();
  const { impersonatedAgentEmail, impersonatedAgentName, isImpersonating } = useAgentImpersonation();
  const canImpersonate = profile?.puede_impersonar === true;

  // Usuario "efectivo": el impersonado si aplica, si no el logueado.
  const effectiveEmail = isImpersonating ? impersonatedAgentEmail : profile?.email;

  // Foto + rol del usuario efectivo (usuarios.foto_perfil_url). Cubre tanto al
  // logueado como al impersonado, para que el header refleje a quién se revisa.
  const { data: effectivePerfil, isPending: perfilPending } = useQuery({
    queryKey: ['agent-portal-header-perfil', effectiveEmail],
    queryFn: async () => {
      if (!effectiveEmail) return null;
      const { data } = await (supabase as any)
        .from('usuarios')
        .select('foto_perfil_url, roles:rol_id(nombre)')
        .eq('email', effectiveEmail)
        .maybeSingle();
      return data as { foto_perfil_url: string | null; roles?: { nombre: string } | null } | null;
    },
    enabled: !!effectiveEmail,
    staleTime: 60_000,
  });
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';

  useLayoutEffect(() => {
    setTheme("light");
    return () => { setTheme(previousThemeRef.current); };
  }, [setTheme]);

  const { data: allTabs = FALLBACK_TABS, isLoading: tabsLoading } = useQuery({
    queryKey: ['agent-portal-tabs'],
    queryFn: async () => {
      // `menus!inner(activo)`: si se apaga el menú padre en Administrar Menús,
      // se apagan todas sus vistas aunque el submenú siga activo=true.
      const { data, error } = await (supabase as any)
        .from('submenus')
        .select('nombre, vista_front_end, orden, menus!inner(activo)')
        .eq('menu_id', AGENT_MENU_ID)
        .eq('activo', true)
        .eq('menus.activo', true)
        .order('orden');
      // Fallback SOLO si la query falló (fail-open por conectividad). Cero filas
      // significa "todo apagado en BD" y debe respetarse: antes revivía los tabs
      // hardcodeados y las vistas apagadas volvían al sidebar.
      if (error) return FALLBACK_TABS;
      if (!data) return FALLBACK_TABS;
      return data.map((s: any) => ({
        path: s.vista_front_end,
        label: s.nombre,
        icon: iconMap[s.vista_front_end] || Home,
      }));
    },
    staleTime: 5 * 60_000,
  });

  // El menú depende de dos fuentes async (permisos por rol + si el agente es
  // dependiente de una inmobiliaria). Pintar la lista completa mientras cargan
  // provoca el "golpe" de tabs que aparecen y se esconden (Comisiones/Prospectos),
  // así que hasta que ambas resuelvan se muestran placeholders.
  const menuReady = !permLoading && !inmobLoading && !tabsLoading;

  // Qué se oculta lo decide la regla `agente-dependiente` (Comisiones al agente
  // ligado a una inmobiliaria). Los permisos por rol siguen aplicando aparte.
  const hideComisiones = isHidden('/admin/agent/comisiones');

  const resolvedTabs = useMemo(
    () =>
      menuReady
        ? allTabs.filter((tab) => {
            if (hideComisiones && tab.path === '/admin/agent/comisiones') return false;
            const perm = permissions[tab.path as keyof typeof permissions];
            return perm?.canRead !== false;
          })
        : [],
    [menuReady, allTabs, hideComisiones, permissions]
  );

  // Menú de la última sesión de este usuario: evita el skeleton al recargar.
  // Se filtra contra las rutas apagadas en BD para que un cache viejo no pinte
  // vistas que ya se desactivaron en Administrar Menús.
  const cacheEmail = profile?.email ?? null;
  const cachedTabs = useMemo(
    () =>
      (readTabsCache(cacheEmail) || [])
        .filter((t) => !isPathDisabled(t.path))
        .map((t) => ({
          path: t.path,
          label: t.label,
          icon: iconMap[t.path] || Home,
        })),
    [cacheEmail, isPathDisabled]
  );

  const tabs = menuReady ? resolvedTabs : cachedTabs;
  const showTabsSkeleton = !menuReady && cachedTabs.length === 0;

  const tabsCachePayload = menuReady
    ? JSON.stringify(resolvedTabs.map(({ path, label }) => ({ path, label })))
    : null;

  useEffect(() => {
    if (!tabsCachePayload || !cacheEmail) return;
    try {
      window.localStorage.setItem(`${TABS_CACHE_PREFIX}${cacheEmail}`, tabsCachePayload);
    } catch {
      // Cuota llena / modo privado: sin cache se cae al skeleton, no rompe nada.
    }
  }, [tabsCachePayload, cacheEmail]);

  if (menuReady && hideComisiones && location.pathname.startsWith('/admin/agent/comisiones')) {
    return <Navigate to="/admin/agent/inicio" replace />;
  }

  const isActive = (path: string) => location.pathname.startsWith(path);
  const showBackButton = canReturnToAdmin;

  const rawName   = (isImpersonating ? impersonatedAgentName : profile?.nombre)
    || effectiveEmail?.split('@')[0] || 'Usuario';
  const userName  = rawName.trim().split(/\s+/).slice(0, 2).join(' ');
  const userRole  = effectivePerfil?.roles?.nombre || (isImpersonating ? 'Agente' : profile?.rol_nombre) || 'Agente';
  const initials  = userName.split(' ').filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || 'U';
  const photoUrl  = effectivePerfil?.foto_perfil_url || (isImpersonating ? null : profile?.foto_perfil_url) || null;
  // Título: sobre el catálogo completo (no sobre tabs), para no caer a "Inicio"
  // mientras carga el menú ni en rutas que el fallback no lista (ej. Prospectos).
  const currentSection =
    [...allTabs, ...cachedTabs].find(t => isActive(t.path))?.label || 'Inicio';

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  // Mientras `usuarios` responde no se sabe si hay foto: pintar iniciales y luego
  // cambiarlas por la foto es justo el salto que se veía al abrir el portal o al
  // cambiar de impersonado. Con la query en vuelo va un placeholder del MISMO
  // tamaño, así el header nunca se recompone.
  const perfilLoading = !!effectiveEmail && perfilPending;

  // Avatar: foto real del usuario si existe en usuarios.foto_perfil_url, si no iniciales.
  // Render fn (no componente inline) para evitar remontar el <img> en cada render.
  const renderAvatar = (size: string, text: string) =>
    perfilLoading ? (
      <div className={cn(size, "rounded-full bg-muted animate-pulse shrink-0")} aria-hidden />
    ) : photoUrl ? (
      <OptImg
        src={photoUrl}
        w={96}
        h={96}
        resize="cover"
        alt={userName}
        className={cn(size, "rounded-full object-cover shrink-0")}
      />
    ) : (
      <div className={cn(size, text, "rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0")}>
        {initials}
      </div>
    );

  const renderProfileMenu = () => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Mi perfil"
          className="rounded-full hover:opacity-90 transition-opacity"
        >
          {renderAvatar("w-9 h-9", "text-xs")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-60 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border-soft bg-muted/30">
          <div className="flex items-center gap-3">
            {renderAvatar("w-9 h-9", "text-xs")}
            {perfilLoading ? (
              <div className="min-w-0 flex-1 space-y-1.5" aria-hidden>
                <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              </div>
            ) : (
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userRole}</p>
              </div>
            )}
          </div>
        </div>
        <div className="p-1.5 space-y-0.5">
          <button
            onClick={() => handleNavigate("/admin/agent/perfil")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted/60 transition-colors duration-150"
          >
            <User className="size-4 text-muted-foreground shrink-0" />
            Ver perfil
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150"
          >
            <LogOut className="size-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <SozuLogo className="h-6" />
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal de Agentes
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {showTabsSkeleton && Array.from({ length: 4 }).map((_, i) => (
          <div key={`nav-skeleton-${i}`} className="flex items-center gap-3 pl-4 pr-3 py-2" aria-hidden>
            <div className="size-4 shrink-0 rounded bg-muted animate-pulse" />
            <div
              className="h-3.5 rounded bg-muted animate-pulse"
              style={{ width: `${[64, 84, 72, 56][i]}px` }}
            />
          </div>
        ))}
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon   = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => handleNavigate(tab.path)}
              className={cn(
                "group relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 text-left",
                active
                  ? "bg-primary/[0.06] text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span className={cn(
                "absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary transition-opacity duration-150",
                active ? "opacity-100" : "opacity-0"
              )} />
              <Icon className={cn(
                "size-4 shrink-0",
                active ? "" : "opacity-60 group-hover:opacity-100 transition-opacity duration-150"
              )} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-1 pb-4 border-t border-border-soft space-y-1">
        <button
          onClick={() => handleNavigate("/admin/agent/perfil")}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors group/profile"
        >
          {renderAvatar("w-8 h-8", "text-xs")}
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userRole}</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover/profile:opacity-100 transition-opacity" />
        </button>

        <div className="flex gap-2">
          {showBackButton && (
            <button
              onClick={() => navigate("/admin")}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Regresar
            </button>
          )}
          <button
            onClick={signOut}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors",
              showBackButton ? "flex-1" : "w-full"
            )}
          >
            <LogOut className="size-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>

        <p className="text-xs text-muted-foreground/40 font-mono text-center pt-0.5">{APP_VERSION}</p>
      </div>
    </>
  );

  return (
    <PortalTrackingProvider portal="agentes">
      <AgentPresentationProvider>
      <div className="agent-portal light min-h-screen flex antialiased" style={{ colorScheme: "light" }}>
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col border-r border-border bg-sidebar fixed inset-y-0 left-0 z-30 w-64">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-64 flex-col bg-sidebar p-0">
            <SheetTitle className="sr-only">Menú del portal</SheetTitle>
            <SheetDescription className="sr-only">Navegación del portal de agentes</SheetDescription>
            {sidebar}
          </SheetContent>
        </Sheet>

        <div className="flex-1 lg:pl-64 min-w-0">
          {/* Desktop header */}
          {/* `min-w-0` en el título + `shrink-0` en los controles: sin eso el
              título se comía el espacio y los controles quedaban aplastados
              (título "Pe..." y toggles encimados) al impersonar. */}
          <header className="hidden lg:flex sticky top-0 z-20 h-16 items-center gap-3 px-6 lg:px-8 bg-card border-b border-border-soft">
            <p className="min-w-0 flex-1 truncate text-xl lg:text-2xl font-bold text-foreground tracking-tight">
              {currentSection}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {canImpersonate && <AgentPortalImpersonationSelector />}
              <PresentationToggle />
              {renderProfileMenu()}
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
                <p className="text-lg font-bold text-foreground tracking-tight truncate">{currentSection}</p>
              </div>
              <PresentationToggle />
              {renderProfileMenu()}
            </div>
            {canImpersonate && (
              <div className="px-4 pb-3">
                <AgentPortalImpersonationSelector />
              </div>
            )}
          </header>

          {isImpersonating && <ImpersonationViewModeBanner targetName={impersonatedAgentName} />}

          <main className="min-h-[calc(100vh-64px)] bg-background px-4 py-4 sm:px-6 lg:px-8">
            <Outlet context={{ permissions, isAgentRole }} />
          </main>
        </div>

      </div>
      </AgentPresentationProvider>
    </PortalTrackingProvider>
  );
};
