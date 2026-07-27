import { PageHeader } from "./_helpers";
import { formatMXN } from "@/lib/portal-condominio/format";
import { useCondominio } from "@/contexts/CondominioContext";
import { useCondominioConfig } from "@/hooks/condominio/useCondominioData";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function Configuracion() {
  const { proyectoId } = useCondominio();
  const { data: config, isLoading } = useCondominioConfig(proyectoId);

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Parámetros del condominio" />
      {/* Solo "Datos generales" está conectado a datos reales (useCondominioConfig).
          Las secciones hardcodeadas (Conciliación, Notificaciones, Roles) se
          eliminaron por no estar conectadas al sistema. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-3">Datos generales</h2>
          <div className="space-y-3 text-sm">
            <Field label="Nombre del condominio" value={isLoading ? "…" : config?.nombre ?? "—"} />
            <Field label="Costo mantenimiento / m²" value={isLoading ? "…" : formatMXN(config?.costo_mantenimiento_m2 ?? 0)} />
            <Field
              label="Cuota extraordinaria mensual"
              value={isLoading ? "…" : config?.monto_mensual_cuota_extraordinaria ? formatMXN(config.monto_mensual_cuota_extraordinaria) : "—"}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
