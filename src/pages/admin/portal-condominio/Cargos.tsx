import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, KPICard, StatusBadge, EstadoVista } from "./_helpers";
import { formatMXN } from "@/lib/portal-condominio/format";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgregarMultaDialog } from "./AgregarMultaDialog";

const conciliacionTone = (s: string) =>
  s === "conciliado" ? "success" : s === "excepcion" ? "danger" : "warning";

const conciliacionLabel: Record<string, string> = {
  conciliado: "Conciliado",
  excepcion: "Excepción",
  pendiente: "Pendiente",
};

export default function Cargos() {
  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [conciliacionFilter, setConciliacionFilter] = useState("todos");
  const navigate = useNavigate();

  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pagos = data?.pagos ?? [];
  const cargosRaw = data?.cargos ?? [];
  const unidades = data?.unidades ?? [];

  // Unificamos pagos aplicados + multas pendientes (cargos categoría=multa
  // sin pago todavía) en una sola lista, así una multa recién creada se
  // ve en el listado al instante. Cada fila usa el shape de PagoCondominio
  // para reutilizar el render existente.
  const filtered = useMemo(() => {
    type RowMov = (typeof pagos)[number];
    // Mapa unidad_id → datos de la unidad para enriquecer multas.
    const unidadById = new Map(unidades.map((u) => [u.id, u]));
    // Cargos categoría=multa con estatus !== "pagado" → filas virtuales.
    const multasPendientes: RowMov[] = cargosRaw
      .filter((c) => c.categoria === "multa" && c.estatus !== "pagado")
      .map((c) => {
        const u = unidadById.get(c.unidad_id);
        return {
          id: `cargo-${c.id}`,
          unidad_id: c.unidad_id,
          unidad_numero: c.unidad_numero,
          folio_mant: u?.folio_mant ?? "—",
          propietario: u?.propietario ?? "—",
          residente: u?.residente ?? "—",
          monto: c.monto,
          fecha: c.fecha_vencimiento || "",
          referencia: "—",
          concepto: c.concepto,
          categoria: "multa" as const,
          url_comprobante: null,
          metodo_pago: "Sin pago",
          estatus_conciliacion: "pendiente" as const,
          nota_conciliacion: c.estatus === "vencido" ? "Cargo vencido" : "Cargo pendiente",
        };
      });

    const rows = [...pagos, ...multasPendientes];
    rows.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

    const q = search.toLowerCase();
    return rows.filter((p) => {
      const ms =
        !search ||
        p.unidad_numero.toLowerCase().includes(q) ||
        p.folio_mant.toLowerCase().includes(q) ||
        p.propietario.toLowerCase().includes(q) ||
        p.residente.toLowerCase().includes(q) ||
        p.referencia.toLowerCase().includes(q) ||
        p.concepto.toLowerCase().includes(q);
      const mc = categoriaFilter === "todos" || p.categoria === categoriaFilter;
      const mco = conciliacionFilter === "todos" || p.estatus_conciliacion === conciliacionFilter;
      return ms && mc && mco;
    });
  }, [pagos, cargosRaw, unidades, search, categoriaFilter, conciliacionFilter]);

  const totalAplicado = filtered.reduce((s, p) => s + p.monto, 0);
  const totalConciliado = filtered
    .filter((p) => p.estatus_conciliacion === "conciliado")
    .reduce((s, p) => s + p.monto, 0);
  const totalExcepcion = filtered
    .filter((p) => p.estatus_conciliacion !== "conciliado")
    .reduce((s, p) => s + p.monto, 0);

  return (
    <div>
      <PageHeader
        title="Cargos"
        subtitle={`${filtered.length} cargos y pagos · cuentas de mantenimiento`}
        actions={
          <Button
            size="sm"
            className="h-9 gap-1.5 text-[13px]"
            onClick={() => setDialogOpen(true)}
            disabled={unidades.length === 0}
          >
            <Plus className="h-4 w-4" /> Agregar multa o pago extra
          </Button>
        }
      />

      <AgregarMultaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        unidades={unidades}
        proyectoId={proyectoId}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KPICard title="Total aplicado" value={formatMXN(totalAplicado)} />
        <KPICard title="Conciliado" value={formatMXN(totalConciliado)} variant="success" />
        <KPICard title="Excepción / pendiente" value={formatMXN(totalExcepcion)} variant="warning" />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por propiedad, folio, propietario, residente o referencia…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm"
          />
        </div>
        <select
          value={categoriaFilter}
          onChange={(e) => setCategoriaFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-border bg-background text-sm"
        >
          <option value="todos">Todas las categorías</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="multa">Multa</option>
        </select>
        <select
          value={conciliacionFilter}
          onChange={(e) => setConciliacionFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-border bg-background text-sm"
        >
          <option value="todos">Toda la conciliación</option>
          <option value="conciliado">Conciliado</option>
          <option value="excepcion">Excepción</option>
          <option value="pendiente">Pendiente</option>
        </select>
      </div>

      {isLoading || error ? (
        <EstadoVista isLoading={isLoading} error={error} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left whitespace-nowrap">Propiedad</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">ID Cuenta Mant.</th>
                <th className="px-3 py-2 text-left">Propietarios</th>
                <th className="px-3 py-2 text-left">Residente</th>
                <th className="px-3 py-2 text-left">Concepto</th>
                <th className="px-3 py-2 text-left">Categoría</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Monto</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Fecha</th>
                <th className="px-3 py-2 text-center whitespace-nowrap">Comprobante</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Conciliación</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, 100).map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">#{p.unidad_numero}</td>
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{p.folio_mant}</td>
                  <td className="px-3 py-2">
                    <p className="truncate max-w-[180px]">{p.propietario}</p>
                  </td>
                  <td className="px-3 py-2">
                    {p.residente === "—" ? (
                      <span className="text-muted-foreground/60 text-xs">Sin asignar</span>
                    ) : (
                      <p className="truncate max-w-[180px]">{p.residente}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className="truncate max-w-[220px]">{p.concepto}</p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {p.metodo_pago}
                      {p.referencia !== "—" && ` · ${p.referencia}`}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] whitespace-nowrap capitalize",
                        p.categoria === "multa"
                          ? "border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40"
                          : "border-sky-400 text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/40",
                      )}
                    >
                      {p.categoria}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {formatMXN(p.monto)}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                    {p.fecha || "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.url_comprobante ? (
                      <a
                        href={p.url_comprobante}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors"
                        title={`Ver comprobante (${p.metodo_pago})`}
                        aria-label="Visualizar comprobante"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge
                      label={conciliacionLabel[p.estatus_conciliacion] ?? p.estatus_conciliacion}
                      tone={conciliacionTone(p.estatus_conciliacion) as any}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-[11px]"
                      onClick={() =>
                        navigate(`/admin/portal-condominio/departamentos/${p.unidad_numero}`)
                      }
                      aria-label={`Ver detalle de cuenta ${p.folio_mant}`}
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver detalle
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                    Sin pagos para los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
              Mostrando primeros 100 de {filtered.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
