import { useState, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import {
  Home, Building2, BarChart3, DollarSign, User, Users, LucideIcon,
  ArrowLeft, MessageCircleQuestion, Menu, LogOut, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { useAgentHasInmobiliaria } from "@/hooks/useAgentHasInmobiliaria";
import { AgentPortalImpersonationSelector } from "./AgentPortalImpersonationSelector";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { APP_VERSION, SOZU_LOGO_URL } from "@/lib/config";

const sozuLogo = SOZU_LOGO_URL;
const AGENT_MENU_ID = 16;

const iconMap: Record<string, LucideIcon> = {
  '/admin/agent/inicio': Home,
  '/admin/agent/inventario': Building2,
  '/admin/agent/prospectos': Users,
  '/admin/agent/pipeline': BarChart3,
  '/admin/agent/comisiones': DollarSign,
  '/admin/agent/perfil': User,
};

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
  const { hasInmobiliaria } = useAgentHasInmobiliaria();
  const { theme, setTheme } = useTheme();
  const previousThemeRef = useRef(theme ?? "system");
  const [mobileOpen, setMobileOpen] = useState(false);

  const { profile, signOut } = useAuth();
  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  const AGENT_PORTAL_HOME_ROLES = [3, 4, 9, 25];
  const livesInAgentPortal = !!profile?.rol_id && AGENT_PORTAL_HOME_ROLES.includes(profile.rol_id);
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';

  useLayoutEffect(() => {
    setTheme("light");
    return () => { setTheme(previousThemeRef.current); };
  }, [setTheme]);

  const { data: hasOtherMenus = false } = useQuery({
    queryKey: ['has-other-menus', profile?.rol_id],
    queryFn: async () => {
      if (!profile?.rol_id) return false;
      const { data, error } = await (supabase as any)
        .from('submenus')
        .select('menu_id')
        .neq('menu_id', AGENT_MENU_ID)
        .eq('activo', true);
      if (error || !data) return false;
      const uniqueMenuIds = [...new Set(data.map((s: any) => s.menu_id))];
      return uniqueMenuIds.length > 0;
    },
    enabled: !isAgentRole && !!profile?.rol_id,
    staleTime: 10 * 60_000,
  });

  const { data: allTabs = FALLBACK_TABS } = useQuery({
    queryKey: ['agent-portal-tabs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('submenus')
        .select('nombre, vista_front_end, orden')
        .eq('menu_id', AGENT_MENU_ID)
        .eq('activo', true)
        .order('orden');
      if (error || !data || data.length === 0) return FALLBACK_TABS;
      return data.map((s: any) => ({
        path: s.vista_front_end,
        label: s.nombre,
        icon: iconMap[s.vista_front_end] || Home,
      }));
    },
    staleTime: 5 * 60_000,
  });

  const tabs = permLoading
    ? allTabs
    : allTabs.filter((tab) => {
        if (hasInmobiliaria && tab.path === '/admin/agent/comisiones') return false;
        const perm = permissions[tab.path as keyof typeof permissions];
        return perm?.canRead !== false;
      });

  if (hasInmobiliaria && location.pathname.startsWith('/admin/agent/comisiones')) {
    return <Navigate to="/admin/agent/inicio" replace />;
  }

  const isActive = (path: string) => location.pathname.startsWith(path);
  const showBackButton = !livesInAgentPortal && hasOtherMenus;

  const rawName   = profile?.nombre || profile?.email?.split('@')[0] || 'Usuario';
  const userName  = rawName.trim().split(/\s+/).slice(0, 2).join(' ');
  const userRole  = profile?.rol_nombre ?? 'Agente';
  const initials  = userName.split(' ').filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || 'U';
  const currentSection = tabs.find(t => isActive(t.path))?.label || 'Inicio';

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <img src={sozuLogo} alt="SOZU" className="h-6 w-auto object-contain object-left dark:invert" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal de Agentes
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon   = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => handleNavigate(tab.path)}
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
          {showBackButton && (
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
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10 transition-colors",
              showBackButton ? "flex-1" : "w-full"
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
    <PortalTrackingProvider portal="agentes">
      <div className="agent-portal light min-h-screen flex antialiased" style={{ colorScheme: "light" }}>
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
          {/* Desktop header */}
          <header className="hidden lg:flex sticky top-0 z-20 h-16 items-center gap-4 px-6 lg:px-8 bg-card border-b border-border-soft">
            {isSuperAdmin && <AgentPortalImpersonationSelector />}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => navigate("/admin/agent/perfil")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                aria-label="Mi perfil"
              >
                {initials}
              </button>
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
              <button
                onClick={() => navigate("/admin/agent/perfil")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                aria-label="Mi perfil"
              >
                {initials}
              </button>
            </div>
            {isSuperAdmin && (
              <div className="px-4 pb-3">
                <AgentPortalImpersonationSelector />
              </div>
            )}
          </header>

          <main className="p-4 lg:px-8 lg:py-6 bg-background min-h-[calc(100vh-64px)]">
            <Outlet context={{ permissions, isAgentRole }} />
          </main>
        </div>

        {/* WhatsApp help bubble */}
        <a
          href="https://wa.me/523316693357?text=Hola%2C%20requiero%20apoyo%20para%20completar%20mi%20onboarding%20de%20agente"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-5 z-50 h-12 w-12 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Ayuda por WhatsApp"
        >
          <MessageCircleQuestion className="h-6 w-6" />
        </a>
      </div>
    </PortalTrackingProvider>
  );
};
