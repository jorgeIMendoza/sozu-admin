import { useEffect, useState } from "react";
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
import { ContactoPicker, type ContactoRef } from "./ContactoPicker";
import { ProyectoSelect } from "./ProyectoSelect";
import { PropietariosPicker } from "./PropietariosPicker";
import { PendingEvidenciaField } from "./TicketEvidencia";
import type { PendingAdjunto } from "@/lib/portal-tickets/tickets-adjuntos";
import { toast } from "sonner";

// Fecha de hoy en formato YYYY-MM-DD (hora local, para el <input type="date">).
function hoyLocal() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

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
  const [propietarios, setPropietarios] = useState<string[]>([]);
  const [prioridad, setPrioridad] = useState<Priority>("sin");
  const [fechaCreacion, setFechaCreacion] = useState(hoyLocal());
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [contacto, setContacto] = useState<ContactoRef | null>(null);
  const [proyecto, setProyecto] = useState("");
  const [evidencia, setEvidencia] = useState<PendingAdjunto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Los catálogos cargan async (React Query): fijar defaults válidos al abrir / al llegar datos.
  useEffect(() => {
    if (!open) return;
    setPipelineId((prev) => (pipelines.some((x) => x.id === prev) ? prev : pipelines[0]?.id ?? ""));
  }, [open, pipelines]);

  // Categoría por defecto válida para el pipeline (las categorías son por pipeline).
  useEffect(() => {
    setCategoriaId((prev) => {
      const validas = categorias.filter((c) => c.pipelineId === pipelineId);
      return validas.some((c) => c.id === prev) ? prev : validas[0]?.id ?? "";
    });
  }, [pipelineId, categorias]);

  useEffect(() => {
    setEtapaId((prev) => {
      const validas = etapas.filter((e) => e.pipelineId === pipelineId);
      return validas.some((e) => e.id === prev) ? prev : validas[0]?.id ?? "";
    });
  }, [pipelineId, etapas]);

  // Al abrir el panel, pre-setear la fecha de creación con hoy (editable).
  useEffect(() => {
    if (open) setFechaCreacion(hoyLocal());
  }, [open]);

  const etapasPipeline = etapas.filter((e) => e.pipelineId === pipelineId);
  const categoriasDelPipeline = categorias.filter((c) => c.pipelineId === pipelineId);

  const reset = () => {
    setNombre("");
    setDescripcion("");
    setFechaCreacion(hoyLocal());
    setPrioridad("sin");
    setContacto(null);
    setProyecto("");
    setPropietarios([]);
    evidencia.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setEvidencia([]);
    setError("");
  };

  const submit = async () => {
    if (!nombre.trim() || !etapaId) {
      setError("El nombre del ticket y el estado son obligatorios.");
      return;
    }
    setSaving(true);
    await crearTicket({
      nombre,
      pipelineId,
      etapaId,
      prioridad,
      categoriaId,
      propietarios,
      solicitante: contacto?.nombre ?? "",
      entidadRelacionadaId: contacto?.id ?? null,
      inmueble: proyecto,
      descripcion,
      fuente,
      fechaCreacion: fechaCreacion ? new Date(fechaCreacion).toISOString() : undefined,
      adjuntos: evidencia,
    });
    setSaving(false);
    toast.success("Ticket creado correctamente");
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between gap-3 pr-10">
            <SheetTitle className="text-left">Crear ticket</SheetTitle>
            <Input
              id="ticket-fecha"
              type="date"
              value={fechaCreacion}
              onChange={(e) => setFechaCreacion(e.target.value)}
              className="h-8 w-[8.5rem] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
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

          <ContactoPicker value={contacto} onChange={setContacto} />

          <ProyectoSelect value={proyecto} onChange={setProyecto} />

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

          <PropietariosPicker
            value={propietarios}
            onChange={setPropietarios}
            agentes={agentes}
            label="Propietario(s) del ticket"
          />

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
            <Label>Categoría</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
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

          <PendingEvidenciaField value={evidencia} onChange={setEvidencia} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 border-t pt-4">
            <Button className="flex-1" onClick={submit} disabled={saving}>
              {saving ? "Guardando…" : "Crear ticket"}
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