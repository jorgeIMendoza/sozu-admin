import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, User, LogOut, Phone, Menu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { APP_VERSION } from "@/lib/config";
import { useUnreadCount } from "@/lib/portal-cliente/notification-data";
import { usePortalNavItems, isNavItemActive } from "@/lib/portal-cliente/portal-nav-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ClienteImpersonationSelector } from "./ClienteImpersonationSelector";
import { PortalSearchInput } from "./PortalSearchInput";
import Sidebar, { SidebarContent } from "./Sidebar";
import TopBar from "./TopBar";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";

function truncateName(full: string, max = 22): string {
  const parts = full.trim().split(/\s+/);
  const short = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : (parts[0] ?? full);
  return short.length > max ? short.slice(0, max - 1).trimEnd() + "…" : short;
}

export const PortalClienteLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const showBackToAdmin = canReturnToAdmin;
  const unreadCount = useUnreadCount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);

  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.key]);

  const { data: navItems = [] } = usePortalNavItems();
  const currentSection = navItems.find(item => isNavItemActive(item.route, location.pathname))?.label ?? "Portal";

  const { data: myPersonaData } = useQuery({
    queryKey: ["portal-my-persona", profile?.id_persona],
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
  const myName = truncateName(myRawName);
  const myRole = profile?.rol_nombre ?? "Cliente";
  const myPhone = myPersonaData?.clave_pais_telefono && myPersonaData?.telefono
    ? `${myPersonaData.clave_pais_telefono} ${myPersonaData.telefono}`
    : myPersonaData?.telefono ?? undefined;

  const myInitials = myName
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const isNarrow = /\/propiedad\/[^/]+/.test(location.pathname);

  const sidebarProps = {
    appVersion: APP_VERSION,
    showBackToAdmin,
    onBackToAdmin: () => { navigate("/admin"); setMobileOpen(false); },
    onSignOut: signOut,
    displayName: myName,
    userRole: myRole,
    isClient: profile?.rol_nombre === "Cliente",
  };

  return (
    <PortalTrackingProvider portal="clientes">
      <div className="inmob-portal min-h-screen flex bg-background [overflow-x:clip]">
        {/* Desktop sidebar */}
        <Sidebar {...sidebarProps} />

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64 flex flex-col bg-sidebar">
            <SidebarContent
              {...sidebarProps}
              onAfterNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex-1 lg:pl-64 min-w-0 flex flex-col min-h-screen">
          {/* Desktop topbar */}
          <TopBar userName={myName} userRole={myRole} userPhone={myPhone} />

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
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => navigate("/admin/portal-cliente/notificaciones")}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                  aria-label="Notificaciones"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-destructive" />
                  )}
                </button>
                <Popover open={mobileProfileOpen} onOpenChange={setMobileProfileOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                      aria-label="Mi perfil"
                    >
                      {myInitials}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={8} className="w-60 p-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border-soft bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-semibold shrink-0">
                          {myInitials}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[13px] font-semibold text-foreground truncate">{myName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{myRole}</p>
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
                        onClick={() => { navigate("/admin/portal-cliente/perfil"); setMobileProfileOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-foreground hover:bg-muted/60 transition-colors duration-150"
                      >
                        <User className="size-4 text-muted-foreground shrink-0" />
                        Ver perfil
                      </button>
                      <button
                        onClick={() => { signOut(); setMobileProfileOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-destructive hover:bg-destructive/10 transition-colors duration-150"
                      >
                        <LogOut className="size-4 shrink-0" />
                        Cerrar sesión
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 pb-2">
              <PortalSearchInput className="w-full" inputHeight="h-9" />
            </div>

            {/* Impersonation (solo superadmin) */}
            {isSuperAdmin && (
              <div className="px-4 pb-3 flex items-center gap-2 min-w-0 overflow-hidden">
                <span className="text-[11px] text-muted-foreground shrink-0">Vista como:</span>
                <div className="flex-1 min-w-0">
                  <ClienteImpersonationSelector />
                </div>
              </div>
            )}
          </header>

          {/* Page content */}
          <main
            className={`flex-1 w-full mx-auto pb-8 ${
              isNarrow
                ? "md:max-w-5xl md:px-6 lg:px-8"
                : "md:max-w-none xl:max-w-7xl md:px-6 lg:px-8"
            }`}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </PortalTrackingProvider>
  );
};
