import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Inbox, FileText, CreditCard, FileCheck,
  AlertTriangle, Handshake, Megaphone, HardHat, BarChart3, Settings,
  ArrowLeft, LogOut, LucideIcon, ChevronDown, ChevronRight, Menu,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
};

export const PortalCobranzaLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { impersonatedName, impersonatedEmail, isImpersonating } = useCobranzaImpersonation();
  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  const currentSection = Object.entries(SECTION_LABELS).find(([path]) => isActive(path))?.[1] || "Cobranza";

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
        {navGroups.map((group) => (
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
          <header className="hidden lg:flex items-center justify-between sticky top-0 z-20 bg-card border-b border-border-soft px-6 h-14">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="font-medium">Portal Cobranza</span>
              {currentSection && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{currentSection}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isSuperAdmin && <CobranzaImpersonationSelector />}
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0 text-right">
                  <p className="text-sm font-medium text-foreground truncate">{activeUserName}</p>
                  <p className="text-xs text-muted-foreground truncate">Cobranza</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-semibold shrink-0">
                  {activeInitials}
                </div>
              </div>
            </div>
          </header>

          {/* Mobile header */}
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
                <p className="text-[15px] font-semibold text-foreground tracking-tight truncate">{currentSection}</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
              {initials}
            </div>
          </header>

          <main className="p-4 lg:px-10 lg:py-8 bg-background min-h-[calc(100vh-56px)]">
            <Outlet />
          </main>
        </div>
      </div>
    </PortalTrackingProvider>
  );
};
