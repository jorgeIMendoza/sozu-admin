import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import PaymentHistoryView from "@/components/admin/portal-cliente/PaymentHistoryView";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import { getPropertyStatus } from "@/lib/portal-cliente/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";

const statusStyles: Record<string, { bg: string; text: string }> = {
  "Pago Pendiente": { bg: "bg-warning/15", text: "text-warning" },
  "En Preventa": { bg: "bg-primary/15", text: "text-primary" },
  Entregada: { bg: "bg-success/15", text: "text-success" },
  "En Escrituración": { bg: "bg-primary/15", text: "text-primary" },
  "Por Entregar": { bg: "bg-primary/15", text: "text-primary" },
  Completado: { bg: "bg-success/15", text: "text-success" },
};

const ClienteHistorialPagos = () => {
  const { data: portfolio = [], isLoading } = usePortfolioCliente();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  const propertyId = searchParams.get("p");

  const selected = portfolio.find(inv => inv.property.id === propertyId) ?? null;

  const filtered = portfolio.filter(inv =>
    `${inv.property.projectName} ${inv.property.unitNumber} ${inv.property.address}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="px-5 md:px-0 pt-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-64 bg-muted rounded-md" />
        <div className="h-20 bg-muted rounded-2xl" />
        <div className="h-20 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="animate-fade-in">
        <header className="px-5 md:px-0 pt-6 pb-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
              Historial de pagos
            </h1>
            <p className="text-[12px] text-muted-foreground truncate">
              {selected.property.projectName} - U-{selected.property.unitNumber}
            </p>
          </div>
        </header>
        <div className="px-5 md:px-0 pb-8">
          <PaymentHistoryView investment={selected} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header className="px-5 md:px-0 pt-6 pb-4">
        <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
          Historial de pagos
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">Selecciona una propiedad.</p>
      </header>

      <div className="px-5 md:px-0 pb-8 space-y-3">
        {portfolio.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No tienes propiedades activas.</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar propiedad…"
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2 max-h-[min(380px,60svh)] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin resultados</p>
              ) : (
                filtered.map(inv => {
                  const status = getPropertyStatus(inv);
                  const st = statusStyles[status.label] ?? { bg: "bg-muted", text: "text-muted-foreground" };
                  const progress = inv.financials.initialPrice > 0
                    ? Math.round((inv.financials.totalPaid / inv.financials.initialPrice) * 100)
                    : 0;
                  return (
                    <button
                      key={inv.property.id}
                      data-cta="cliente.historial-pagos.seleccionar-propiedad"
                      onClick={() => setSearchParams({ p: inv.property.id })}
                      className="w-full flex items-center gap-3.5 bg-card rounded-2xl border border-border p-4 transition-all active:scale-[0.98] hover:border-primary/30 text-left"
                    >
                      <div className={`w-10 h-10 rounded-xl ${st.bg} flex items-center justify-center shrink-0`}>
                        <span className={`font-display font-bold text-sm ${st.text}`}>{inv.property.unitNumber}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-sm text-foreground truncate">
                          {inv.property.projectName}
                          <span className="font-normal text-muted-foreground"> · U{inv.property.unitNumber}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[11px] font-medium ${st.text}`}>{status.label}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {progress}% pagado · {fmt(inv.financials.totalPaid)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClienteHistorialPagos;
