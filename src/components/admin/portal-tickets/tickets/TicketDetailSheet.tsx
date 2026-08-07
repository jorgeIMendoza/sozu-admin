import { useState } from "react";
import { Mic, Pencil, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FUENTES,
  PRIORIDADES,
  fechaLarga,
  iniciales,
  type Ticket,
} from "@/lib/portal-tickets/tickets-data";
import { Section, PrioridadChips } from "./TicketFormBits";
import { SolicitantesPicker } from "./SolicitantesPicker";
import { ProyectoSelect } from "./ProyectoSelect";
import { PropietariosPicker } from "./PropietariosPicker";
import { EvidenciaSection } from "./TicketEvidencia";
import { VoiceRecorderButton } from "./VoiceRecorder";
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
  const [audioNota, setAudioNota] = useState<File | null>(null);
  const [editNombre, setEditNombre] = useState(false);
  const [nombreVal, setNombreVal] = useState("");
  const isSuperAdmin =
    (profile as any)?.rol_id === 1 || (profile as any)?.rol_nombre === "Super Administrador";

  if (!ticket) return null;
  const etapasPipeline = etapas.filter((e) => e.pipelineId === ticket.pipelineId);
  const categoriasDelPipeline = categorias.filter((c) => c.pipelineId === ticket.pipelineId);

  const guardarNombre = () => {
    const v = nombreVal.trim();
    setEditNombre(false);
    if (v && v !== ticket.nombre) actualizarTicket(ticket.id, { nombre: v }, `Nombre actualizado a "${v}".`);
  };

  return (
    <Sheet open={!!ticket} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left text-lg">
            {editNombre ? (
              <Input
                autoFocus
                value={nombreVal}
                onChange={(e) => setNombreVal(e.target.value)}
                onBlur={guardarNombre}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    guardarNombre();
                  } else if (e.key === "Escape") {
                    setEditNombre(false);
                  }
                }}
                className="h-9 text-base"
              />
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium tabular-nums text-muted-foreground">#{ticket.numero}</span>
                <span>{ticket.nombre}</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setNombreVal(ticket.nombre);
                      setEditNombre(true);
                    }}
                    aria-label="Editar nombre"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </span>
            )}
          </SheetTitle>
          <p className="text-left text-sm text-muted-foreground">
            Creado el {fechaLarga(ticket.fechaCreacion)}
          </p>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8 pt-4">
          <Section titulo="Clasificación">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="space-y-1.5">
                <Label>Fuente</Label>
                <Select
                  value={ticket.fuente}
                  disabled={readOnly}
                  onValueChange={(v) =>
                    actualizarTicket(ticket.id, { fuente: v }, `Fuente actualizada a "${v}".`)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUENTES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <PrioridadChips
              value={ticket.prioridad}
              disabled={readOnly}
              onChange={(p) =>
                actualizarTicket(
                  ticket.id,
                  { prioridad: p },
                  `Prioridad actualizada a "${PRIORIDADES.find((x) => x.id === p)?.nombre}".`,
                )
              }
            />
          </Section>

          <Section titulo="Personas">
            <SolicitantesPicker
              disabled={readOnly}
              value={ticket.solicitantes}
              onChange={(sols) =>
                actualizarTicket(
                  ticket.id,
                  { solicitantes: sols },
                  sols.length
                    ? `Solicitantes: ${sols.map((s) => s.nombre).join(", ")}.`
                    : "Solicitantes: ninguno.",
                )
              }
            />

            <PropietariosPicker
              value={ticket.propietarios}
              disabled={readOnly}
              agentes={agentes}
              label="Propietario(s) del ticket"
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
          </Section>

          <Section titulo="Detalles">
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

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                rows={4}
                value={ticket.descripcion}
                readOnly={readOnly}
                onChange={(e) => actualizarTicket(ticket.id, { descripcion: e.target.value })}
              />
            </div>
          </Section>

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
              {audioNota && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                  <Mic className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Nota de voz lista para guardar</span>
                  <button
                    type="button"
                    onClick={() => setAudioNota(null)}
                    aria-label="Quitar audio"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!nota.trim() && !audioNota}
                  onClick={() => {
                    agregarNota(ticket.id, nota.trim(), audioNota ?? undefined);
                    setNota("");
                    setAudioNota(null);
                    toast.success("Nota agregada al ticket");
                  }}
                >
                  Guardar nota
                </Button>
                <VoiceRecorderButton onRecorded={(f) => setAudioNota(f)} />
              </div>
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
                  {a.audioUrl && (
                    <audio controls src={a.audioUrl} className="mt-1 h-8 w-full max-w-[260px]" />
                  )}
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