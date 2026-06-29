import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, BarChart3, UserSearch,
  Calendar, DollarSign, FileText, Settings, ArrowLeft, LucideIcon, LogOut, Percent,
  Building2, BarChart2, CalendarDays, UserCheck, Menu, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { useInmobiliariaPersonaId } from "@/hooks/useInmobiliariaPersonaId";
import { InmobiliariaImpersonationSelector } from "./InmobiliariaImpersonationSelector";
import { APP_VERSION, SOZU_LOGO_URL } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { usePortalNav } from "@/hooks/usePortalNav";

const PORTAL_INMOB_MENU_ID = 17;

const iconMap: Record<string, LucideIcon> = {
  "/admin/portal-inmobiliaria/dashboard": LayoutDashboard,
  "/admin/portal-inmobiliaria/agentes": Users,
  "/admin/portal-inmobiliaria/pipeline": BarChart2,
  "/admin/portal-inmobiliaria/prospectos": UserCheck,
  "/admin/portal-inmobiliaria/citas": CalendarDays,
  "/admin/portal-inmobiliaria/comisiones": DollarSign,
  "/admin/portal-inmobiliaria/reportes": BarChart3,
  "/admin/portal-inmobiliaria/configuracion": Settings,
};

export const PortalInmobiliariaLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const isInmobiliariaRole = profile?.rol_nombre === "Inmobiliaria";
  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  const { personaId } = useInmobiliariaPersonaId();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: agencyInfo } = useQuery({
    queryKey: ["inmob-agency-info", personaId],
    queryFn: async () => {
      if (!personaId) return { name: "Mi Inmobiliaria", comisionPct: null as number | null };
      const { data } = await (supabase as any)
        .from("personas")
        .select("nombre_comercial, nombre_legal")
        .eq("id", personaId)
        .single();
      const name = data?.nombre_comercial || data?.nombre_legal || "Mi Inmobiliaria";

      let comisionPct: number | null = null;
      const { data: comisionRows } = await supabase
        .from("entidades_relacionadas")
        .select("porcentaje_comision")
        .eq("id_persona", personaId)
        .eq("id_tipo_entidad", 5)
        .eq("activo", true) as any;

      if (comisionRows?.length) {
        const vals = (comisionRows as any[])
          .map((r: any) => Number(r.porcentaje_comision))
          .filter((v: number) => !isNaN(v) && v > 0);
        if (vals.length > 0) {
          const freq = new Map<number, number>();
          vals.forEach((v: number) => freq.set(v, (freq.get(v) || 0) + 1));
          let best = vals[0];
          let bestCount = 0;
          freq.forEach((count, val) => { if (count > bestCount) { best = val; bestCount = count; } });
          comisionPct = best;
        }
      }

      return { name, comisionPct };
    },
    enabled: !!personaId,
    staleTime: 10 * 60_000,
  });
  const agencyName = agencyInfo?.name || "Mi Inmobiliaria";
  const comisionPct = agencyInfo?.comisionPct;

  const tabs = usePortalNav(PORTAL_INMOB_MENU_ID, iconMap, LayoutDashboard);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const showBackButton = canReturnToAdmin;

  const currentSection = tabs.find(t => isActive(t.path))?.label || "";

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Inmobiliaria";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join("") || "U";

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <img src={SOZU_LOGO_URL} alt="SOZU" className="h-6 w-auto object-contain object-left dark:invert" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal Inmobiliaria
        </p>
      </div>

      {/* Agency info */}
      <div className="px-5 py-3 border-b border-border-soft">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 mb-1">Inmobiliaria</p>
        <p className="text-[13px] font-semibold text-foreground truncate">{agencyName}</p>
        {comisionPct !== null && comisionPct !== undefined && (
          <div className="flex items-center gap-1 mt-1.5">
            <Percent className="h-3 w-3 text-primary" />
            <span className="text-[12px] font-medium text-primary">Comisión: {comisionPct.toFixed(2)}%</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
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
          onClick={() => handleNavigate("/admin/portal-inmobiliaria/configuracion")}
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
    <PortalTrackingProvider portal="inmobiliarias">
      <div className="inmob-portal min-h-screen flex antialiased">
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
            {isSuperAdmin && <InmobiliariaImpersonationSelector />}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => navigate("/admin/portal-inmobiliaria/configuracion")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                aria-label="Configuración"
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
                onClick={() => navigate("/admin/portal-inmobiliaria/configuracion")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                aria-label="Configuración"
              >
                {initials}
              </button>
            </div>
            {isSuperAdmin && (
              <div className="px-4 pb-3">
                <InmobiliariaImpersonationSelector />
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
