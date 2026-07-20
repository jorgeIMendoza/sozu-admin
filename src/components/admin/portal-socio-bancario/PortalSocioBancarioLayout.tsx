import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FolderOpen,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  TrendingUp,
  LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/SozuLogo";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { useSocioProyecto } from "@/hooks/usePortalSocioBancario/useSocioProyecto";

/**
 * Selector de desarrollo — visible SOLO cuando el banco financió más de uno.
 * Cambia el desarrollo activo que consumen todos los módulos del portal.
 */
function DesarrolloSelector() {
  const { desarrollos, idProyecto, setDesarrolloActivo } = useSocioProyecto();
  if (desarrollos.length <= 1) return null;
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-[12px] font-medium text-muted-foreground">Desarrollo:</span>
      <Select
        value={idProyecto != null ? String(idProyecto) : undefined}
        onValueChange={(v) => setDesarrolloActivo(Number(v))}
      >
        <SelectTrigger className="h-9 w-[280px]">
          <SelectValue placeholder="Selecciona un desarrollo" />
        </SelectTrigger>
        <SelectContent>
          {desarrollos.map((d) => (
            <SelectItem key={d.id} value={String(d.id)}>
              {d.nombre ?? `Desarrollo #${d.id}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const BASE = "/admin/portal-socio-bancario";

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Navegación del Portal Socio Bancario V1. Reencuadrado alrededor de la única
 * pregunta del banco: ¿la obra avanza, se vende, y las ventas son reales?
 * (Resumen → Obra → Comercialización → Evidencia).
 *
 * Las rutas confidenciales / fuera de scope (Ingresos y Egresos, Análisis de
 * Cobranza, Forecast de Ingresos) fueron removidas del sidebar y del router por
 * confidencialidad; sus componentes se conservan con @deprecated.
 */
const navGroups: NavGroup[] = [
  {
    label: "Resumen",
    items: [{ label: "Resumen del Desarrollo", path: `${BASE}/resumen`, icon: LayoutDashboard }],
  },
  {
    label: "Obra",
    items: [{ label: "Avance de Obra", path: `${BASE}/avance-obra`, icon: HardHat }],
  },
  {
    label: "Comercialización",
    items: [{ label: "Ventas e Inventario", path: `${BASE}/ventas-inventario`, icon: TrendingUp }],
  },
  {
    label: "Evidencia",
    items: [{ label: "Expedientes", path: `${BASE}/expedientes`, icon: FolderOpen }],
  },
];

const PortalSocioBancarioLayoutInner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const currentSection =
    navGroups.flatMap((g) => g.items).find((i) => isActive(i.path))?.label ??
    "Socio Bancario";

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  // El banco es un socio de solo lectura: el pie muestra "Socio Bancario",
  // nunca el rol interno (Super Administrador / Administrador de Proyecto).
  const userRole = "Socio Bancario";
  const initials =
    userName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p.charAt(0).toUpperCase())
      .join("") || "U";

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <SozuLogo className="h-6" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal Socio Bancario
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
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={cn(
                      "group relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 text-left",
                      active
                        ? "bg-primary/[0.06] text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary transition-opacity duration-150",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <item.icon
                      className={cn(
                        "size-4 shrink-0",
                        active
                          ? ""
                          : "opacity-60 group-hover:opacity-100 transition-opacity duration-150",
                      )}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
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
          {canReturnToAdmin && (
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
              canReturnToAdmin ? "flex-1" : "w-full",
            )}
          >
            <LogOut className="size-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/40 font-mono text-center pt-0.5">
          {APP_VERSION}
        </p>
      </div>
    </>
  );

  return (
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
              <p className="text-[15px] font-semibold text-foreground tracking-tight truncate">
                {currentSection}
              </p>
            </div>
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shrink-0">
              {initials}
            </div>
          </div>
        </header>

        <main className="px-8 py-4 bg-background min-h-screen">
          {/* Sin selector "Ver como": el banco no impersona. Selector de
              desarrollo solo si el banco financió más de uno. */}
          <DesarrolloSelector />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const PortalSocioBancarioLayout = () => (
  <PortalTrackingProvider portal="socio-bancario">
    <PortalSocioBancarioLayoutInner />
  </PortalTrackingProvider>
);

export default PortalSocioBancarioLayout;
