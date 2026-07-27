import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Search } from "lucide-react";
import { filterPortfolioByCategory } from "@/lib/portal-cliente/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import { PatrimonyCard } from "@/components/admin/portal-cliente/investor/PropertyListCards";

const KpiCell = ({ label, value, tone }: { label: string; value: string; tone: "default" | "success" }) => (
  <div className="rounded-2xl bg-card border border-border p-4">
    <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
      {label}
    </p>
    <p
      className={`mt-2 font-display font-bold text-[22px] tabular-nums ${
        tone === "success" ? "text-success" : "text-foreground"
      }`}
    >
      {value}
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
    <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center">
      <Wallet className="w-5 h-5 text-muted-foreground" />
    </div>
    <p className="mt-4 font-display font-semibold text-foreground">
      Tu patrimonio se construirá aquí
    </p>
    <p className="mt-1 text-[13px] text-muted-foreground max-w-md mx-auto">
      Cuando alguna de tus propiedades sea entregada, pasará automáticamente a esta sección donde
      podrás gestionar mantenimiento, ver plusvalía y administrar tus activos.
    </p>
  </div>
);

const SkeletonCard = () => (
  <div className="rounded-2xl bg-card border border-border overflow-hidden animate-pulse">
    <div className="flex gap-4 p-4">
      <div className="w-[120px] h-[100px] rounded-xl bg-muted flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-3">
        <div className="h-4 bg-muted rounded-md w-3/4" />
        <div className="h-3 bg-muted rounded-md w-1/2" />
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="h-8 bg-muted rounded-md" />
          <div className="h-8 bg-muted rounded-md" />
        </div>
      </div>
    </div>
    <div className="px-4 py-3 border-t border-border-subtle flex gap-3">
      <div className="h-5 bg-muted rounded-full w-20" />
      <div className="h-5 bg-muted rounded-md w-32" />
    </div>
  </div>
);

const ClientePatrimonio = () => {
  const navigate = useNavigate();
  const { data: portfolio, isLoading } = usePortfolioCliente();
  const [search, setSearch] = useState("");

  const items = portfolio ? filterPortfolioByCategory(portfolio, "active_patrimony") : [];
  const filtered = items.filter((inv) =>
    `${inv.property.projectName} ${inv.property.unitNumber} ${inv.property.location}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const totalValue = items.reduce((s, p) => s + p.financials.currentEstimatedValue, 0);
  const totalPlusvalia = items.reduce(
    (s, p) => s + (p.financials.currentEstimatedValue - p.financials.initialPrice),
    0,
  );

  return (
    <>
      <section className="px-5 md:px-0 pt-6 pb-6">
        <div className="mb-5">
          <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
            Mi patrimonio
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Tus propiedades entregadas
            {!isLoading && items.length > 0 && ` · ${items.length} unidad${items.length === 1 ? "" : "es"}`}
          </p>
        </div>

        {isLoading ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              <div className="rounded-2xl bg-card border border-border p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-2/3 mb-3" />
                <div className="h-7 bg-muted rounded w-3/4" />
              </div>
              <div className="rounded-2xl bg-card border border-border p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-2/3 mb-3" />
                <div className="h-7 bg-muted rounded w-3/4" />
              </div>
              <div className="rounded-2xl bg-card border border-border p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-2/3 mb-3" />
                <div className="h-7 bg-muted rounded w-3/4" />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        ) : (
          <>
            {items.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                <KpiCell label="Valor actual" value={fmt(totalValue)} tone="default" />
                <KpiCell label="Plusvalía acumulada" value={`+${fmt(Math.max(0, totalPlusvalia))}`} tone="success" />
                <KpiCell label="Unidades activas" value={String(items.length)} tone="default" />
              </div>
            )}

            {items.length === 0 ? (
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
                      <PatrimonyCard
                        key={inv.property.id}
                        inv={inv}
                        onClick={() =>
                          navigate(`/admin/portal-cliente/patrimonio/propiedad/${inv.property.id}`, {
                            state: { from: "patrimonio" },
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
    </>
  );
};

export default ClientePatrimonio;
