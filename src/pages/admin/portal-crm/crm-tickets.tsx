// Sección "Tickets" de la ficha de contacto del CRM: lista los tickets asociados al contacto
// (tickets.id_entidad_relacionada) y permite crear uno nuevo con el contacto ya vinculado.
// Espejo de DealsCard (crm-negocios.tsx) pero para el Portal Tickets de Seguimiento.
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAgentes } from "@/lib/portal-tickets/tickets-store";
import { PRIORIDADES } from "@/lib/portal-tickets/tickets-data";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const sb = supabase as any;

const PRIORIDAD_DOT: Record<string, string> = {
  alta: "bg-destructive",
  media: "bg-amber-500",
  baja: "bg-emerald-500",
  sin: "bg-muted-foreground/40",
};

const EMPTY = {
  nombre: "",
  id_pipeline: "",
  id_etapa: "",
  prioridad: "sin",
  id_categoria: "",
  id_propietario: "",
  descripcion: "",
};

// Diálogo "Crear ticket" con el contacto de la ficha ya vinculado (id_entidad_relacionada).
function CreateTicketFromContactDialog({
  contactId,
  contactName,
  onSaved,
  trigger,
}: {
  contactId: string;
  contactName?: string;
  onSaved: () => void;
  trigger: ReactNode;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const { data: pipelines } = useQuery({
    queryKey: ["tk-cat-pipelines"],
    enabled: open,
    queryFn: async () => {
      const { data } = await sb
        .from("tickets_pipelines")
        .select("id, nombre")
        .eq("activo", true)
        .order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  const { data: etapas } = useQuery({
    queryKey: ["tk-cat-etapas", form.id_pipeline],
    enabled: open && !!form.id_pipeline,
    queryFn: async () => {
      const { data } = await sb
        .from("tickets_etapas")
        .select("id, nombre")
        .eq("id_pipeline", Number(form.id_pipeline))
        .eq("activo", true)
        .order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  const { data: categorias } = useQuery({
    queryKey: ["tk-cat-categorias"],
    enabled: open,
    queryFn: async () => {
      const { data } = await sb
        .from("tickets_categorias")
        .select("id, nombre")
        .eq("activo", true)
        .order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  const { data: agentes = [] } = useQuery({
    queryKey: ["tickets-agentes"],
    queryFn: fetchAgentes,
    enabled: open,
  });

  const canSave = !!form.nombre.trim() && !!form.id_pipeline && !!form.id_etapa && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const { data: ins, error } = await sb
      .from("tickets")
      .insert({
        nombre: form.nombre.trim(),
        id_pipeline: Number(form.id_pipeline),
        id_etapa: Number(form.id_etapa),
        prioridad: form.prioridad,
        id_categoria: form.id_categoria ? Number(form.id_categoria) : null,
        id_usuario_propietario: form.id_propietario || null,
        id_usuario_creador: user?.id ?? null,
        id_entidad_relacionada: Number(contactId),
        solicitante: contactName || null,
        descripcion: form.descripcion.trim() || null,
        fuente: "Portal",
      })
      .select("id")
      .single();
    if (!error && ins?.id) {
      await sb.from("tickets_actividad").insert({
        id_ticket: ins.id,
        texto: "Ticket creado desde la ficha de contacto.",
        tipo: "sistema",
        id_usuario_autor: user?.id ?? null,
      });
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ticket creado");
    setForm({ ...EMPTY });
    onSaved();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ ...EMPTY }); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear ticket</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 pt-2">
          <div className="grid gap-1.5">
            <Label>Nombre del ticket *</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej. Fuga en calentador"
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Pipeline *</Label>
            <Select
              value={form.id_pipeline}
              onValueChange={(v) => setForm({ ...form, id_pipeline: v, id_etapa: "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un pipeline" />
              </SelectTrigger>
              <SelectContent>
                {(pipelines ?? []).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Estado del ticket *</Label>
            <Select
              value={form.id_etapa}
              onValueChange={(v) => setForm({ ...form, id_etapa: v })}
              disabled={!form.id_pipeline}
            >
              <SelectTrigger>
                <SelectValue placeholder={form.id_pipeline ? "Selecciona una etapa" : "Elige un pipeline primero"} />
              </SelectTrigger>
              <SelectContent>
                {(etapas ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Prioridad</Label>
              <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v })}>
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
            <div className="grid gap-1.5">
              <Label>Categoría</Label>
              <Select value={form.id_categoria} onValueChange={(v) => setForm({ ...form, id_categoria: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {(categorias ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Propietario</Label>
            <Select value={form.id_propietario} onValueChange={(v) => setForm({ ...form, id_propietario: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {agentes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Descripción</Label>
            <Textarea
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Card de la ficha de contacto: acordeón "Tickets" con la lista + botón "Agregar".
export function TicketsCard({
  contactId,
  contactName,
  onSaved,
}: {
  contactId: string;
  contactName?: string;
  onSaved: () => void;
}) {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["contact-tickets", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data } = await sb
        .from("tickets")
        .select("id, numero, nombre, prioridad, id_etapa")
        .eq("id_entidad_relacionada", Number(contactId))
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false });
      const etapaIds = Array.from(new Set((data ?? []).map((t: any) => t.id_etapa)));
      let etapaMap: Record<number, string> = {};
      if (etapaIds.length) {
        const { data: es } = await sb.from("tickets_etapas").select("id, nombre").in("id", etapaIds);
        etapaMap = Object.fromEntries((es ?? []).map((e: any) => [e.id, e.nombre]));
      }
      return (data ?? []).map((t: any) => ({ ...t, etapa_nombre: etapaMap[t.id_etapa] ?? "" }));
    },
  });
  const list = tickets ?? [];

  return (
    <AccordionItem value="tickets" className="border-b-0">
      <AccordionTrigger className="py-3 text-sm font-semibold transition-colors hover:text-primary hover:no-underline">
        <span className="flex items-center gap-2">
          Tickets <span className="text-xs font-normal text-muted-foreground">{list.length}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2">
          <div className="flex justify-end">
            <CreateTicketFromContactDialog
              contactId={contactId}
              contactName={contactName}
              onSaved={onSaved}
              trigger={
                <button className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              }
            />
          </div>
          {isLoading ? (
            <p className="py-1 text-xs text-muted-foreground">Cargando…</p>
          ) : !list.length ? (
            <p className="py-1 text-xs text-muted-foreground">Sin tickets asociados</p>
          ) : (
            <div className="space-y-1.5">
              {list.map((t: any) => (
                <div
                  key={t.id}
                  className="rounded-md border border-border bg-card p-2.5 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${PRIORIDAD_DOT[t.prioridad] ?? PRIORIDAD_DOT.sin}`}
                    />
                    <div className="truncate text-sm font-medium">{t.nombre}</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <Badge variant="outline" className="max-w-[130px] truncate text-[10px]">
                      {t.etapa_nombre || "—"}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">#{t.numero}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
