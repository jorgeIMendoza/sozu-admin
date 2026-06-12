import { useParams, useNavigate } from "react-router-dom";
import { PageHeader, KPICard, StatusBadge, EstadoVista } from "./_helpers";
import { formatMXN } from "@/lib/portal-condominio/format";
import { useCondominio } from "@/contexts/CondominioContext";
import {
  useCondominioConfig,
  useCondominioDataset,
} from "@/hooks/condominio/useCondominioData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const estatusLabel: Record<string, string> = {
  ocupado: "Ocupado",
  renta_corta: "Renta corta",
};

const conciliacionLabel: Record<string, string> = {
  conciliado: "Conciliado",
  excepcion: "Excepción",
  pendiente: "Pendiente",
};

export default function UnidadDetalle() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);
  const { data: config } = useCondominioConfig(proyectoId);

  if (isLoading || error || !data) {
    return (
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <EstadoVista isLoading={isLoading} error={error} />
      </div>
    );
  }

  const unidad = data.unidades.find((u) => u.numero === numero);

  if (!unidad) {
    return (
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <p className="text-muted-foreground">Unidad no encontrada.</p>
      </div>
    );
  }

  // Cargos y pagos de esta unidad — ya enriquecidos por queries.ts.
  const cargosUnidad = data.cargos.filter((c) => c.unidad_id === unidad.id);
  const pagosUnidad = data.pagos.filter((p) => p.unidad_id === unidad.id);

  // Costo por m² del proyecto (config) o fallback derivando de cuota/area.
  const costoM2 =
    config?.costo_mantenimiento_m2 ??
    (unidad.area_m2 > 0 ? unidad.cuota_mensual / unidad.area_m2 : 0);

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>
      <PageHeader
        title={`Departamento #${unidad.numero}`}
        subtitle={`${unidad.tipo} · Piso ${unidad.piso} · ${unidad.area_m2.toFixed(2)} m² · ${unidad.folio_mant}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <KPICard title="Estatus" value={estatusLabel[unidad.estatus] ?? unidad.estatus} />
        <KPICard
          title="Saldo actual"
          value={formatMXN(unidad.saldo_actual)}
          variant={unidad.saldo_actual > 0 ? "warning" : "default"}
        />
        <KPICard
          title="Saldo vencido"
          value={formatMXN(unidad.saldo_vencido)}
          variant={unidad.saldo_vencido > 0 ? "danger" : "default"}
        />
        <KPICard title="Cuota mensual" value={formatMXN(unidad.cuota_mensual)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Datos generales */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Datos generales</h2>
          <dl className="text-sm space-y-2">
            <Row label="ID Cuenta de Mantenimiento" value={unidad.folio_mant} mono />
            <Row label="Proyecto" value={data.proyecto_nombre} />
            <Row label="Edificio" value={unidad.edificio_nombre} />
            <Row label="Modelo" value={unidad.modelo_nombre} />
            <Row label="No. Propiedad" value={`#${unidad.numero}`} />
            <Row label="Metraje Total" value={`${unidad.area_m2.toFixed(2)} m²`} />
            <Row
              label="Costo por m²"
              value={costoM2 > 0 ? `${formatMXN(costoM2)} / m²` : "—"}
            />
            <Row label="Propietario" value={unidad.propietario} />
            <Row
              label="Residente"
              value={unidad.residente === "—" ? "Sin asignar" : unidad.residente}
            />
            <Row
              label="CLABE STP"
              value={unidad.clabe || "—"}
              mono={!!unidad.clabe}
            />
          </dl>
        </div>

        {/* Cargos */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Cargos ({cargosUnidad.length})</h2>
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wide sticky top-0 bg-card">
                <tr>
                  <th className="text-left py-1.5 pr-2">Concepto</th>
                  <th className="text-left py-1.5 px-2 whitespace-nowrap">Fecha</th>
                  <th className="text-right py-1.5 px-2 whitespace-nowrap">Monto</th>
                  <th className="text-left py-1.5 pl-2">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cargosUnidad.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 pr-2">
                      <p className="truncate max-w-[200px]">{c.concepto}</p>
                      <p className="text-[11px] text-muted-foreground/70 capitalize">
                        {c.categoria}
                      </p>
                    </td>
                    <td className="py-1.5 px-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {c.fecha_vencimiento || "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {formatMXN(c.monto)}
                    </td>
                    <td className="py-1.5 pl-2">
                      <StatusBadge
                        label={c.estatus}
                        tone={
                          c.estatus === "pagado"
                            ? "success"
                            : c.estatus === "vencido"
                              ? "danger"
                              : "warning"
                        }
                      />
                    </td>
                  </tr>
                ))}
                {cargosUnidad.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-muted-foreground">
                      Sin cargos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historial de pagos */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">
            Historial de pagos ({pagosUnidad.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="text-left py-1.5 pr-2 whitespace-nowrap">Fecha</th>
                  <th className="text-left py-1.5 px-2 whitespace-nowrap">Referencia</th>
                  <th className="text-left py-1.5 px-2">Concepto</th>
                  <th className="text-left py-1.5 px-2 whitespace-nowrap">Conciliación</th>
                  <th className="text-right py-1.5 px-2 whitespace-nowrap">Monto</th>
                  <th className="text-center py-1.5 px-2 whitespace-nowrap">Evidencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagosUnidad.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="py-1.5 pr-2 text-xs tabular-nums whitespace-nowrap">
                      {p.fecha || "—"}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-xs whitespace-nowrap">
                      {p.referencia}
                    </td>
                    <td className="py-1.5 px-2">
                      <p className="truncate max-w-[220px]">{p.concepto}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] whitespace-nowrap capitalize",
                            p.categoria === "multa"
                              ? "border-red-400 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40"
                              : "border-sky-400 text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/40",
                          )}
                        >
                          {p.categoria}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground/70">{p.metodo_pago}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <StatusBadge
                        label={conciliacionLabel[p.estatus_conciliacion] ?? p.estatus_conciliacion}
                        tone={
                          p.estatus_conciliacion === "conciliado"
                            ? "success"
                            : p.estatus_conciliacion === "excepcion"
                              ? "danger"
                              : "warning"
                        }
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold">
                      {formatMXN(p.monto)}
                    </td>
                    <td className="py-1.5 px-2 text-center">
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
                  </tr>
                ))}
                {pagosUnidad.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-center text-muted-foreground">
                      Sin pagos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground uppercase tracking-wider">{label}</dt>
      <dd className={cn("text-right", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
