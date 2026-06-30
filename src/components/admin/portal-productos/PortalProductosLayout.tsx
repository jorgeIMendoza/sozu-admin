import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProductosReales } from "@/hooks/usePortalProductos/useProductosReales";
import { usePortalProductosStore } from "@/lib/portal-productos/store";
import {
  LayoutDashboard, Package, BarChart3, History,
  ArrowLeft, LogOut, Menu, LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCanReturnToAdmin } from "@/hooks/useCanReturnToAdmin";
import {
  PortalProductosImpersonationProvider,
  usePortalProductosImpersonation,
} from "@/contexts/PortalProductosImpersonationContext";
import { PortalProductosImpersonationSelector } from "./PortalProductosImpersonationSelector";
import { APP_VERSION } from "@/lib/config";
import { SozuLogo } from "@/components/ui/SozuLogo";

interface NavLeaf { label: string; path: string; icon: LucideIcon }
interface NavGroup { label: string; items: NavLeaf[] }

const BASE = "/admin/portal-productos";

const navGroups: NavGroup[] = [
  {
    label: "Resumen",
    items: [
      { label: "Resumen Ejecutivo", path: `${BASE}/resumen`, icon: LayoutDashboard },
    ],
  },
  {
    label: "Operación",
    items: [
      { label: "Cartera de Productos", path: `${BASE}/cartera`, icon: Package },
    ],
  },
  {
    label: "Análisis",
    items: [
      { label: "Análisis de Cobranza", path: `${BASE}/analisis`, icon: BarChart3 },
      { label: "Histórico de Ventas", path: `${BASE}/historico`, icon: History },
    ],
  },
];

const SECTION_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const g of navGroups) for (const it of g.items) map[it.path] = it.label;
  return map;
})();

const PortalProductosLayoutInner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { impersonatedUser, isImpersonating } = usePortalProductosImpersonation();
  const isSuperAdmin = profile?.rol_id === 1;
  const { canReturnToAdmin } = useCanReturnToAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Carga de datos REALES de productos → store (reemplaza el mock).
  const { data: productosReales } = useProductosReales();
  const setCuentas = usePortalProductosStore((s) => s.setCuentas);
  useEffect(() => {
    if (productosReales) setCuentas(productosReales);
  }, [productosReales, setCuentas]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const currentSection = Object.entries(SECTION_LABELS).find(([p]) => isActive(p))?.[1] || "Portal de Productos";

  const handleNavigate = (path: string) => { navigate(path); setMobileOpen(false); };

  const activeUserName = isImpersonating
    ? impersonatedUser?.nombre || impersonatedUser?.email || profile?.nombre || profile?.email || "Usuario"
    : profile?.nombre || profile?.email || "Usuario";

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Administrador";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("") || "U";
  const activeInitials = activeUserName.split(" ").filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("") || "U";

  const sidebarContent = (
    <>
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <SozuLogo className="h-6" />
        <p className="text-[10px] font-semibold tracking-[0.18em] text-gray-500">
          Portal de Productos
        </p>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={cn(
                      "group relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium text-left",
                      active ? "bg-primary/[0.06] text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <span className={cn("absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-primary", active ? "opacity-100" : "opacity-0")} />
                    <item.icon className="size-4 shrink-0 opacity-70" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pt-1 pb-4 border-t border-border-soft space-y-1">
        <div className="w-full flex items-center gap-3 px-2 py-2 rounded-md">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
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
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <ArrowLeft className="size-4" /> Regresar
            </button>
          )}
          <button
            onClick={signOut}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10",
              canReturnToAdmin ? "flex-1" : "w-full"
            )}
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 font-mono text-center pt-0.5">{APP_VERSION}</p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex antialiased">
      <aside className="hidden lg:flex lg:flex-col border-r border-border bg-sidebar fixed inset-y-0 left-0 z-30 w-64">
        {sidebarContent}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 flex flex-col bg-sidebar">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      <div className="flex-1 lg:pl-64 min-w-0">
        <header className="hidden lg:flex items-center justify-between sticky top-0 z-20 bg-card border-b border-border-soft px-6 h-14">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="font-medium">Portal de Productos</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{currentSection}</span>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && <PortalProductosImpersonationSelector />}
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0 text-right">
                <p className="text-sm font-medium text-foreground truncate">{activeUserName}</p>
                <p className="text-xs text-muted-foreground truncate">Admin de Proyectos</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-semibold">
                {activeInitials}
              </div>
            </div>
          </div>
        </header>

        <header className="flex lg:hidden items-center justify-between sticky top-0 z-20 bg-card border-b border-border px-3 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="p-2 -ml-1 rounded-md text-foreground hover:bg-muted" aria-label="Abrir menú">
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-[15px] font-semibold text-foreground tracking-tight truncate">{currentSection}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
            {initials}
          </div>
        </header>

        <main className="px-8 py-4 bg-background min-h-[calc(100vh-56px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const PortalProductosLayout = () => (
  <PortalProductosImpersonationProvider>
    <PortalProductosLayoutInner />
  </PortalProductosImpersonationProvider>
);

export default PortalProductosLayout;