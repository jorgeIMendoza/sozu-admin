import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const SUB = [
  { titulo: "Esquemas", ruta: "/admin/inventario/precios/escenarios/esquemas" },
  { titulo: "Comparador", ruta: "/admin/inventario/precios/escenarios/comparador" },
  { titulo: "Cotizador", ruta: "/admin/inventario/precios/escenarios/cotizador" },
  { titulo: "Proyecto", ruta: "/admin/inventario/precios/escenarios/proyecto" },
];

function EscenariosLayout() {
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

export default EscenariosLayout;
