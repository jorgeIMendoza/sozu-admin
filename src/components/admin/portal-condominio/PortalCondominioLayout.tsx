import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Landmark,
  CircleDollarSign,
  Banknote,
  CalendarDays,
  ShieldCheck,
  FileCheck,
  Settings2,
  ArrowLeft,
  LogOut,
  Menu,
  LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/SozuLogo";
import { CondominioProvider, useCondominio } from "@/contexts/CondominioContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { usePortalNav } from "@/hooks/usePortalNav";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";

const CONDOMINIO_MENU_ID = 30;

// Item del módulo Titularidad. La nav del portal se lee de BD (`usePortalNav`),
// pero este módulo es UI + mock en esta fase, así que se inyecta en el front
// entre "Cobranza" y "Tesorería". Dedupe por ruta: si el submenu ya existe en
// BD (una vez aplicados los INSERT de Ejecuciones_manuales), no se duplica.
const TITULARIDAD_PATH = "/admin/portal-condominio/titularidad";
const COBRANZA_PATH = "/admin/portal-condominio/cobranza";

const iconMap: Record<string, LucideIcon> = {
  "/admin/portal-condominio/dashboard":     LayoutDashboard,
  "/admin/portal-condominio/departamentos": Building2,
  "/admin/portal-condominio/cargos":        Receipt,
  "/admin/portal-condominio/pagos":         Landmark,
  "/admin/portal-condominio/cobranza":      CircleDollarSign,
  "/admin/portal-condominio/titularidad":   FileCheck,
  "/admin/portal-condominio/tesoreria":     Banknote,
  "/admin/portal-condominio/amenidades":    CalendarDays,
  "/admin/portal-condominio/auditoria":     ShieldCheck,
  "/admin/portal-condominio/configuracion": Settings2,
};

function CondominioSelector({ className }: { className?: string }) {
  const { condominios, proyectoId, setProyectoId, isLoading } = useCondominio();
  if (isLoading) return <span className="text-xs text-muted-foreground">Cargando…</span>;
  if (condominios.length === 0) return <span className="text-xs text-muted-foreground">Sin condominios</span>;
  return (
    <select
      value={proyectoId ?? ""}
      onChange={(e) => setProyectoId(Number(e.target.value))}
      className={cn("h-8 px-2 rounded-md border border-border bg-background text-sm", className)}
      aria-label="Seleccionar condominio"
    >
      {condominios.map((c) => (
        <option key={c.id} value={c.id}>{c.nombre}</option>
      ))}
    </select>
  );
}

const PortalCondominioLayoutInner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navFromDb = usePortalNav(CONDOMINIO_MENU_ID, iconMap, LayoutDashboard);
  const { disabledPaths } = useAllowedMenus();
  const navItems = (() => {
    const composed = (() => {
      if (navFromDb.some((i) => i.path === TITULARIDAD_PATH)) return navFromDb;
      const item = { path: TITULARIDAD_PATH, label: "Titularidad", icon: FileCheck };
      const idx = navFromDb.findIndex((i) => i.path === COBRANZA_PATH);
      if (idx === -1) return [...navFromDb, item];
      const copy = [...navFromDb];
      copy.splice(idx + 1, 0, item);
      return copy;
    })();
    // Ocultar vistas apagadas en BD (submenu activo=false o menú padre inactivo)
    return composed.filter((i) => !disabledPaths.has(i.path));
  })();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const currentSection = navItems.find((i) => isActive(i.path))?.label || "Condominio";
  const isSuperAdmin = profile?.rol_id === 1;
  const { canReturnToAdmin } = useCanReturnToAdmin();

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Condominio";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join("") || "U";

  const go = (path: string) => { navigate(path); setMobileOpen(false); };

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <SozuLogo className="h-6" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal Condominio
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => go(item.path)}
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
              onClick={() => go("/admin")}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Regresar
            </button>
          )}
          <button
            onClick={() => signOut()}
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
    <PortalTrackingProvider portal="condominio">
      <div className="min-h-screen flex antialiased">
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
          <header className="hidden lg:flex items-center justify-between sticky top-0 z-20 bg-card border-b border-border-soft px-6 h-14">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="font-medium">Portal Condominio</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{currentSection}</span>
            </div>
            <div className="flex items-center gap-3">
              <CondominioSelector />
              <div className="min-w-0 text-right">
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userRole}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-semibold shrink-0">
                {initials}
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
            <div className="flex items-center gap-2 shrink-0">
              <CondominioSelector />
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
                {initials}
              </div>
            </div>
          </header>

          <main className="px-8 py-4 bg-background min-h-[calc(100vh-56px)]">
            <Outlet />
          </main>
        </div>
      </div>
    </PortalTrackingProvider>
  );
};

export const PortalCondominioLayout = () => (
  <CondominioProvider>
    <PortalCondominioLayoutInner />
  </CondominioProvider>
);

export default PortalCondominioLayout;
