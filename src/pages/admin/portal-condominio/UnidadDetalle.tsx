import { useParams, useNavigate } from "react-router-dom";
import { PageHeader, KPICard, StatusBadge, EstadoVista } from "./_helpers";
import { formatMXN } from "@/lib/portal-condominio/format";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioDataset } from "@/hooks/condominio/useCondominioData";
import { ArrowLeft } from "lucide-react";

const estatusLabel: Record<string, string> = { ocupado: "Ocupado", renta_corta: "Renta corta" };

export default function UnidadDetalle() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const { proyectoId } = useCondominio();
  const { data, isLoading, error } = useCondominioDataset(proyectoId);

  if (isLoading || error || !data) {
    return (
      <div>
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
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
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <p className="text-muted-foreground">Unidad no encontrada.</p>
      </div>
    );
  }

  const cargosUnidad = data.cargos.filter((c) => c.unidad_id === unidad.id);
  const pagosUnidad = data.pagos.filter((p) => p.unidad_id === unidad.id);

  return (
    <div>
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>
      <PageHeader title={`Departamento #${unidad.numero}`} subtitle={`${unidad.tipo} · Piso ${unidad.piso} · ${unidad.area_m2} m²`} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <KPICard title="Estatus" value={estatusLabel[unidad.estatus] ?? unidad.estatus} />
        <KPICard title="Saldo actual" value={formatMXN(unidad.saldo_actual)} variant={unidad.saldo_actual > 0 ? "warning" : "default"} />
        <KPICard title="Saldo vencido" value={formatMXN(unidad.saldo_vencido)} variant={unidad.saldo_vencido > 0 ? "danger" : "default"} />
        <KPICard title="Cuota mensual" value={formatMXN(unidad.cuota_mensual)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-2">Datos generales</h2>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-muted-foreground">Propietario</dt><dd>{unidad.propietario}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Residente</dt><dd>{unidad.residente}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">CLABE</dt><dd className="font-mono text-xs">{unidad.clabe || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Referencia</dt><dd className="font-mono text-xs">{unidad.referencia_pago}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Último pago</dt><dd>{unidad.ultimo_pago || "—"}</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-2">Cargos ({cargosUnidad.length})</h2>
          <ul className="divide-y divide-border text-sm max-h-[420px] overflow-y-auto">
            {cargosUnidad.map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <div>
                  <p>{c.concepto}</p>
                  <p className="text-xs text-muted-foreground">{c.fecha_vencimiento || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums">{formatMXN(c.monto)}</p>
                  <StatusBadge label={c.estatus} tone={c.estatus === "pagado" ? "success" : c.estatus === "vencido" ? "danger" : "warning"} />
                </div>
              </li>
            ))}
            {cargosUnidad.length === 0 && <li className="py-2 text-muted-foreground">Sin cargos.</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-2">Historial de pagos ({pagosUnidad.length})</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left py-1">Fecha</th><th className="text-left py-1">Referencia</th><th className="text-left py-1">Conciliación</th><th className="text-right py-1">Monto</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagosUnidad.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5">{p.fecha}</td>
                  <td className="py-1.5 font-mono text-xs">{p.referencia}</td>
                  <td className="py-1.5"><StatusBadge label={p.estatus_conciliacion} tone={p.estatus_conciliacion === "conciliado" ? "success" : p.estatus_conciliacion === "excepcion" ? "danger" : "warning"} /></td>
                  <td className="py-1.5 text-right tabular-nums">{formatMXN(p.monto)}</td>
                </tr>
              ))}
              {pagosUnidad.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">Sin pagos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
