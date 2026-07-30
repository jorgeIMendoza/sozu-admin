import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Inbox, Workflow, BarChart3, Users, Landmark, ScrollText, ArrowLeft, LogOut, Menu, LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/sozu-logo";
import { BankImpersonationProvider, useCurrentBanco } from "@/contexts/BankImpersonationContext";
import { BankImpersonationSelector } from "./BankImpersonationSelector";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { usePortalNav } from "@/hooks/usePortalNav";
import { bancoThemeVars } from "@/lib/portal-bancos/branding";

const BANCOS_MENU_ID = 32;

const iconMap: Record<string, LucideIcon> = {
  "/admin/portal-bancos/bandeja":  Inbox,
  "/admin/portal-bancos/pipeline": Workflow,
  "/admin/portal-bancos/tablero":  BarChart3,
  "/admin/portal-bancos/equipo":   Users,
  "/admin/portal-bancos/bancos":   Landmark,
  "/admin/portal-bancos/notarias": ScrollText,
};

/**
 * Shell del portal. Vive DENTRO de `BankImpersonationProvider` porque necesita
 * el banco en scope (`useCurrentBanco`) para el branding: logo junto al nombre
 * del usuario y colores de marca aplicados a todo el portal.
 */
const PortalBancosShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const banco = useCurrentBanco();
  // Colores del banco → variables CSS del design system. Sin color de marca (o
  // en la vista global "Super Administrador") se conserva el verde SOZU.
  const themeVars = bancoThemeVars(banco?.color_marca);

  const navAll = usePortalNav(BANCOS_MENU_ID, iconMap, Inbox);
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const { isPathAllowed } = useAllowedMenus();

  // Navegación 100% desde BD: `submenus` del menú (usePortalNav) filtrado por el
  // permiso de lectura del rol. Antes había ítems hardcodeados (Equipo / Bancos /
  // Notarías) con reglas por rol_id/nombre, así que "Notarías" aparecía siempre
  // aunque no existiera el submenú y Equipo se mostraba a roles sin permiso.
  // `isPathAllowed` ya descarta las vistas apagadas (submenu/menú activo=false).
  const NAV = navAll.filter((i) => isPathAllowed(i.path));

  const isActive = (p: string) => location.pathname === p || location.pathname.startsWith(p + "/");
  const current = NAV.find((i) => isActive(i.path))?.label ?? "Portal Bancos";

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Bancos";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join("") || "U";

  const go = (path: string) => { navigate(path); setMobileOpen(false); };

  const sidebar = (
    <>
      {/* Brand — SOZU + marca del banco en scope (si tiene branding cargado) */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <SozuLogo className="h-6" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal Bancos
        </p>
        {banco && (
          <div className="flex items-center gap-2 pt-2">
            <BancoMark banco={banco} className="h-6 w-6" />
            <span className="text-[11px] font-medium text-foreground truncate">{banco.nombre}</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
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
          {banco && <BancoMark banco={banco} className="h-6 w-6" />}
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
            className={`${canReturnToAdmin ? "flex-1" : "w-full"} flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10 transition-colors`}
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
        <div className="min-h-screen flex antialiased" style={themeVars}>
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
                <span className="font-medium">Portal Bancos</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{current}</span>
              </div>
              <div className="flex items-center gap-3 min-w-0">
                {/* Logo del banco del usuario, junto a su nombre */}
                {banco && <BancoMark banco={banco} className="h-8 w-8" />}
                <div className="min-w-0 text-right">
                  <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {banco ? `${userRole} · ${banco.nombre}` : userRole}
                  </p>
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
                  <p className="text-[15px] font-semibold text-foreground tracking-tight truncate">{current}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {banco && <BancoMark banco={banco} className="h-7 w-7" />}
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
                  {initials}
                </div>
              </div>
            </header>

            <main className="px-8 py-4 bg-background min-h-[calc(100vh-56px)]">
              <BankImpersonationSelector />
              <Outlet />
            </main>
          </div>
        </div>
  );
};

/**
 * Marca del banco: ícono cuadrado (`icono_url`) o, en su defecto, el logo
 * (`logo_url`). Sin imagen cargada cae a un cuadro con el color de marca y las
 * iniciales, para que el portal nunca quede sin identidad visual.
 */
function BancoMark({
  banco,
  className,
}: {
  banco: { nombre: string; color_marca: string | null; logo_url: string | null; icono_url: string | null };
  className?: string;
}) {
  const src = banco.icono_url ?? banco.logo_url;
  if (src) {
    return (
      <img
        src={src}
        alt={banco.nombre}
        className={cn("rounded-md border bg-white object-contain shrink-0", className)}
      />
    );
  }
  const ini = banco.nombre.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "B";
  return (
    <span
      className={cn(
        "rounded-md border flex items-center justify-center text-[10px] font-bold text-white shrink-0",
        className,
      )}
      style={{ backgroundColor: banco.color_marca ?? "#9ca3af" }}
      title={banco.nombre}
    >
      {ini}
    </span>
  );
}

export const PortalBancosLayout = () => (
  <BankImpersonationProvider>
    <PortalTrackingProvider portal="bancos">
      <PortalBancosShell />
    </PortalTrackingProvider>
  </BankImpersonationProvider>
);

export default PortalBancosLayout;
