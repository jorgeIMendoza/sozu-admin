import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, User, LogOut, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { APP_VERSION } from "@/lib/config";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";
import { useUnreadCount } from "@/lib/portal-cliente/notification-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClienteImpersonationSelector } from "./ClienteImpersonationSelector";
import { PortalSearchInput } from "./PortalSearchInput";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
const sozuLogo = "/sozu-logo.png";

function truncateName(full: string, max = 22): string {
  const parts = full.trim().split(/\s+/);
  const short = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : (parts[0] ?? full);
  return short.length > max ? short.slice(0, max - 1).trimEnd() + "…" : short;
}

export const PortalClienteLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const showBackToAdmin = profile?.rol_nombre !== "Cliente";
const unreadCount = useUnreadCount();
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);

  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.key]);

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

  const isNarrow =
    /\/propiedad\/[^/]+/.test(location.pathname);

  return (
    <div className="inmob-portal min-h-screen bg-background [overflow-x:clip]">
      {/* ── Desktop sidebar ── */}
      <Sidebar
        appVersion={APP_VERSION}
        showBackToAdmin={showBackToAdmin}
        onBackToAdmin={() => navigate("/admin")}
        onSignOut={signOut}
        displayName={myName}
        userRole={myRole}
        isClient={profile?.rol_nombre === "Cliente"}
      />

      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* ── Desktop topbar ── */}
        <TopBar userName={myName} userRole={myRole} userPhone={myPhone} />

        {/* ── Mobile header ── */}
        <header className="md:hidden sticky top-0 z-20 bg-card border-b border-border">
          {/* Row 1: Logo | Back (centrado, solo superadmin) | Bell + Avatar */}
          <div className="flex items-center px-4 pt-3 pb-2 gap-3">
            {/* Logo */}
            <img src={sozuLogo} alt="SOZU" className="h-5 w-auto object-contain dark:invert shrink-0" />

            {/* Centro: Regresar al admin (solo superadmin) */}
            {showBackToAdmin && (
              <div className="flex-1 flex justify-center">
                <button
                  onClick={() => navigate("/admin")}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Regresar al admin
                </button>
              </div>
            )}
            {!showBackToAdmin && <div className="flex-1" />}

            {/* Derecha: Notificaciones + Perfil */}
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

          {/* Row 2: Buscador */}
          <div className="px-4 pb-2">
            <PortalSearchInput className="w-full" inputHeight="h-9" />
          </div>

          {/* Row 3: Selector de cliente (solo superadmin) */}
          {isSuperAdmin && (
            <div className="px-4 pb-3 flex items-center gap-2 min-w-0 overflow-hidden">
              <span className="text-[11px] text-muted-foreground shrink-0">Vista como:</span>
              <div className="flex-1 min-w-0">
                <ClienteImpersonationSelector />
              </div>
            </div>
          )}
        </header>

        {/* ── Page content ── */}
        <main
          className={`flex-1 w-full mx-auto pb-20 md:pb-8 ${
            isNarrow
              ? "md:max-w-5xl md:px-6 lg:px-8"
              : "md:max-w-none xl:max-w-7xl md:px-6 lg:px-8"
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <BottomNav />
    </div>
  );
};
