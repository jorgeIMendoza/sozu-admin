import { ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fechaCreada, type Ticket } from "@/lib/portal-tickets/tickets-data";
import { useTickets } from "@/lib/portal-tickets/tickets-store";
import { PriorityDot } from "./PriorityDot";

export type OrdenCampo = "nombre" | "fechaCreacion" | "prioridad" | "etapa";

export function TicketsTable({
  tickets,
  seleccion,
  onSeleccion,
  onAbrir,
  orden,
  onOrden,
}: {
  tickets: Ticket[];
  seleccion: string[];
  onSeleccion: (ids: string[]) => void;
  onAbrir: (t: Ticket) => void;
  orden: { campo: OrdenCampo; dir: "asc" | "desc" };
  onOrden: (campo: OrdenCampo) => void;
}) {
  const { pipelines, etapas, agentes, categorias } = useTickets();
  const todos = tickets.length > 0 && seleccion.length === tickets.length;

  const th = (label: string, campo?: OrdenCampo) => (
    <TableHead
      className={campo ? "cursor-pointer select-none whitespace-nowrap" : "whitespace-nowrap"}
      onClick={campo ? () => onOrden(campo) : undefined}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {campo && (
          <ArrowUpDown
            className={`size-3 ${orden.campo === campo ? "text-primary" : "opacity-40"}`}
          />
        )}
      </span>
    </TableHead>
  );

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-10">
              <Checkbox
                checked={todos}
                onCheckedChange={(v) => onSeleccion(v ? tickets.map((t) => t.id) : [])}
                aria-label="Seleccionar todos"
              />
            </TableHead>
            {th("Nombre del ticket", "nombre")}
            {th("Pipeline")}
            {th("Estado del ticket", "etapa")}
            {th("Fecha de creación", "fechaCreacion")}
            {th("Prioridad", "prioridad")}
            {th("Propietario")}
            {th("Categoría")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-14 text-center text-sm text-muted-foreground">
                No hay tickets que coincidan con los filtros seleccionados.
              </TableCell>
            </TableRow>
          )}
          {tickets.map((t) => {
            const etapa = etapas.find((e) => e.id === t.etapaId);
            const pipeline = pipelines.find((p) => p.id === t.pipelineId);
            const ownerLabel = t.propietarios
              .map((id) => agentes.find((a) => a.id === id)?.nombre)
              .filter(Boolean)
              .join(", ");
            return (
              <TableRow key={t.id} className="hover:bg-muted/40">
                <TableCell>
                  <Checkbox
                    checked={seleccion.includes(t.id)}
                    onCheckedChange={(v) =>
                      onSeleccion(v ? [...seleccion, t.id] : seleccion.filter((id) => id !== t.id))
                    }
                    aria-label={`Seleccionar ${t.nombre}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                      #{t.numero}
                    </span>
                    <button
                      onClick={() => onAbrir(t)}
                      className="text-left font-medium text-primary hover:underline"
                    >
                      {t.nombre}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.inmueble}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{pipeline?.nombre}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{etapa?.nombre}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {fechaCreada(t.fechaCreacion)}
                </TableCell>
                <TableCell>
                  <PriorityDot prioridad={t.prioridad} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {ownerLabel || <span className="text-muted-foreground">Sin asignar</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {categorias.find((c) => c.id === t.categoriaId)?.nombre}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}