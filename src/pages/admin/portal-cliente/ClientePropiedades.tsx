import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, ShoppingBag, Wallet, Search } from "lucide-react";
import { filterPortfolioByCategory } from "@/lib/portal-cliente/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";
import { usePortfolioCliente } from "@/lib/portal-cliente/use-portfolio";
import {
  AcquisitionCard,
  PatrimonyCard,
} from "@/components/admin/portal-cliente/investor/PropertyListCards";

type Filtro = "todas" | "adquisicion" | "patrimonio";

const KpiCell = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "success";
}) => (
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

const CardSkeleton = () => (
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
    <div className="px-4 py-3 border-t border-border-subtle">
      <div className="h-2.5 bg-muted rounded w-1/3" />
    </div>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
    <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center">
      <Building2 className="w-5 h-5 text-muted-foreground" />
    </div>
    <p className="mt-4 font-display font-semibold text-foreground">
      Aún no hay propiedades
    </p>
    <p className="mt-1 text-[13px] text-muted-foreground max-w-md mx-auto">
      Cuando el cliente inicie una adquisición o reciba una propiedad, aparecerá aquí con su
      progreso, pagos y plusvalía.
    </p>
  </div>
);

const FILTERS: { id: Filtro; label: string; Icon: typeof Building2 }[] = [
  { id: "todas", label: "Todas", Icon: Building2 },
  { id: "adquisicion", label: "En adquisición", Icon: ShoppingBag },
  { id: "patrimonio", label: "Patrimonio", Icon: Wallet },
];

const VALID_FILTROS: Filtro[] = ["todas", "adquisicion", "patrimonio"];

// Encabezado de grupo (solo se pinta en la vista "Todas" para separar
// visualmente las unidades en compra de las ya entregadas).
const SectionHeader = ({
  Icon,
  label,
  hint,
  count,
}: {
  Icon: typeof Building2;
  label: string;
  hint: string;
  count: number;
}) => (
  <div className="flex items-center gap-2.5 mb-3">
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary">
      <Icon className="w-3.5 h-3.5" />
    </span>
    <div className="min-w-0">
      <h2 className="text-[13px] font-display font-semibold text-foreground leading-tight">
        {label}
        <span className="ml-1.5 tabular-nums text-[11px] font-medium text-muted-foreground">
          ({count})
        </span>
      </h2>
      <p className="text-[11px] text-muted-foreground leading-tight">{hint}</p>
    </div>
  </div>
);

const ClientePropiedades = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: portfolio, isLoading } = usePortfolioCliente();

  const paramFiltro = searchParams.get("filtro") as Filtro | null;
  const [filtro, setFiltroState] = useState<Filtro>(
    paramFiltro && VALID_FILTROS.includes(paramFiltro) ? paramFiltro : "todas",
  );
  const [search, setSearch] = useState("");

  const setFiltro = (f: Filtro) => {
    setFiltroState(f);
    setSearchParams(f === "todas" ? {} : { filtro: f }, { replace: true });
  };

  // Reaccionar a cambios de URL (ej. redirect desde /en-adquisicion o /patrimonio).
  useEffect(() => {
    const p = searchParams.get("filtro") as Filtro | null;
    if (p && VALID_FILTROS.includes(p) && p !== filtro) setFiltroState(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const acquisition = useMemo(
    () => (portfolio ? filterPortfolioByCategory(portfolio, "in_acquisition") : []),
    [portfolio],
  );
  const patrimony = useMemo(
    () => (portfolio ? filterPortfolioByCategory(portfolio, "active_patrimony") : []),
    [portfolio],
  );

  const totalCount = acquisition.length + patrimony.length;
  const patrimonyValue = patrimony.reduce((s, p) => s + p.financials.currentEstimatedValue, 0);
  const patrimonyPlusvalia = patrimony.reduce(
    (s, p) => s + (p.financials.currentEstimatedValue - p.financials.initialPrice),
    0,
  );

  const matchesSearch = (inv: (typeof acquisition)[number]) =>
    `${inv.property.projectName} ${inv.property.unitNumber} ${inv.property.location}`
      .toLowerCase()
      .includes(search.toLowerCase());

  const showAcq = filtro === "todas" || filtro === "adquisicion";
  const showPat = filtro === "todas" || filtro === "patrimonio";
  const acqFiltered = showAcq ? acquisition.filter(matchesSearch) : [];
  const patFiltered = showPat ? patrimony.filter(matchesSearch) : [];
  const visibleCount = acqFiltered.length + patFiltered.length;

  const countFor = (id: Filtro) =>
    id === "todas" ? totalCount : id === "adquisicion" ? acquisition.length : patrimony.length;

  return (
    <section className="px-5 md:px-0 pt-6 pb-6">
      <div className="mb-5">
        <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
          Propiedades
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Adquisiciones en curso y patrimonio entregado
          {!isLoading && totalCount > 0 && ` · ${totalCount} unidad${totalCount === 1 ? "" : "es"}`}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : totalCount === 0 ? (
        <EmptyState />
      ) : (
        <>
          {patrimony.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              <KpiCell label="Patrimonio activo" value={fmt(patrimonyValue)} tone="default" />
              <KpiCell
                label="Plusvalía acumulada"
                value={`+${fmt(Math.max(0, patrimonyPlusvalia))}`}
                tone="success"
              />
              <KpiCell label="Unidades entregadas" value={String(patrimony.length)} tone="default" />
            </div>
          )}

          {/* Filtro por categoría */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 w-full md:w-fit mb-4">
            {FILTERS.map(({ id, label, Icon }) => {
              const active = filtro === id;
              return (
                <button
                  key={id}
                  onClick={() => setFiltro(id)}
                  className={`flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  <span
                    className={`tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {countFor(id)}
                  </span>
                </button>
              );
            })}
          </div>

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

          {visibleCount === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin resultados</p>
          ) : (
            <div className="space-y-7">
              {acqFiltered.length > 0 && (
                <div>
                  {filtro === "todas" && (
                    <SectionHeader
                      Icon={ShoppingBag}
                      label="En adquisición"
                      hint="Unidades en proceso de compra"
                      count={acqFiltered.length}
                    />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {acqFiltered.map((inv) => (
                      <AcquisitionCard
                        key={inv.property.id}
                        inv={inv}
                        onClick={() =>
                          navigate(
                            `/admin/portal-cliente/en-adquisicion/propiedad/${inv.property.id}`,
                            { state: { from: "propiedades" } },
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {patFiltered.length > 0 && (
                <div>
                  {filtro === "todas" && (
                    <SectionHeader
                      Icon={Wallet}
                      label="Patrimonio"
                      hint="Propiedades ya entregadas"
                      count={patFiltered.length}
                    />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {patFiltered.map((inv) => (
                      <PatrimonyCard
                        key={inv.property.id}
                        inv={inv}
                        onClick={() =>
                          navigate(
                            `/admin/portal-cliente/patrimonio/propiedad/${inv.property.id}`,
                            { state: { from: "propiedades" } },
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ClientePropiedades;
