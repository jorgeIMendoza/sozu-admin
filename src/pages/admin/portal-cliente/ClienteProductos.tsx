import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, ChevronLeft, Search, Package } from "lucide-react";
import { useClienteProductos, type PropiedadConProductos, type ProductoCliente } from "@/hooks/useClienteProductos";
import ProductoHistorialView from "@/components/admin/portal-cliente/ProductoHistorialView";
import { fmtMXN as fmt } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ProductoCliente["status"], { label: string; badge: string }> = {
  pendiente:  { label: "Pendiente",  badge: "bg-warning/15 text-warning border-warning/30" },
  financiado: { label: "En curso",   badge: "bg-primary/10 text-primary border-primary/30" },
  pagado:     { label: "Pagado",     badge: "bg-success/15 text-success border-success/30" },
};

// ── Skeleton & Empty ──────────────────────────────────────────────────────────

const Skeleton = () => (
  <div className="px-5 md:px-0 pt-6 space-y-4 animate-pulse">
    <div className="h-8 w-48 bg-muted rounded-lg" />
    <div className="h-4 w-64 bg-muted rounded-md" />
    <div className="h-20 bg-muted rounded-2xl" />
    <div className="h-20 bg-muted rounded-2xl" />
  </div>
);

// ── Product tabs (selector when >1 product in a propiedad) ────────────────────

const ProductoTabs = ({
  productos,
  selectedId,
  onSelect,
}: {
  productos: ProductoCliente[];
  selectedId: number;
  onSelect: (id: number) => void;
}) => (
  <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 md:mx-0 md:px-0">
    {productos.map((p) => {
      const active = p.cuentaId === selectedId;
      const cfg = STATUS_CFG[p.status];
      return (
        <button
          key={p.cuentaId}
          data-cta="cliente.productos.seleccionar"
          onClick={() => onSelect(p.cuentaId)}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium border transition-colors ${
            active
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span className="truncate max-w-[140px]">{p.nombre}</span>
          {!active && (
            <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${cfg.badge}`}>
              {cfg.label}
            </Badge>
          )}
        </button>
      );
    })}
  </div>
);

// ── Detail screen (single propiedad selected) ─────────────────────────────────

const PropiedadDetail = ({ propiedad }: { propiedad: PropiedadConProductos }) => {
  const [selectedProductoId, setSelectedProductoId] = useState(
    propiedad.productos[0]?.cuentaId ?? 0,
  );

  const producto = propiedad.productos.find((p) => p.cuentaId === selectedProductoId)
    ?? propiedad.productos[0];

  if (!producto) return null;

  return (
    <div className="space-y-4">
      {propiedad.productos.length > 1 && (
        <ProductoTabs
          productos={propiedad.productos}
          selectedId={selectedProductoId}
          onSelect={setSelectedProductoId}
        />
      )}
      {propiedad.productos.length === 1 && (
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">{producto.nombre}</p>
            {producto.descripcion && (
              <p className="text-[11px] text-muted-foreground">{producto.descripcion}</p>
            )}
          </div>
          <Badge variant="outline" className={`ml-auto text-[9px] px-2 py-0.5 ${STATUS_CFG[producto.status].badge}`}>
            {STATUS_CFG[producto.status].label}
          </Badge>
        </div>
      )}
      <ProductoHistorialView
        producto={producto}
        proyectoNombre={propiedad.proyectoNombre}
        numPropiedad={propiedad.numPropiedad}
      />
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const ClienteProductos = () => {
  const { data: propiedades = [], isLoading } = useClienteProductos();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  const propId = searchParams.get("p") ? Number(searchParams.get("p")) : null;
  const selected = propiedades.find((p) => p.propiedadId === propId) ?? null;

  const filtered = propiedades.filter((p) =>
    `${p.proyectoNombre} ${p.numPropiedad}`.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) return <Skeleton />;

  // ── Detail screen ──
  if (selected) {
    return (
      <div className="animate-fade-in">
        <header className="px-5 md:px-0 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => setSearchParams({})}
              aria-label="Volver"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
              Productos adicionales
            </h1>
          </div>
          <p className="text-[12px] text-muted-foreground truncate pl-9">
            {selected.proyectoNombre} · U-{selected.numPropiedad}
            {" · "}{selected.productos.length} producto{selected.productos.length !== 1 ? "s" : ""}
          </p>
        </header>
        <div className="px-5 md:px-0 pb-24">
          <PropiedadDetail propiedad={selected} />
        </div>
      </div>
    );
  }

  // ── List screen ──
  return (
    <div className="animate-fade-in">
      <header className="px-5 md:px-0 pt-6 pb-4">
        <h1 className="font-display font-bold text-[22px] md:text-[26px] text-foreground tracking-tight">
          Productos adicionales
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          {propiedades.length === 0 ? "No tienes productos adicionales." : "Selecciona una propiedad."}
        </p>
      </header>

      <div className="px-5 md:px-0 pb-8 space-y-3">
        {propiedades.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center mb-4">
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Sin productos adicionales registrados.</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar propiedad…"
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2 max-h-[min(380px,60svh)] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin resultados</p>
              ) : (
                filtered.map((p) => {
                  const totalPagado = p.productos.reduce((s, pr) => s + pr.totalPagado, 0);
                  const totalPrecio = p.productos.reduce((s, pr) => s + pr.precioFinal, 0);
                  const pct = totalPrecio > 0 ? Math.round((totalPagado / totalPrecio) * 100) : 0;
                  return (
                    <button
                      key={p.propiedadId}
                      data-cta="cliente.productos.ver-propiedad"
                      onClick={() => setSearchParams({ p: String(p.propiedadId) })}
                      className="w-full flex items-center gap-3.5 bg-card rounded-2xl border border-border p-4 transition-all active:scale-[0.98] hover:border-primary/30 text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-display font-bold text-sm text-primary">{p.productos.length}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-sm text-foreground truncate">
                          {p.proyectoNombre}
                          <span className="font-normal text-muted-foreground"> · U{p.numPropiedad}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {p.productos.length} producto{p.productos.length !== 1 ? "s" : ""}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {pct}% pagado · {fmt(totalPagado)}
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

export default ClienteProductos;
