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
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-3">Conciliación bancaria</h2>
          <div className="space-y-3 text-sm">
            <Field label="Banco" value="STP" />
            <Field label="Tolerancia monto" value="±$0.01 MXN" />
            <Field label="Conciliación automática" value="Activa" />
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-3">Notificaciones</h2>
          <div className="space-y-3 text-sm">
            <Field label="Email" value="admin@sozu.com" />
            <Field label="WhatsApp residentes" value="Activo" />
            <Field label="Recordatorios" value="3, 7 y 15 días antes" />
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-3">Roles y permisos</h2>
          <ul className="text-sm space-y-2">
            <li className="flex justify-between"><span>Super Admin</span><span className="text-muted-foreground">Acceso total</span></li>
            <li className="flex justify-between"><span>Administrador</span><span className="text-muted-foreground">Lectura/Escritura</span></li>
            <li className="flex justify-between"><span>Cobranza</span><span className="text-muted-foreground">Pagos y cartera</span></li>
            <li className="flex justify-between"><span>Lectura</span><span className="text-muted-foreground">Solo dashboards</span></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
