import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { usePortalPersonalNav } from "@/hooks/usePortalPersonalNav";
import {
  PortalPersonalImpersonationProvider,
  usePortalPersonalImpersonation,
} from "@/contexts/PortalPersonalImpersonationContext";
import { PortalPersonalImpersonationSelector } from "./PortalPersonalImpersonationSelector";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/sozu-logo";

const PortalPersonalLayoutInner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { impersonatedUser, isImpersonating } = usePortalPersonalImpersonation();
  const canImpersonate = profile?.puede_impersonar === true;
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const { items } = usePortalPersonalNav();
  const [mobileOpen, setMobileOpen] = useState(false);

  const modoPresentacion = usePortal((s) => s.modo_presentacion);
  const setModoPresentacion = usePortal((s) => s.setModoPresentacion);

  // El nombre/correo que ve el portal sigue al usuario suplantado.
  useEffect(() => {
    usePortal.setState((s) => ({
      usuario: {
        ...s.usuario,
        nombre: isImpersonating
          ? impersonatedUser!.nombre
          : profile?.nombre || profile?.email || s.usuario.nombre,
        correo: isImpersonating
          ? impersonatedUser!.email
          : profile?.email || s.usuario.correo,
        rol: isImpersonating
          ? impersonatedUser!.rol_nombre
          : profile?.rol_nombre || s.usuario.rol,
      },
    }));
  }, [isImpersonating, impersonatedUser, profile?.nombre, profile?.email, profile?.rol_nombre]);

  const isActive = (path: string) =>
    path === "/admin/portal-personal"
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(path + "/");

  const currentSection = useMemo(
    () => items.find((i) => isActive(i.path))?.label ?? "Portal del Personal",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, location.pathname],
  );

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const activeUserName = isImpersonating
    ? impersonatedUser?.nombre || impersonatedUser?.email || "Usuario"
    : profile?.nombre || profile?.email || "Usuario";

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Usuario";
  const inits = (s: string) =>
    s.split(" ").filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "U";

  const sidebarContent = (
    <>
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4">
        <SozuLogo className="h-6" />
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          Portal del Personal
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No tienes vistas habilitadas en este portal.
          </p>
        )}
        {items.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md py-2 pl-4 pr-3 text-left text-[13px] font-medium",
                active
                  ? "bg-primary/[0.06] text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "absolute bottom-0 left-0 top-0 w-[2px] rounded-r bg-primary",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <item.icon className="size-4 shrink-0 opacity-70" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border px-3 pb-4 pt-1">
        <div className="flex w-full items-center gap-3 rounded-md px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {inits(userName)}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[13px] font-medium text-foreground">{userName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{userRole}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canReturnToAdmin && (
            <button
              onClick={() => handleNavigate("/admin")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Regresar
            </button>
          )}
          <button
            onClick={signOut}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-destructive hover:bg-destructive/10",
              canReturnToAdmin ? "flex-1" : "w-full",
            )}
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
        <p className="pt-0.5 text-center font-mono text-[10px] text-muted-foreground/40">
          {APP_VERSION}
        </p>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen antialiased">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-sidebar lg:flex lg:flex-col">
        {sidebarContent}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-64 flex-col bg-sidebar p-0">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1 lg:pl-64">
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-border bg-card px-6 lg:flex">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="font-medium">Portal del Personal</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{currentSection}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModoPresentacion(!modoPresentacion)}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60"
              title="Oculta montos sensibles para presentar en pantalla"
            >
              {modoPresentacion ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              Modo presentación
            </button>
            {canImpersonate && <PortalPersonalImpersonationSelector />}
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-medium text-foreground">{activeUserName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isImpersonating ? impersonatedUser?.rol_nombre : userRole}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
                {inits(activeUserName)}
              </div>
            </div>
          </div>
        </header>

        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="-ml-1 rounded-md p-2 text-foreground hover:bg-muted"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {currentSection}
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {inits(userName)}
          </div>
        </header>

        <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-5 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const PortalPersonalLayout = () => (
  <PortalPersonalImpersonationProvider>
    <PortalPersonalLayoutInner />
  </PortalPersonalImpersonationProvider>
);

export default PortalPersonalLayout;
