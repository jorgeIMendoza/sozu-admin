import { PageHeader } from "./_helpers";

const eventos = [
  { fecha: "2025-03-18 09:15", usuario: "Admin García", accion: "Cargo creado", detalle: "Multa $1,500 — Depto 1402" },
  { fecha: "2025-03-18 09:08", usuario: "Cobranza López", accion: "Promesa de pago", detalle: "Depto 0807 — promesa 25/03" },
  { fecha: "2025-03-17 17:42", usuario: "Admin García", accion: "Conciliación manual", detalle: "Pago $7,500 → Depto 1205" },
  { fecha: "2025-03-17 14:20", usuario: "Sistema", accion: "Cargos masivos", detalle: "320 cuotas de mantenimiento generadas" },
  { fecha: "2025-03-17 11:05", usuario: "Admin Martínez", accion: "Egreso aprobado", detalle: "$32,000 — Otis Elevadores" },
  { fecha: "2025-03-16 18:30", usuario: "Admin García", accion: "Reserva aprobada", detalle: "Rooftop — Depto 0301 — 20/03" },
];

export default function Auditoria() {
  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Bitácora de eventos del sistema" />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Usuario</th>
              <th className="px-3 py-2 text-left">Acción</th>
              <th className="px-3 py-2 text-left">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {eventos.map((e, i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{e.fecha}</td>
                <td className="px-3 py-2">{e.usuario}</td>
                <td className="px-3 py-2 font-medium">{e.accion}</td>
                <td className="px-3 py-2 text-muted-foreground">{e.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}