import { PageHeader, StatusBadge } from "./_helpers";
import { amenidades, reservas, formatMXN } from "@/data/portalCondominio/mockData";
import { Plus } from "lucide-react";

export default function Amenidades() {
  return (
    <div>
      <PageHeader
        title="Amenidades"
        subtitle={`${amenidades.length} amenidades · ${reservas.length} reservas`}
        actions={<button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"><Plus className="h-4 w-4" /> Nueva amenidad</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {amenidades.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold">{a.nombre}</h3>
              <StatusBadge label={a.estatus} tone={a.estatus === "disponible" ? "success" : a.estatus === "mantenimiento" ? "warning" : "info"} />
            </div>
            <p className="text-xs text-muted-foreground mb-2">{a.descripcion}</p>
            <div className="text-xs flex gap-3 text-muted-foreground">
              <span>Cap. {a.capacidad}</span>
              <span>{a.costo > 0 ? formatMXN(a.costo) : "Gratis"}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold mb-2">Reservas próximas</h2>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Horario</th>
              <th className="px-3 py-2 text-left">Amenidad</th>
              <th className="px-3 py-2 text-left">Unidad</th>
              <th className="px-3 py-2 text-left">Residente</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-left">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {reservas.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-3 py-2">{r.fecha}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.hora_inicio} – {r.hora_fin}</td>
                <td className="px-3 py-2">{r.amenidad_nombre}</td>
                <td className="px-3 py-2 font-medium">#{r.unidad_numero}</td>
                <td className="px-3 py-2">{r.residente}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.costo > 0 ? formatMXN(r.costo) : "—"}</td>
                <td className="px-3 py-2"><StatusBadge label={r.estatus} tone={r.estatus === "aprobada" ? "success" : r.estatus === "solicitada" ? "warning" : r.estatus === "completada" ? "info" : "default"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}