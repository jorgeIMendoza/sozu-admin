import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useTickets } from "@/lib/portal-tickets/tickets-store";
import {
  PRIORIDADES,
  fechaLarga,
  iniciales,
  type Priority,
  type Ticket,
} from "@/lib/portal-tickets/tickets-data";
import { PriorityDot } from "./PriorityDot";
import { ContactoPicker } from "./ContactoPicker";
import { ProyectoSelect } from "./ProyectoSelect";
import { PropietariosPicker } from "./PropietariosPicker";
import { EvidenciaSection } from "./TicketEvidencia";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function TicketDetailSheet({
  ticket,
  onOpenChange,
  readOnly = false,
}: {
  ticket: Ticket | null;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}) {
  const { etapas, categorias, agentes, actualizarTicket, moverEtapa, agregarNota } = useTickets();
  const { profile } = useAuth();
  const [nota, setNota] = useState("");
  const isSuperAdmin =
    (profile as any)?.rol_id === 1 || (profile as any)?.rol_nombre === "Super Administrador";

  if (!ticket) return null;
  const etapasPipeline = etapas.filter((e) => e.pipelineId === ticket.pipelineId);
  const categoriasDelPipeline = categorias.filter((c) => c.pipelineId === ticket.pipelineId);

  return (
    <Sheet open={!!ticket} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left text-lg">{ticket.nombre}</SheetTitle>
          <p className="text-left text-sm text-muted-foreground">
            Creado el {fechaLarga(ticket.fechaCreacion)} · Fuente: {ticket.fuente}
          </p>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select
                value={ticket.etapaId}
                disabled={readOnly}
                onValueChange={(v) => moverEtapa(ticket.id, v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {etapasPipeline.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select
                value={ticket.prioridad}
                disabled={readOnly}
                onValueChange={(v) =>
                  actualizarTicket(
                    ticket.id,
                    { prioridad: v as Priority },
                    `Prioridad actualizada a "${PRIORIDADES.find((p) => p.id === v)?.nombre}".`,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <PriorityDot prioridad={p.id} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <PropietariosPicker
              value={ticket.propietarios}
              disabled={readOnly}
              agentes={agentes}
              label="Propietarios"
              onChange={(ids) =>
                actualizarTicket(
                  ticket.id,
                  { propietarios: ids },
                  ids.length
                    ? `Propietarios: ${ids
                        .map((id) => agentes.find((a) => a.id === id)?.nombre)
                        .filter(Boolean)
                        .join(", ")}.`
                    : "Ticket marcado como no asignado.",
                )
              }
            />

            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={ticket.categoriaId}
                disabled={readOnly}
                onValueChange={(v) =>
                  actualizarTicket(
                    ticket.id,
                    { categoriaId: v },
                    `Categoría actualizada a "${categorias.find((c) => c.id === v)?.nombre}".`,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriasDelPipeline.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ContactoPicker
              disabled={readOnly}
              value={
                ticket.entidadRelacionadaId
                  ? { id: ticket.entidadRelacionadaId, nombre: ticket.solicitante || "Contacto" }
                  : null
              }
              onChange={(c) =>
                actualizarTicket(
                  ticket.id,
                  { entidadRelacionadaId: c?.id ?? null, solicitante: c?.nombre ?? "" },
                  c ? `Contacto vinculado: ${c.nombre}.` : "Contacto desvinculado.",
                )
              }
            />

            <ProyectoSelect
              disabled={readOnly}
              value={ticket.inmueble}
              onChange={(nombre) =>
                actualizarTicket(
                  ticket.id,
                  { inmueble: nombre },
                  nombre ? `Proyecto: ${nombre}.` : "Proyecto quitado.",
                )
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              rows={4}
              value={ticket.descripcion}
              readOnly={readOnly}
              onChange={(e) => actualizarTicket(ticket.id, { descripcion: e.target.value })}
            />
          </div>

          <Separator />

          <EvidenciaSection ticketId={ticket.id} canDelete={isSuperAdmin} readOnly={readOnly} />

          <Separator />

          {!readOnly && (
            <div className="space-y-3">
              <Label>Agregar nota</Label>
              <Textarea
                rows={3}
                value={nota}
                placeholder="Escribe una nota de seguimiento..."
                onChange={(e) => setNota(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!nota.trim()}
                onClick={() => {
                  agregarNota(ticket.id, nota.trim());
                  setNota("");
                  toast.success("Nota agregada al ticket");
                }}
              >
                Guardar nota
              </Button>
            </div>
          )}

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Actividad</h3>
            {[...ticket.actividad].reverse().map((a) => (
              <div key={a.id} className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                  {iniciales(a.autor)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{a.texto}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.autor} · {fechaLarga(a.fecha)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}