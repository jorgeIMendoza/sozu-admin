import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTickets } from "@/lib/portal-tickets/tickets-store";
import { FUENTES, PRIORIDADES, type Priority } from "@/lib/portal-tickets/tickets-data";
import { toast } from "sonner";

export function CreateTicketDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { pipelines, etapas, categorias, agentes, crearTicket } = useTickets();
  const [nombre, setNombre] = useState("");
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [etapaId, setEtapaId] = useState(
    etapas.find((e) => e.pipelineId === pipelines[0]?.id)?.id ?? "",
  );
  const [descripcion, setDescripcion] = useState("");
  const [fuente, setFuente] = useState("Portal");
  const [propietarioId, setPropietarioId] = useState("sin");
  const [prioridad, setPrioridad] = useState<Priority>("sin");
  const [fechaCreacion, setFechaCreacion] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [solicitante, setSolicitante] = useState("");
  const [inmueble, setInmueble] = useState("");
  const [error, setError] = useState("");

  const etapasPipeline = etapas.filter((e) => e.pipelineId === pipelineId);

  const reset = () => {
    setNombre("");
    setDescripcion("");
    setFechaCreacion("");
    setPrioridad("sin");
    setSolicitante("");
    setInmueble("");
    setError("");
  };

  const submit = () => {
    if (!nombre.trim() || !etapaId) {
      setError("El nombre del ticket y el estado son obligatorios.");
      return;
    }
    crearTicket({
      nombre,
      pipelineId,
      etapaId,
      prioridad,
      categoriaId,
      propietarioId: propietarioId === "sin" ? null : propietarioId,
      solicitante: solicitante.trim() || "Sin solicitante",
      inmueble: inmueble.trim(),
      descripcion,
      fuente,
      fechaCreacion: fechaCreacion ? new Date(fechaCreacion).toISOString() : undefined,
    });
    toast.success("Ticket creado correctamente");
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-left">Crear ticket</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-1 py-5">
          <div className="space-y-1.5">
            <Label>Nombre del ticket *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. 1820 - fuga en calentador"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Pipeline *</Label>
            <Select
              value={pipelineId}
              onValueChange={(v) => {
                setPipelineId(v);
                setEtapaId(etapas.find((e) => e.pipelineId === v)?.id ?? "");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Estado del ticket *</Label>
            <Select value={etapaId} onValueChange={setEtapaId}>
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
            <Label>Solicitante</Label>
            <Input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Inmueble</Label>
            <Input
              value={inmueble}
              onChange={(e) => setInmueble(e.target.value)}
              placeholder="Ej. Torre A - Depto 302"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción del ticket</Label>
            <Textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Fuente</Label>
            <Select value={fuente} onValueChange={setFuente}>
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

          <div className="space-y-1.5">
            <Label>Propietario del ticket</Label>
            <Select value={propietarioId} onValueChange={setPropietarioId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin">Sin asignar</SelectItem>
                {agentes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Prioridad</Label>
            <Select value={prioridad} onValueChange={(v) => setPrioridad(v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Fecha de creación</Label>
            <Input
              type="date"
              value={fechaCreacion}
              onChange={(e) => setFechaCreacion(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 border-t pt-4">
            <Button className="flex-1" onClick={submit}>
              Crear ticket
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}