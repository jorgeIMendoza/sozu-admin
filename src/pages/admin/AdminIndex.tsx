import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Dashboard from "./Dashboard";
import { useAllowedMenus } from "@/hooks/useAllowedMenus";
import { useDynamicMenus } from "@/hooks/useDynamicMenus";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Landing de `/admin` en admin.sozu.com.
 *
 * El Dashboard requiere permiso de lectura sobre `/admin`. Los roles que solo
 * tienen portales (p. ej. un usuario con Portal Embajador y Portal Bancos) no lo
 * tienen, y PermissionRoute los rebotaba al primer portal de su menú sin dejarlos
 * elegir. Para ese caso se muestra un selector con sus portales; el sidebar de
 * AdminLayout sigue mostrando todos sus menús.
 */
export default function AdminIndex() {
  const { isPathAllowed, isSuperAdmin, isLoading } = useAllowedMenus();
  const { menuItems, isLoading: isMenuLoading } = useDynamicMenus();

  if (isSuperAdmin || isPathAllowed("/admin")) return <Dashboard />;

  // El primer submenú del portal es su landing (mismo criterio que el sidebar).
  const portales = menuItems
    .filter((item) => item.isPortal)
    .map((item) => ({
      title: item.title,
      icon: item.icon,
      href: item.href ?? item.children?.[0]?.href ?? null,
    }))
    .filter((p): p is { title: string; icon: typeof ArrowRight; href: string } => !!p.href);

  // Sin portales que ofrecer no hay nada que elegir: el Dashboard se encarga
  // (PermissionRoute ya redirige a los roles que sí tienen otra vista de inicio).
  if (!isLoading && !isMenuLoading && portales.length === 0) return <Dashboard />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Selecciona un portal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tienes acceso a más de un portal. Elige con cuál quieres trabajar; puedes cambiar
          desde el menú lateral en cualquier momento.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {portales.map((portal) => {
          const Icon = portal.icon;
          return (
            <Link key={portal.href} to={portal.href} className="block">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{portal.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{portal.href}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
