import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, ArrowLeft, LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { label: "Inicio", path: "/admin/portal-juridico/inicio", icon: Home },
];

export const PortalJuridicoLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuperAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");
  const go = (p: string) => { navigate(p); setMobileOpen(false); };
  const displayName = profile?.nombre || "Jurídico";
  const initials = (displayName).split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const SidebarBody = () => (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="px-6 py-5 border-b">
        <div className="text-xs text-muted-foreground">Portal</div>
        <div className="text-lg font-semibold tracking-tight">Portal Jurídico</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t p-4 space-y-2">
        {isSuperAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al admin
          </button>
        )}
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <PortalTrackingProvider portal="juridico">
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 border-r">
        <SidebarBody />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarBody />
        </SheetContent>
      </Sheet>

      <div className="lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 h-14 border-b bg-card/80 backdrop-blur flex items-center justify-between px-4 lg:px-6">
          <button className="lg:hidden p-2 -ml-2" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{displayName}</div>
              <div className="text-xs text-muted-foreground">{profile?.rol_nombre}</div>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
    </PortalTrackingProvider>
  );
};
