import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const SUB = [
  { titulo: "Bitácora", ruta: "/admin/inventario/precios/auditoria/bitacora" },
  { titulo: "Versiones", ruta: "/admin/inventario/precios/auditoria/versiones" },
  { titulo: "Ofertas vigentes", ruta: "/admin/inventario/precios/auditoria/ofertas" },
];

function AuditoriaLayout() {
  const pathname = useLocation().pathname;
  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-background p-1">
        {SUB.map((s) => {
          const activo = pathname.startsWith(s.ruta);
          return (
            <Link
              key={s.ruta}
              to={s.ruta}
              className={cn(
                "rounded px-3 py-1 text-[13px] transition-colors",
                activo
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.titulo}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}

export default AuditoriaLayout;
