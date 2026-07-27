import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Search } from "lucide-react";
import { filterPortfolioByCategory } from "@/lib/portal-cliente/mock-data";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import { AcquisitionCard } from "@/components/admin/portal-cliente/investor/PropertyListCards";

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden animate-pulse">
      <div className="flex gap-4 p-4">
        <div className="w-[120px] h-[100px] rounded-xl bg-muted flex-shrink-0" />
        <div className="flex-1 flex flex-col justify-between gap-3 py-1">
          <div className="space-y-2">
            <div className="h-3.5 bg-muted rounded w-3/4" />
            <div className="h-2.5 bg-muted rounded w-1/2" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2 bg-muted rounded w-full" />
            <div className="h-[3px] bg-muted rounded-full w-full" />
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-1.5">
        <div className="h-[3px] bg-muted rounded-full w-full" />
        <div className="flex justify-between">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-2 bg-muted rounded w-10" />
          ))}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-border-subtle">
        <div className="h-2.5 bg-muted rounded w-1/3" />
      </div>
    </div>
  );
}

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
    <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center">
      <ShoppingBag className="w-5 h-5 text-muted-foreground" />
    </div>
    <p className="mt-4 font-display font-semibold text-foreground">
      No hay compras en curso
    </p>
    <p className="mt-1 text-[13px] text-muted-foreground max-w-md mx-auto">
      Cuando el cliente inicie una nueva adquisición, aparecerá aquí con su progreso, pagos pendientes y documentación.
    </p>
  </div>
);

const ClienteEnAdquisicion = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: portfolio, isLoading } = usePortfolioCliente();
  const items = portfolio ? filterPortfolioByCategory(portfolio, "in_acquisition") : [];
  const filtered = items.filter((inv) =>
    `${inv.property.projectName} ${inv.property.unitNumber} ${inv.property.location}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <>
      <section className="px-5 md:px-0 pt-6 pb-6">
        <div className="mb-5">
          <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
            En adquisición
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Propiedades en proceso de compra
            {!isLoading && items.length > 0 && ` · ${items.length} unidad${items.length === 1 ? "" : "es"} activa${items.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar propiedad…"
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin resultados</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filtered.map((inv) => (
                  <AcquisitionCard
                    key={inv.property.id}
                    inv={inv}
                    onClick={() =>
                      navigate(`/admin/portal-cliente/en-adquisicion/propiedad/${inv.property.id}`, {
                        state: { from: "en-adquisicion" },
                      })
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
};

export default ClienteEnAdquisicion;
