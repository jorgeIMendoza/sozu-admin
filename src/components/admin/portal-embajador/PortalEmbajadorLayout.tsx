import { Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmbajadorImpersonation } from "@/contexts/EmbajadorImpersonationContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmbajadorImpersonationSelector } from "./EmbajadorImpersonationSelector";

export const PortalEmbajadorLayout = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { impersonatedEmbajadorName, isImpersonating } = useEmbajadorImpersonation();

  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;

  const displayName = isImpersonating
    ? impersonatedEmbajadorName
    : profile?.nombre || "Embajador";

  const initials = (displayName || "EM")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <PortalTrackingProvider portal="embajadores">
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 h-14 border-b bg-card/80 backdrop-blur flex items-center justify-between px-4 lg:px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:block">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none">Portal</div>
            <div className="text-sm font-semibold leading-tight">Embajadores SOZU</div>
          </div>
          {isSuperAdmin && (
            <div className="hidden sm:flex">
              <EmbajadorImpersonationSelector />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Volver al admin</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </Button>
          <div className="text-right hidden md:block pl-2 border-l">
            <div className="text-sm font-medium leading-tight">{displayName}</div>
            <div className="text-xs text-muted-foreground leading-tight">
              {isImpersonating ? "Vista embajador" : profile?.rol_nombre}
            </div>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {isSuperAdmin && (
        <div className="sm:hidden border-b bg-card/60 px-4 py-2">
          <EmbajadorImpersonationSelector />
        </div>
      )}

      <main className="flex-1 px-8 py-4 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
    </PortalTrackingProvider>
  );
};
