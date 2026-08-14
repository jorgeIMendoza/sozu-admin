// Máquina de tareas y citas del CRM: formularios, diálogos por ficha, diálogos
// globales y preview de cita. Extraído de crm.tsx. Consumido por la ficha de
// contacto, la de negocio, CrmTasks y CrmAppointments.

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseISO } from "date-fns";
import {
  ClipboardList, CalendarClock, Phone, Mail, MessageSquare, Calendar, MapPin,
  Video, Building2, Store, ChevronDown, ChevronRight, Check, Clock, ExternalLink,
  UserPlus, Users, TriangleAlert, X, Trash2, Search, Loader2, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { advanceByRecurrence, fmtCitaWhen, fmtDueDateTime } from "@/lib/crm-format";
import { fmtDateTime, relTime, taskStatusLabel } from "@/lib/crm-lib";

// ─── (símbolos extraídos abajo; se les añade `export` automáticamente) ──────────
export function TaskDialog({ contactId, owners, userId, onSaved, trigger }: any) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TaskFormState>(emptyTaskForm(userId ?? ""));
  const save = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_tareas").insert(buildTaskInsert(form, Number(contactId)));
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarea creada"); setOpen(false); setForm(emptyTaskForm(userId ?? "")); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(emptyTaskForm(userId ?? "")); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors"><ClipboardList className="h-4 w-4 mr-1.5" />Tarea</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva tarea</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <TaskFormFields form={form} setForm={setForm} owners={owners as any[]} />
        </div>
        <DialogFooter><Button onClick={save} disabled={saving || !form.titulo.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear tarea</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Diálogo "Nueva cita" (por contacto / negocio). Escribe en la tabla real crm_citas.
export function CitaDialog({ contactId, owners, userId, onSaved, trigger }: any) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CitaFormState>(emptyCitaForm(userId ?? ""));
  const save = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_citas").insert(buildCitaInsert(form, Number(contactId)));
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cita creada"); setOpen(false); setForm(emptyCitaForm(userId ?? "")); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(emptyCitaForm(userId ?? "")); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors"><CalendarClock className="h-4 w-4 mr-1.5" />Cita</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva cita</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <CitaFormFields form={form} setForm={setForm} owners={owners as any[]} />
        </div>
        <DialogFooter><Button onClick={save} disabled={saving || !form.titulo.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear cita</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaskActivityCard({ task, defaultExpanded = false, onComplete, onDelete }: { task: any; defaultExpanded?: boolean; onComplete: (id: number) => void; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const done = task.status === "completada" || task.status === "completado";
  const fields: [string, string][] = [
    ["Fecha de vencimiento", task.due_date ? fmtDateTime(task.due_date) : "—"],
    ["Recordatorio", task.reminder ? fmtDateTime(task.reminder) : "Sin recordatorio"],
    ["Etapa de la tarea", taskStatusLabel[task.status] ?? task.status ?? "—"],
    ["Repetir", RECURRENCE_LABEL[task.recurrencia] ?? "No se repite"],
    ["Tipo de tarea", TASK_TYPE_META[task.tipo]?.label ?? task.tipo ?? "—"],
    ["Prioridad", TASK_PRIORITY_META[task.priority]?.label ?? task.priority ?? "—"],
    ["Asignado a", task.assignee ?? "—"],
  ];
  return (
    <div className="border border-border rounded-lg bg-card shadow-sm">
      <div className="flex items-start gap-2 p-3">
        <button onClick={() => setExpanded((e) => !e)} className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0" aria-label={expanded ? "Colapsar" : "Expandir"}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">
              <span className="font-semibold">Tarea</span>
              {task.assignee ? <span className="text-muted-foreground"> asignada a {task.assignee}</span> : null}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-xs text-primary hover:underline inline-flex items-center gap-1">Acciones <ChevronDown className="h-3 w-3" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!done && <DropdownMenuItem onClick={() => onComplete(task.id)}>Marcar completada</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => toast.message("El historial estará disponible en una fase posterior")}>Historial</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-xs text-muted-foreground/70 tabular-nums">{task.due_date ? fmtDateTime(task.due_date) : fmtDateTime(task.created_at)}</span>
            </div>
          </div>

          {/* Título con estado (check) */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`h-4 w-4 shrink-0 rounded-full flex items-center justify-center ${done ? "bg-emerald-500 text-white" : "border-2 border-muted-foreground/40"}`}>
              {done && <Check className="h-2.5 w-2.5" />}
            </span>
            <span className={`text-sm ${done ? "line-through text-muted-foreground" : "font-medium"}`}>{task.title}</span>
          </div>

          {expanded && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3">
                {fields.map(([l, v]) => (
                  <div key={l}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</div>
                    <div className="text-sm mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notas de la tarea</div>
                <p className="text-sm mt-0.5">{task.descripcion || <span className="text-muted-foreground">Agregar descripción</span>}</p>
              </div>
              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border">
                <button onClick={() => toast.message("Los comentarios de tareas llegarán en una fase posterior")} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />Agregar comentario
                </button>
                <span className="text-xs text-muted-foreground">1 asociación</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TaskCard EDITABLE (estilo HubSpot) ─────────────────────────────────────
// Colapsado: check para completar + título + asignado + vencimiento (rojo si con demora).
// Expandido: edita EN VIVO fecha (reagendar), estado, prioridad, tipo, asignado, recordatorio,
// repetir y notas — cada cambio se persiste vía onUpdate(id, patch). Usado en la ficha de contacto.
const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
// Deriva el preset de recordatorio (min antes) a partir del vencimiento + la fecha absoluta guardada.
const reminderPresetFrom = (due: any, rec: any) => {
  if (!rec || !due) return "none";
  const mins = Math.round((new Date(due).getTime() - new Date(rec).getTime()) / 60000);
  return TASK_REMINDER_OPTIONS.find((o) => o.minutes === mins)?.id ?? "none";
};

// Etiqueta uniforme de campo dentro del card de tarea.
function FieldLabel({ children }: { children: any }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{children}</div>;
}

export function TaskCard({ task, owners = [], onComplete = () => {}, onUpdate = () => {}, onDelete = () => {}, defaultExpanded = false, contactName, contactId }: {
  task: any;
  owners?: { id: string; full_name: string; email: string }[];
  onComplete?: (id: number) => void;
  onUpdate?: (id: number, patch: Record<string, any>) => void;
  onDelete?: (id: number) => void;
  defaultExpanded?: boolean;
  contactName?: string | null;
  contactId?: number | null;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const done = task.status === "completada" || task.status === "completado";
  const cancelada = task.status === "cancelada";
  const due = task.due_date ? new Date(task.due_date) : null;
  const overdue = !!due && !done && !cancelada && due.getTime() < Date.now();
  const raw = task.raw ?? {};
  // Tolerante a los 2 shapes: la ficha de contacto trae los campos en `raw`; la de negocio los
  // pone arriba y el asignado como NOMBRE (sin id).
  const tipo = raw.tipo ?? task.tipo;
  const prioridad = task.priority ?? raw.prioridad ?? task.prioridad;
  const asignadoId = raw.id_usuario_asignado ?? task.id_usuario_asignado ?? null;
  const recurrencia = raw.recurrencia ?? task.recurrencia ?? null;
  const recordatorio = raw.fecha_recordatorio ?? task.reminder ?? null;
  const assigneeName = task.assignee
    ?? owners.find((o) => o.id === asignadoId)?.full_name
    ?? owners.find((o) => o.id === asignadoId)?.email ?? null;

  // Notas: estado local, se guarda al salir del textarea.
  const [notes, setNotes] = useState(task.descripcion ?? "");
  useEffect(() => { setNotes(task.descripcion ?? ""); }, [task.descripcion]);

  const dateStr = due ? toDateInput(due) : "";
  const timeStr = due ? toTimeInput(due) : "08:00";

  // Reagendar: nueva fecha/hora → ISO; si tenía recordatorio, se recorre el mismo offset.
  const applyDue = (d: string, t: string) => {
    if (!d) { onUpdate(task.id, { fecha_vencimiento: null, fecha_recordatorio: null }); return; }
    const iso = new Date(`${d}T${t || "08:00"}:00`).toISOString();
    const patch: Record<string, any> = { fecha_vencimiento: iso };
    if (recordatorio && task.due_date) {
      const offset = new Date(task.due_date).getTime() - new Date(recordatorio).getTime();
      patch.fecha_recordatorio = new Date(new Date(iso).getTime() - offset).toISOString();
    }
    onUpdate(task.id, patch);
  };

  // Recordatorio: preset (min antes) ⇄ fecha absoluta calculada desde el vencimiento.
  const reminderPreset = (() => {
    if (!recordatorio || !task.due_date) return "none";
    const mins = Math.round((new Date(task.due_date).getTime() - new Date(recordatorio).getTime()) / 60000);
    return TASK_REMINDER_OPTIONS.find((o) => o.minutes === mins)?.id ?? "none";
  })();
  const applyReminder = (presetId: string) => {
    const mins = TASK_REMINDER_OPTIONS.find((o) => o.id === presetId)?.minutes;
    if (mins == null || !task.due_date) { onUpdate(task.id, { fecha_recordatorio: null }); return; }
    onUpdate(task.id, { fecha_recordatorio: new Date(new Date(task.due_date).getTime() - mins * 60000).toISOString() });
  };

  const onStatus = (v: string) => { if (v === "completada") onComplete(task.id); else onUpdate(task.id, { estatus: v }); };

  const statusMeta = TASK_STATUS_META[task.status];
  const prioMeta = TASK_PRIORITY_META[prioridad];
  const TypeIcon = TASK_TYPE_META[tipo]?.icon ?? ClipboardList;

  return (
    <div className={`border rounded-lg bg-card shadow-sm ${overdue ? "border-red-500/30" : "border-border"}`}>
      <div className="flex items-start gap-2.5 p-3">
        {/* Check: completar / reabrir */}
        <button
          onClick={() => (done ? onUpdate(task.id, { estatus: "pendiente" }) : onComplete(task.id))}
          title={done ? "Reabrir tarea" : "Marcar completada"}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-emerald-500"}`}>
          {done && <Check className="h-3 w-3" />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Título + vencimiento + chevron */}
          <div className="flex items-start justify-between gap-2">
            <button onClick={() => setExpanded((e) => !e)} className="flex items-start gap-1.5 text-left min-w-0 group/t">
              {expanded ? <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />}
              <span className="min-w-0">
                <span className={`text-sm ${done ? "line-through text-muted-foreground" : "font-medium text-foreground"} group-hover/t:underline`}>{task.title}</span>
                {assigneeName && <span className="text-xs text-muted-foreground ml-1.5">· {assigneeName}</span>}
              </span>
            </button>
            <span className={`text-xs shrink-0 tabular-nums inline-flex items-center gap-1 ${overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground/70"}`}>
              {overdue && <TriangleAlert className="h-3 w-3" />}
              {due ? `${overdue ? "Con demora" : "Vence"} ${fmtDateTime(task.due_date)}` : "Sin fecha"}
            </span>
          </div>

          {/* Contacto asociado (solo en la vista global de Tareas) */}
          {contactName && (
            <div className="ml-5 mt-0.5">
              <Link to={`/admin/portal-crm/ventas/contactos/${contactId}`} className="text-xs text-primary hover:underline">{contactName}</Link>
            </div>
          )}

          {/* Colapsado: chips de un vistazo */}
          {!expanded && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-5">
              {statusMeta && <Badge variant="outline" className={`${statusMeta.cls} text-[10px] px-1.5 py-0`}>{statusMeta.label}</Badge>}
              {prioMeta && <Badge variant="outline" className={`${prioMeta.cls} text-[10px] px-1.5 py-0`}>{prioMeta.label}</Badge>}
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><TypeIcon className="h-3 w-3" />{TASK_TYPE_META[tipo]?.label ?? tipo}</span>
            </div>
          )}

          {/* Expandido: edición completa (estilo HubSpot) */}
          {expanded && (
            <div className="mt-3 ml-5 space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <FieldLabel>Fecha de vencimiento</FieldLabel>
                  <div className="flex gap-1.5">
                    <Input type="date" value={dateStr} onChange={(e) => applyDue(e.target.value, timeStr)} className="h-8 text-sm" />
                    <Input type="time" value={timeStr} onChange={(e) => applyDue(dateStr, e.target.value)} disabled={!dateStr} className="h-8 text-sm w-[112px]" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Recordatorio</FieldLabel>
                  <Select value={reminderPreset} onValueChange={applyReminder} disabled={!task.due_date}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_REMINDER_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Etapa de la tarea</FieldLabel>
                  <Select value={task.status} onValueChange={onStatus}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_STATUS_ORDER.map((k) => <SelectItem key={k} value={k}>{TASK_STATUS_META[k].label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Repetir</FieldLabel>
                  <Select value={recurrencia ?? "none"} onValueChange={(v) => onUpdate(task.id, { recurrencia: v === "none" ? null : v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_RECURRENCE_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Tipo de tarea</FieldLabel>
                  <Select value={tipo} onValueChange={(v) => onUpdate(task.id, { tipo: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TASK_TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Prioridad</FieldLabel>
                  <Select value={prioridad} onValueChange={(v) => onUpdate(task.id, { prioridad: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TASK_PRIORITY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <FieldLabel>Asignado a</FieldLabel>
                  <Select value={asignadoId ?? "none"} onValueChange={(v) => onUpdate(task.id, { id_usuario_asignado: v === "none" ? null : v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <FieldLabel>Notas de la tarea</FieldLabel>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => { if ((notes.trim() || null) !== (task.descripcion ?? null)) onUpdate(task.id, { descripcion: notes.trim() || null }); }}
                  placeholder="Agregar descripción…" rows={2} className="text-sm" />
              </div>
              <div>
                <FieldLabel>Comentarios</FieldLabel>
                <TaskComments taskId={task.id} />
              </div>
              <div className="flex items-center justify-end pt-2 border-t border-border">
                <button onClick={() => onDelete(task.id)} className="text-xs text-destructive hover:underline inline-flex items-center gap-1"><Trash2 className="h-3 w-3" />Eliminar tarea</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal para GESTIONAR una tarea (vista global de Tareas — no expandible). Reusa TaskFormFields
// + un selector de etapa/estado; guarda TODO al presionar "Guardar cambios".
export function TaskEditDialog({ task, owners = [], open, onOpenChange, onUpdate, onDelete }: {
  task: any | null;
  owners?: { id: string; full_name: string; email: string }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdate: (id: number, patch: Record<string, any>) => void;
  onDelete?: (id: number) => void;
}) {
  const [form, setForm] = useState<TaskFormState>(emptyTaskForm());
  const [estatus, setEstatus] = useState("pendiente");
  useEffect(() => {
    if (!task) return;
    const due = task.fecha_vencimiento ? new Date(task.fecha_vencimiento) : null;
    setForm({
      titulo: task.titulo ?? "",
      tipo: task.tipo ?? "seguimiento",
      prioridad: task.prioridad ?? "normal",
      fecha: due ? toDateInput(due) : "",
      hora: due ? toTimeInput(due) : "08:00",
      recordatorio: reminderPresetFrom(task.fecha_vencimiento, task.fecha_recordatorio),
      recurrencia: task.recurrencia ?? "none",
      descripcion: task.descripcion ?? "",
      assigned_to: task.id_usuario_asignado ?? "",
    });
    setEstatus(task.estatus ?? "pendiente");
  }, [task]);

  if (!task) return null;

  const save = () => {
    const dueIso = form.fecha ? new Date(`${form.fecha}T${form.hora || "08:00"}:00`).toISOString() : null;
    let recIso: string | null = null;
    if (dueIso && form.recordatorio !== "none") {
      const mins = TASK_REMINDER_OPTIONS.find((o) => o.id === form.recordatorio)?.minutes;
      if (mins != null) recIso = new Date(new Date(dueIso).getTime() - mins * 60000).toISOString();
    }
    onUpdate(task.id, {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      prioridad: form.prioridad,
      descripcion: form.descripcion.trim() || null,
      fecha_vencimiento: dueIso,
      fecha_recordatorio: recIso,
      recurrencia: form.recurrencia === "none" ? null : form.recurrencia,
      id_usuario_asignado: form.assigned_to || null,
      estatus,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col gap-0 p-0 sm:max-w-lg">
        {/* Header fijo */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle>Gestionar tarea</DialogTitle>
        </DialogHeader>
        {/* Body con scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-3">
            <TaskFormFields
              form={form}
              setForm={setForm}
              owners={owners}
              statusField={
                <div>
                  <Label>Etapa de la tarea</Label>
                  <Select value={estatus} onValueChange={setEstatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_STATUS_ORDER.map((k) => <SelectItem key={k} value={k}>{TASK_STATUS_META[k].label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              }
            />
            <div>
              <Label>Comentarios</Label>
              <TaskComments taskId={task.id} />
            </div>
          </div>
        </div>
        {/* Footer fijo */}
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 sm:justify-between gap-2">
          {onDelete ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { onDelete(task.id); onOpenChange(false); }}>
              <Trash2 className="h-4 w-4 mr-1" />Eliminar
            </Button>
          ) : <span />}
          <Button onClick={save} disabled={!form.titulo.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Editores INLINE para la tabla global de Tareas ─────────────────────────
// Estado de la tarea como "pill" editable (Select compacto con color por etapa).
export function InlineTaskStatus({ status, onChange, disabled }: {
  status: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const meta = TASK_STATUS_META[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" };
  return (
    <Select value={status} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={`h-7 w-fit gap-1 whitespace-nowrap rounded-full border px-2.5 py-0 text-xs font-medium leading-none [&>span]:line-clamp-none ${meta.cls}`} aria-label="Cambiar etapa de la tarea">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUS_ORDER.map((k) => (
          <SelectItem key={k} value={k}>
            <span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${TASK_STATUS_META[k].dot}`} />{TASK_STATUS_META[k].label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Vencimiento editable inline: el texto abre un popover con fecha + hora (recorre el recordatorio).
export function InlineTaskDue({ due, reminder, done, onChange }: {
  due: string | null;
  reminder?: string | null;
  done?: boolean;
  onChange: (patch: { fecha_vencimiento: string | null; fecha_recordatorio?: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const d = due ? new Date(due) : null;
  const overdue = !!d && !done && d.getTime() < Date.now();
  const dateStr = d ? toDateInput(d) : "";
  const timeStr = d ? toTimeInput(d) : "08:00";
  const apply = (ds: string, ts: string) => {
    if (!ds) { onChange({ fecha_vencimiento: null, fecha_recordatorio: null }); return; }
    const iso = new Date(`${ds}T${ts || "08:00"}:00`).toISOString();
    const patch: { fecha_vencimiento: string | null; fecha_recordatorio?: string | null } = { fecha_vencimiento: iso };
    if (reminder && due) {
      const offset = new Date(due).getTime() - new Date(reminder).getTime();
      patch.fecha_recordatorio = new Date(new Date(iso).getTime() - offset).toISOString();
    }
    onChange(patch);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded px-1.5 py-1 -mx-1.5 whitespace-nowrap cursor-pointer transition-colors hover:bg-muted ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
          title="Cambiar vencimiento"
        >
          {overdue && <TriangleAlert className="h-3.5 w-3.5" />}
          {due ? fmtDueDateTime(due) : <span className="text-muted-foreground/60">Sin fecha</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-2">
          <div className="flex gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Fecha</Label>
              <Input type="date" value={dateStr} onChange={(e) => apply(e.target.value, timeStr)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Hora</Label>
              <Input type="time" value={timeStr} onChange={(e) => apply(dateStr, e.target.value)} disabled={!dateStr} className="h-8 text-sm w-[112px]" />
            </div>
          </div>
          {due && (
            <button type="button" onClick={() => { apply("", ""); setOpen(false); }} className="text-xs text-destructive hover:underline">Quitar fecha</button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Hilo de comentarios de una tarea (persisten en crm_tareas_comentarios; fail-soft si la tabla
// aún no existe en el ambiente → lista vacía). Texto simple, estilo HubSpot.
export function TaskComments({ taskId }: { taskId: number }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: comments = [] } = useQuery({
    queryKey: ["tarea-comentarios", taskId],
    queryFn: async () => {
      const res = await (supabase as any).from("crm_tareas_comentarios")
        .select("id, contenido, fecha_creacion, id_usuario")
        .eq("id_tarea", taskId).eq("activo", true)
        .order("fecha_creacion", { ascending: true });
      if (res.error) return [];
      const rows = res.data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.id_usuario).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", ids);
        nameMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }
      return rows.map((r: any) => ({ id: r.id, text: r.contenido, ts: r.fecha_creacion, author: r.id_usuario ? (nameMap[r.id_usuario] ?? null) : null }));
    },
  });
  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_tareas_comentarios")
      .insert({ id_tarea: taskId, id_usuario: user?.id ?? null, contenido: text });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setDraft("");
    qc.invalidateQueries({ queryKey: ["tarea-comentarios", taskId] });
  };
  return (
    <div className="space-y-2">
      {comments.length > 0 && (
        <div className="space-y-1.5">
          {comments.map((c: any) => (
            <div key={c.id} className="rounded-md bg-muted/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{c.author ?? "Usuario"}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">{relTime(c.ts)}</span>
              </div>
              <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.text}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }}
          placeholder="Agregar comentario… (Ctrl+Enter para enviar)"
          rows={1}
          className="text-sm min-h-[38px]"
        />
        <Button size="sm" onClick={add} disabled={saving || !draft.trim()} className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground">Comentar</Button>
      </div>
    </div>
  );
}

export type GlobalCita = {
  id: number;
  titulo: string;
  tipo: string;
  estatus: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  ubicacion: string | null;
  enlace_reunion: string | null;
  resultado: string | null;
  descripcion: string | null;
  id_entidad_relacionada: number;
  id_usuario_asignado: string | null;
  contact_name: string | null;
  assigned_name: string | null;
};

// Diálogo "Nueva cita" global: selector de contacto con búsqueda + campos de cita.
export function NewGlobalCitaDialog({ open, onOpenChange, owners, defaultAssignee, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  owners: { id: string; full_name: string; email: string }[];
  defaultAssignee: string;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [contact, setContact] = useState<{ id: number; name: string } | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [form, setForm] = useState<CitaFormState>(emptyCitaForm(defaultAssignee));

  const { data: contactResults = [], isFetching } = useQuery({
    queryKey: ["crm-cita-contact-search", contactSearch],
    enabled: open && contactSearch.trim().length >= 2,
    queryFn: async () => {
      const term = contactSearch.trim();
      const { data: personas } = await (supabase as any).from("personas")
        .select("id, nombre_legal, nombre_comercial")
        .or(`nombre_legal.ilike.%${term}%,nombre_comercial.ilike.%${term}%`)
        .eq("activo", true).limit(20);
      const pIds = (personas ?? []).map((p: any) => p.id);
      if (!pIds.length) return [];
      const { data: ents } = await (supabase as any).from("entidades_relacionadas")
        .select("id, id_persona").in("id_persona", pIds).in("id_tipo_entidad", [2, 7]).eq("activo", true).limit(20);
      const pName: Record<number, string> = Object.fromEntries((personas ?? []).map((p: any) => [p.id, (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim()]));
      return (ents ?? []).map((e: any) => ({ id: e.id, name: pName[e.id_persona] ?? "Sin nombre" })) as { id: number; name: string }[];
    },
  });

  const reset = () => { setForm(emptyCitaForm(defaultAssignee)); setContact(null); setContactSearch(""); };
  const save = async () => {
    if (!form.titulo.trim() || !contact) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_citas").insert(buildCitaInsert(form, contact.id));
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cita creada"); reset(); onOpenChange(false); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Nueva cita</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva cita</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-1">
          <div>
            <Label>Contacto asociado</Label>
            {contact ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{contact.name}</span>
                <button type="button" onClick={() => setContact(null)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Escribe al menos 2 letras…" className="pl-8" />
                </div>
                {contactSearch.trim().length >= 2 && (
                  <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-popover shadow-sm">
                    {isFetching ? (
                      <div className="p-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Buscando…</div>
                    ) : contactResults.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">Sin resultados.</div>
                    ) : contactResults.map((c) => (
                      <button key={c.id} type="button" onClick={() => { setContact(c); setContactSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">{c.name}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <CitaFormFields form={form} setForm={setForm} owners={owners} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.titulo.trim() || !contact} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</> : "Crear cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CitaPreviewRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-foreground break-words">{value}</div>
      </div>
    </div>
  );
}

// Panel lateral "Vista previa" de una cita (estilo HubSpot). Solo lectura + acciones rápidas.
export function CitaPreviewSheet({ cita, onOpenChange, onUpdateStatus, onDelete }: {
  cita: GlobalCita | null;
  onOpenChange: (v: boolean) => void;
  onUpdateStatus: (estatus: string) => void;
  onDelete: () => void;
}) {
  const typeMeta = cita ? (CITA_TYPE_META[cita.tipo] ?? { label: cita.tipo, icon: CalendarClock }) : null;
  const statusMeta = cita ? CITA_STATUS_META[cita.estatus] : null;
  const TypeIcon = typeMeta?.icon ?? CalendarClock;
  const abierta = cita ? (cita.estatus === "programada" || cita.estatus === "reprogramada") : false;
  return (
    <Sheet open={!!cita} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[440px] overflow-y-auto">
        {cita && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-400 flex items-center justify-center shrink-0"><TypeIcon className="h-4 w-4" /></span>
                <span className="truncate">{cita.titulo}</span>
              </SheetTitle>
              <SheetDescription>Vista previa de la cita</SheetDescription>
            </SheetHeader>
            <div className="mt-5 space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {statusMeta && <Badge variant="outline" className={statusMeta.cls}>{statusMeta.label}</Badge>}
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border">{typeMeta?.label}</Badge>
              </div>

              <CitaPreviewRow icon={Clock} label="Cuándo" value={fmtCitaWhen(cita.fecha_inicio, cita.fecha_fin)} />
              {cita.enlace_reunion && (
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Enlace de reunión</div>
                    <a href={cita.enlace_reunion} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{cita.enlace_reunion}</a>
                  </div>
                </div>
              )}
              {cita.ubicacion && <CitaPreviewRow icon={MapPin} label="Ubicación" value={cita.ubicacion} />}
              <CitaPreviewRow icon={UserPlus} label="Asignado a" value={cita.assigned_name ?? "Sin asignar"} />
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Contacto</div>
                  {cita.contact_name ? (
                    <Link to={`/admin/portal-crm/ventas/contactos/${cita.id_entidad_relacionada}`} className="text-primary hover:underline">{cita.contact_name}</Link>
                  ) : <span className="text-muted-foreground">Sin contacto</span>}
                </div>
              </div>
              {cita.descripcion && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Agenda / notas</div>
                  <p className="text-foreground whitespace-pre-wrap">{cita.descripcion}</p>
                </div>
              )}
              {cita.resultado && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Resultado</div>
                  <p className="text-foreground whitespace-pre-wrap">{cita.resultado}</p>
                </div>
              )}

              <Separator />
              <div className="space-y-2">
                {abierta && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5" onClick={() => onUpdateStatus("realizada")}><Check className="h-3.5 w-3.5" />Realizada</Button>
                    <Button size="sm" variant="outline" className="gap-1 border-amber-500/30 text-amber-600 hover:bg-amber-500/5" onClick={() => onUpdateStatus("no_asistio")}><TriangleAlert className="h-3.5 w-3.5" />No asistió</Button>
                    <Button size="sm" variant="outline" className="gap-1 text-muted-foreground" onClick={() => onUpdateStatus("cancelada")}><X className="h-3.5 w-3.5" />Cancelar</Button>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {cita.contact_name ? (
                    <Button size="sm" variant="ghost" className="gap-1 text-primary" asChild>
                      <Link to={`/admin/portal-crm/ventas/contactos/${cita.id_entidad_relacionada}`}><ExternalLink className="h-3.5 w-3.5" />Ver contacto</Link>
                    </Button>
                  ) : <span />}
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />Eliminar</Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── CrmTasks (globales) ────────────────────────────────────────────────────
// Todas las tareas de todos los contactos. Lee/escribe el esquema real
// `crm_tareas` (español); resuelve nombre de contacto y de usuario asignado
// por waterfall. No usa `crm_tasks`/`contacts` (esquema ficticio inexistente).

export const TASK_TYPE_META: Record<string, { label: string; icon: typeof ClipboardList }> = {
  seguimiento: { label: "Seguimiento", icon: ClipboardList },
  llamada: { label: "Llamada", icon: Phone },
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageSquare },
  visita: { label: "Visita", icon: Calendar },
};
export const TASK_PRIORITY_META: Record<string, { label: string; cls: string; order: number }> = {
  urgente: { label: "Urgente", cls: "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400", order: 0 },
  alta: { label: "Alta", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400", order: 1 },
  normal: { label: "Normal", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400", order: 2 },
  baja: { label: "Baja", cls: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400", order: 3 },
};

// Etapa/estado de la tarea (crm_tareas.estatus). No es solo "completada": HubSpot muestra un
// embudo (Sin iniciar → En progreso → Completada / Cancelada). Se edita en el card de la tarea.
export const TASK_STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400", dot: "bg-blue-500" },
  en_progreso: { label: "En progreso", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400", dot: "bg-amber-500" },
  completada: { label: "Completada", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400", dot: "bg-emerald-500" },
  cancelada: { label: "Cancelada", cls: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400", dot: "bg-slate-400" },
};
export const TASK_STATUS_ORDER = ["pendiente", "en_progreso", "completada", "cancelada"];

// Presets de recordatorio (minutos antes del vencimiento). El valor absoluto
// (fecha_recordatorio) lo dispara el cron `crm-recordatorios-tareas`.
export const TASK_REMINDER_OPTIONS: { id: string; label: string; minutes: number | null }[] = [
  { id: "none", label: "Sin recordatorio", minutes: null },
  { id: "at", label: "A la hora del vencimiento", minutes: 0 },
  { id: "15m", label: "15 minutos antes", minutes: 15 },
  { id: "1h", label: "1 hora antes", minutes: 60 },
  { id: "1d", label: "1 día antes", minutes: 1440 },
];
export const TASK_RECURRENCE_OPTIONS: { id: string; label: string }[] = [
  { id: "none", label: "No se repite" },
  { id: "diaria", label: "Diaria" },
  { id: "semanal", label: "Semanal" },
  { id: "quincenal", label: "Quincenal" },
  { id: "mensual", label: "Mensual" },
  { id: "anual", label: "Anual" },
];
export const RECURRENCE_LABEL: Record<string, string> = Object.fromEntries(TASK_RECURRENCE_OPTIONS.map((o) => [o.id, o.label]));

// Estado local unificado del formulario de tarea (global y por contacto).
export type TaskFormState = {
  titulo: string; tipo: string; prioridad: string;
  fecha: string; hora: string; recordatorio: string; recurrencia: string;
  descripcion: string; assigned_to: string;
};
export const emptyTaskForm = (assignee = ""): TaskFormState => ({
  titulo: "", tipo: "seguimiento", prioridad: "normal",
  fecha: "", hora: "08:00", recordatorio: "none", recurrencia: "none",
  descripcion: "", assigned_to: assignee,
});

// Construye el payload de INSERT a crm_tareas desde el estado del formulario.
export function buildTaskInsert(form: TaskFormState, contactId: number) {
  const dueIso = form.fecha ? new Date(`${form.fecha}T${form.hora || "08:00"}:00`).toISOString() : null;
  let recIso: string | null = null;
  if (dueIso && form.recordatorio !== "none") {
    const mins = TASK_REMINDER_OPTIONS.find((o) => o.id === form.recordatorio)?.minutes;
    if (mins != null) recIso = new Date(new Date(dueIso).getTime() - mins * 60000).toISOString();
  }
  return {
    id_entidad_relacionada: contactId,
    titulo: form.titulo.trim(),
    tipo: form.tipo,
    prioridad: form.prioridad,
    descripcion: form.descripcion.trim() || null,
    fecha_vencimiento: dueIso,
    fecha_recordatorio: recIso,
    recurrencia: form.recurrencia === "none" ? null : form.recurrencia,
    id_usuario_asignado: form.assigned_to || null,
    estatus: "pendiente",
  };
}


// Al completar una tarea recurrente, genera la siguiente ocurrencia (mismo offset de
// recordatorio respecto al vencimiento). Se llama tras marcarla completada.
export async function regenerateRecurringTask(t: {
  recurrencia?: string | null; fecha_vencimiento?: string | null; fecha_recordatorio?: string | null;
  id_entidad_relacionada: number; id_usuario_asignado?: string | null;
  titulo: string; tipo: string; prioridad: string; descripcion?: string | null;
}) {
  if (!t.recurrencia || !t.fecha_vencimiento) return;
  const nextDue = advanceByRecurrence(parseISO(t.fecha_vencimiento), t.recurrencia);
  let nextRec: string | null = null;
  if (t.fecha_recordatorio) {
    const offsetMs = parseISO(t.fecha_vencimiento).getTime() - parseISO(t.fecha_recordatorio).getTime();
    nextRec = new Date(nextDue.getTime() - offsetMs).toISOString();
  }
  await (supabase as any).from("crm_tareas").insert({
    id_entidad_relacionada: t.id_entidad_relacionada,
    id_usuario_asignado: t.id_usuario_asignado ?? null,
    titulo: t.titulo, tipo: t.tipo, prioridad: t.prioridad,
    descripcion: t.descripcion ?? null,
    fecha_vencimiento: nextDue.toISOString(),
    fecha_recordatorio: nextRec,
    recurrencia: t.recurrencia,
    estatus: "pendiente",
  });
}


// Campos compartidos del formulario de tarea (título, tipo, prioridad, vencimiento+hora,
// recordatorio, recurrencia, asignado, notas). El contacto lo maneja cada diálogo.
export function TaskFormFields({ form, setForm, owners, statusField }: {
  form: TaskFormState;
  setForm: (f: TaskFormState) => void;
  owners: { id: string; full_name: string; email: string }[];
  statusField?: any;   // slot opcional (ej. "Etapa de la tarea") que se pone junto a "Asignar a" en col-6
}) {
  return (
    <>
      <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Llamar al prospecto" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TASK_TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Prioridad</Label>
          <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TASK_PRIORITY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Fecha de vencimiento</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
        <div><Label>Hora</Label><Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} disabled={!form.fecha} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Recordatorio</Label>
          <Select value={form.recordatorio} onValueChange={(v) => setForm({ ...form, recordatorio: v })} disabled={!form.fecha}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_REMINDER_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Repetir</Label>
          <Select value={form.recurrencia} onValueChange={(v) => setForm({ ...form, recurrencia: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_RECURRENCE_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {statusField ? (
        <div className="grid grid-cols-2 gap-3">
          {statusField}
          <div><Label>Asignar a</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div><Label>Asignar a</Label>
          <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div><Label>Notas</Label><Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles de la tarea…" rows={3} /></div>
    </>
  );
}

// ─── Citas (reuniones) — máquina compartida ─────────────────────────────────
// Actividad nativa del CRM (tabla real `crm_citas`, español), espejo de crm_tareas
// pero con ventana de tiempo, lugar/enlace y resultado. Se muestra en la ficha del
// contacto, en la del negocio (vía su contacto) y en la vista global de Citas.
// En HubSpot esto es "Reuniones"; aquí seguimos el vocabulario del embudo ("cita").

export const CITA_TYPE_META: Record<string, { label: string; icon: typeof CalendarClock }> = {
  presencial: { label: "Presencial", icon: MapPin },
  videollamada: { label: "Videollamada", icon: Video },
  llamada: { label: "Llamada", icon: Phone },
  visita_obra: { label: "Visita a obra", icon: Building2 },
  showroom: { label: "Showroom", icon: Store },
};
export const CITA_STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  programada: { label: "Programada", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400", dot: "bg-blue-500" },
  reprogramada: { label: "Reprogramada", cls: "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:text-violet-400", dot: "bg-violet-500" },
  realizada: { label: "Realizada", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400", dot: "bg-emerald-500" },
  no_asistio: { label: "No asistió", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400", dot: "bg-amber-500" },
  cancelada: { label: "Cancelada", cls: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400", dot: "bg-slate-400" },
};
// Orden de presentación en selects (embudo natural de la cita).
export const CITA_STATUS_ORDER = ["programada", "reprogramada", "realizada", "no_asistio", "cancelada"];
export const CITA_DURATIONS: { id: string; label: string; minutes: number }[] = [
  { id: "15", label: "15 minutos", minutes: 15 },
  { id: "30", label: "30 minutos", minutes: 30 },
  { id: "45", label: "45 minutos", minutes: 45 },
  { id: "60", label: "1 hora", minutes: 60 },
  { id: "90", label: "1 h 30 min", minutes: 90 },
  { id: "120", label: "2 horas", minutes: 120 },
];

// Estado local unificado del formulario de cita (global y por contacto/negocio).
export type CitaFormState = {
  titulo: string; tipo: string; estatus: string;
  fecha: string; hora: string; duracion: string;
  ubicacion: string; enlace_reunion: string;
  recordatorio: string; descripcion: string; resultado: string; assigned_to: string;
};
export const emptyCitaForm = (assignee = ""): CitaFormState => ({
  titulo: "", tipo: "presencial", estatus: "programada",
  fecha: "", hora: "09:00", duracion: "30",
  ubicacion: "", enlace_reunion: "",
  recordatorio: "none", descripcion: "", resultado: "", assigned_to: assignee,
});

// Construye el payload de INSERT a crm_citas desde el estado del formulario.
export function buildCitaInsert(form: CitaFormState, contactId: number) {
  const startIso = form.fecha ? new Date(`${form.fecha}T${form.hora || "09:00"}:00`).toISOString() : null;
  let endIso: string | null = null;
  if (startIso) {
    const mins = Number(form.duracion) || 30;
    endIso = new Date(new Date(startIso).getTime() + mins * 60000).toISOString();
  }
  let recIso: string | null = null;
  if (startIso && form.recordatorio !== "none") {
    const mins = TASK_REMINDER_OPTIONS.find((o) => o.id === form.recordatorio)?.minutes;
    if (mins != null) recIso = new Date(new Date(startIso).getTime() - mins * 60000).toISOString();
  }
  return {
    id_entidad_relacionada: contactId,
    titulo: form.titulo.trim(),
    tipo: form.tipo,
    estatus: form.estatus,
    fecha_inicio: startIso,
    fecha_fin: endIso,
    ubicacion: form.ubicacion.trim() || null,
    enlace_reunion: form.enlace_reunion.trim() || null,
    descripcion: form.descripcion.trim() || null,
    resultado: form.resultado.trim() || null,
    fecha_recordatorio: recIso,
    id_usuario_asignado: form.assigned_to || null,
  };
}

// Formato de fecha/hora de la cita: "Hoy · 09:00–09:30" o "12 ago 2026 · 11:00".

// Campos compartidos del formulario de cita. El contacto lo maneja cada diálogo.
export function CitaFormFields({ form, setForm, owners }: {
  form: CitaFormState;
  setForm: (f: CitaFormState) => void;
  owners: { id: string; full_name: string; email: string }[];
}) {
  const esVirtual = form.tipo === "videollamada" || form.tipo === "llamada";
  return (
    <>
      <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Recorrido en showroom" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(CITA_TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Estatus</Label>
          <Select value={form.estatus} onValueChange={(v) => setForm({ ...form, estatus: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CITA_STATUS_ORDER.map((k) => <SelectItem key={k} value={k}>{CITA_STATUS_META[k].label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
        <div><Label>Hora</Label><Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} disabled={!form.fecha} /></div>
        <div><Label>Duración</Label>
          <Select value={form.duracion} onValueChange={(v) => setForm({ ...form, duracion: v })} disabled={!form.fecha}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CITA_DURATIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {esVirtual ? (
        <div><Label>Enlace de reunión</Label><Input value={form.enlace_reunion} onChange={(e) => setForm({ ...form, enlace_reunion: e.target.value })} placeholder="https://meet.google.com/…" /></div>
      ) : (
        <div><Label>Ubicación</Label><Input value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} placeholder="Showroom / dirección" /></div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Recordatorio</Label>
          <Select value={form.recordatorio} onValueChange={(v) => setForm({ ...form, recordatorio: v })} disabled={!form.fecha}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_REMINDER_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Asignar a</Label>
          <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Agenda / notas</Label><Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Temas a tratar…" rows={2} /></div>
      {(form.estatus === "realizada" || form.estatus === "no_asistio") && (
        <div><Label>Resultado</Label><Textarea value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })} placeholder="Resumen y siguientes pasos…" rows={2} /></div>
      )}
    </>
  );
}

// Diálogo "Nueva tarea" global: selector de contacto con búsqueda + campos reales.
export function NewGlobalTaskDialog({ open, onOpenChange, owners, defaultAssignee, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  owners: { id: string; full_name: string; email: string }[];
  defaultAssignee: string;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [contact, setContact] = useState<{ id: number; name: string } | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [form, setForm] = useState<TaskFormState>(emptyTaskForm(defaultAssignee));

  const { data: contactResults = [], isFetching } = useQuery({
    queryKey: ["crm-task-contact-search", contactSearch],
    enabled: open && contactSearch.trim().length >= 2,
    queryFn: async () => {
      const term = contactSearch.trim();
      const { data: personas } = await (supabase as any).from("personas")
        .select("id, nombre_legal, nombre_comercial")
        .or(`nombre_legal.ilike.%${term}%,nombre_comercial.ilike.%${term}%`)
        .eq("activo", true).limit(20);
      const pIds = (personas ?? []).map((p: any) => p.id);
      if (!pIds.length) return [];
      const { data: ents } = await (supabase as any).from("entidades_relacionadas")
        .select("id, id_persona").in("id_persona", pIds).in("id_tipo_entidad", [2, 7]).eq("activo", true).limit(20);
      const pName: Record<number, string> = Object.fromEntries((personas ?? []).map((p: any) => [p.id, (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim()]));
      return (ents ?? []).map((e: any) => ({ id: e.id, name: pName[e.id_persona] ?? "Sin nombre" })) as { id: number; name: string }[];
    },
  });

  const reset = () => { setForm(emptyTaskForm(defaultAssignee)); setContact(null); setContactSearch(""); };

  const save = async () => {
    if (!form.titulo.trim() || !contact) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_tareas").insert(buildTaskInsert(form, contact.id));
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarea creada");
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Nueva tarea</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nueva tarea</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-1">
          <div>
            <Label>Contacto asociado</Label>
            {contact ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{contact.name}</span>
                <button type="button" onClick={() => setContact(null)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Escribe al menos 2 letras…" className="pl-8" />
                </div>
                {contactSearch.trim().length >= 2 && (
                  <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-popover shadow-sm">
                    {isFetching ? (
                      <div className="p-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Buscando…</div>
                    ) : contactResults.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">Sin resultados.</div>
                    ) : contactResults.map((c) => (
                      <button key={c.id} type="button" onClick={() => { setContact(c); setContactSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">{c.name}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <TaskFormFields form={form} setForm={setForm} owners={owners} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.titulo.trim() || !contact} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</> : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
