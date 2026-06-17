import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Landmark,
  Stamp,
  CalendarDays,
  PackageCheck,
  ArrowLeft,
  LogOut,
  Menu,
  LucideIcon,
  Receipt,
  ShieldAlert,
  Scale,
  HeartHandshake,
  GitBranch,
  FileSearch,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PortalTrackingProvider } from "@/contexts/PortalTrackingContext";
import { APP_VERSION, SOZU_LOGO_URL } from "@/lib/config";

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Escrituración",         path: "/admin/portal-escrituracion/dashboard",      icon: LayoutDashboard },
  { label: "Expedientes",           path: "/admin/portal-escrituracion/expedientes",    icon: FileText },
  { label: "Relación de Pagos",     path: "/admin/portal-escrituracion/relacion-pagos", icon: Receipt },
  { label: "Notarías",              path: "/admin/portal-escrituracion/notarias",       icon: Stamp },
  { label: "PLD",                   path: "/admin/portal-escrituracion/pld",            icon: ShieldAlert },
  { label: "Créditos Hipotecarios", path: "/admin/portal-escrituracion/credito",        icon: Landmark },
  { label: "Programar Citas",       path: "/admin/portal-escrituracion/citas",          icon: CalendarDays },
  { label: "Demandas",              path: "/admin/portal-escrituracion/demandas",       icon: Scale },
  { label: "Entregas",              path: "/admin/portal-escrituracion/entregas",       icon: PackageCheck },
  { label: "Postventa",             path: "/admin/portal-escrituracion/postventa",      icon: HeartHandshake },
  { label: "Workflow",              path: "/admin/portal-escrituracion/workflow",        icon: GitBranch },
  { label: "Validación Contratos", path: "/admin/portal-escrituracion/validacion-contratos", icon: FileSearch },
];

export const PortalEscrituracionLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const currentSection = navItems.find((i) => isActive(i.path))?.label || "Escrituración";

  const rawName = profile?.nombre || profile?.email?.split("@")[0] || "Usuario";
  const userName = rawName.trim().split(/\s+/).slice(0, 2).join(" ");
  const userRole = profile?.rol_nombre ?? "Escrituración";
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join("") || "U";

  const sidebar = (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border-soft flex flex-col gap-1">
        <img src={SOZU_LOGO_URL} alt="SOZU" className="h-6 w-auto object-contain object-left dark:invert" />
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-500">
          Portal Escrituración
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
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
          <button
            onClick={() => navigate("/admin")}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Regresar
          </button>
          <button
            onClick={signOut}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-destructive hover:bg-destructive/10 transition-colors"
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
    <PortalTrackingProvider portal="escrituracion">
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
                <p className="text-[15px] font-semibold text-foreground tracking-tight truncate">{currentSection}</p>
              </div>
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shrink-0">
                {initials}
              </div>
            </div>
          </header>

          <main className="p-4 lg:px-8 lg:py-6 bg-background min-h-screen">
            <Outlet />
          </main>
        </div>
      </div>
    </PortalTrackingProvider>
  );
};

export default PortalEscrituracionLayout;
