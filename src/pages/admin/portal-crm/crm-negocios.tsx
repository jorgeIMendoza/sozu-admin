// Cluster de negocios (deals) del CRM: tarjeta en ficha de contacto, formularios de
// alta (nuevo/existente), diálogos de crear/editar, y piezas del tablero (columna,
// tarjeta arrastrable, menú de acciones). Extraído de crm.tsx. Consumido por
// CrmContactDetail, CrmDeals y CrmDealDetail (que se quedan y orquestan dnd-kit).

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Plus, Briefcase, Search, X, Loader2, Check, MoreHorizontal, Pencil, Trash2,
  ChevronRight, ChevronLeft, GripVertical, Calendar, Settings2, ChevronDown,
  Filter as FilterIcon, UserRound, Sparkles, Phone, MessageSquare, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmLogger } from "@/hooks/useCrmLogger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { DField } from "@/components/admin/portal-crm/ui";
import { fmtMoneda, dealInitials, TIPO_NEGOCIO_OPTS, PRIORIDAD_META, SEMAPHORE_META, interactionSemaphore, fmtDueDateTime } from "@/lib/crm-format";
import {
  TIPO_ASISTENTE, RANGO_EDAD, TOMA_DECISION, INTENCION_USO, EXPERIENCIA_PREVENTA,
  ETAPA_EXPLORACION, PROYECCION_CIERRE, PUNTOS_POSITIVOS, PUNTOS_NEGATIVOS,
  perfilBadge, optLabel, type PerfilOpt,
} from "@/lib/crm-perfil-comprador";
import { fmtMXN, fmtDate, relTime } from "@/lib/crm-lib";
import { fetchCrmOwners } from "@/hooks/useCrmCatalogos";
import { useCrmCanDelete } from "@/hooks/useCrmCanDelete";
import { useCrmNegociosPortal } from "@/hooks/useCrmContactosPortal";

// ─── (símbolos extraídos abajo; se les añade `export` automáticamente) ──────────
export function DealsCard({ contactId, deals, onSaved }: { contactId: string; deals: any[]; onSaved: () => void }) {
  const { basePath: negociosBase } = useCrmNegociosPortal();
  const list = deals ?? [];
  return (
    <AccordionItem value="deals">
      <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
        <span className="flex items-center gap-2">Negocios <span className="text-xs text-muted-foreground font-normal">{list.length}</span></span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2">
          <div className="flex justify-end">
            <CreateDealDialog contactId={contactId} onSaved={onSaved}
              trigger={
                <button className="flex items-center gap-1 text-xs text-primary hover:text-primary font-medium transition-colors">
                  <Plus className="h-3.5 w-3.5" />Agregar
                </button>
              } />
          </div>
          {!list.length ? (
            <p className="text-xs text-muted-foreground py-1">Sin negocios asociados</p>
          ) : (
            <div className="space-y-1.5">
              {list.map((d: any) => (
                <Link key={d.id} to={`${negociosBase}/${d.id}`}
                  className="block rounded-md border border-border p-2.5 bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {d.prioridad && PRIORIDAD_META[d.prioridad] && (
                      <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORIDAD_META[d.prioridad].dot}`} title={`Prioridad ${PRIORIDAD_META[d.prioridad].label}`} />
                    )}
                    <div className="text-sm font-medium truncate">{d.nombre}</div>
                  </div>
                  {d.pipeline_nombre && <div className="text-[11px] text-muted-foreground truncate">{d.pipeline_nombre}</div>}
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <Badge variant="outline" className="text-[10px] truncate max-w-[130px]">{d.etapa_nombre}</Badge>
                    <span className="text-xs font-medium tabular-nums">{d.valor != null ? fmtMoneda(Number(d.valor), d.moneda) : "—"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// Modal "Crear Negocio" con pestañas "Crear nuevo" / "Agregar existente".
export function CreateDealDialog({ contactId, onSaved, trigger }: { contactId: string; onSaved: () => void; trigger?: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"nuevo" | "existente">("nuevo");
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTab("nuevo"); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"><Briefcase className="h-4 w-4 mr-1.5" />Negocio</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Crear Negocio</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "nuevo" | "existente")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="nuevo">Crear nuevo</TabsTrigger>
            <TabsTrigger value="existente">Agregar existente</TabsTrigger>
          </TabsList>
          <TabsContent value="nuevo" className="mt-0">
            <NewDealForm contactId={contactId} userId={user?.id}
              onDone={(close) => { onSaved(); if (close) setOpen(false); }}
              onCancel={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="existente" className="mt-0">
            <ExistingDealForm contactId={contactId}
              onDone={() => { onSaved(); setOpen(false); }}
              onCancel={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Pestaña "Crear nuevo": Nombre*, Pipeline*, Etapa* (dependiente del pipeline), Valor, Moneda.
export function NewDealForm({ contactId, userId, onDone, onCancel }: { contactId: string; userId?: string; onDone: (close: boolean) => void; onCancel: () => void }) {
  const empty = { nombre: "", id_pipeline: "", id_etapa: "", valor: "", moneda: "MXN", fecha_cierre: "", id_propietario: userId ?? "", tipo_negocio: "", prioridad: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const { data: pipelines } = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipelines")
        .select("id, nombre").eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  // Etapas dependientes del pipeline elegido (cada pipeline tiene su propio embudo).
  const { data: etapas } = useQuery({
    queryKey: ["crm-etapas", form.id_pipeline],
    enabled: !!form.id_pipeline,
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipeline_etapas")
        .select("id, nombre, orden").eq("id_pipeline", Number(form.id_pipeline)).eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  // Propietarios posibles: derivados de los roles con acceso al portal CRM.
  const { data: owners } = useQuery({ queryKey: ["crm-owners"], queryFn: fetchCrmOwners });

  const canSave = !!form.nombre.trim() && !!form.id_pipeline && !!form.id_etapa && !saving;

  const { logCrear } = useCrmLogger();
  const save = async (close: boolean) => {
    if (!canSave) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_negocios").insert({
      nombre: form.nombre.trim(), id_pipeline: Number(form.id_pipeline), id_etapa: Number(form.id_etapa),
      valor: form.valor ? Number(form.valor) : null, moneda: form.moneda,
      fecha_cierre_estimada: form.fecha_cierre || null,
      id_usuario_propietario: form.id_propietario || userId || null,
      tipo_negocio: form.tipo_negocio || null, prioridad: form.prioridad || null,
      id_entidad_relacionada: Number(contactId),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    logCrear("negocio", { nombre: form.nombre, id_pipeline: form.id_pipeline, contactId });
    toast.success("Negocio creado");
    // "Crear y agregar otro": limpia datos pero conserva pipeline/etapa/propietario para encadenar.
    setForm(close ? empty : { ...empty, id_pipeline: form.id_pipeline, id_etapa: form.id_etapa, id_propietario: form.id_propietario });
    onDone(close);
  };

  return (
    <div className="grid gap-3 pt-4">
      <DField label="Nombre del negocio *">
        <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
      </DField>
      <DField label="Pipeline *">
        <Select value={form.id_pipeline} onValueChange={(v) => setForm({ ...form, id_pipeline: v, id_etapa: "" })}>
          <SelectTrigger><SelectValue placeholder="Selecciona un pipeline" /></SelectTrigger>
          <SelectContent>{(pipelines ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}</SelectContent>
        </Select>
      </DField>
      <DField label="Etapa del negocio *">
        <Select value={form.id_etapa} onValueChange={(v) => setForm({ ...form, id_etapa: v })} disabled={!form.id_pipeline}>
          <SelectTrigger><SelectValue placeholder={form.id_pipeline ? "Selecciona una etapa" : "Elige un pipeline primero"} /></SelectTrigger>
          <SelectContent>{(etapas ?? []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}</SelectContent>
        </Select>
      </DField>
      <div className="grid grid-cols-2 gap-3">
        <DField label="Valor">
          <Input type="number" min="0" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
        </DField>
        <DField label="Moneda">
          <Select value={form.moneda} onValueChange={(v) => setForm({ ...form, moneda: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MXN">Peso mexicano (MXN)</SelectItem>
              <SelectItem value="USD">Dólar (USD)</SelectItem>
            </SelectContent>
          </Select>
        </DField>
      </div>
      <DField label="Fecha de cierre">
        <Input type="date" value={form.fecha_cierre} onChange={(e) => setForm({ ...form, fecha_cierre: e.target.value })} />
      </DField>
      <DField label="Propietario del negocio">
        <Select value={form.id_propietario} onValueChange={(v) => setForm({ ...form, id_propietario: v })}>
          <SelectTrigger><SelectValue placeholder="Selecciona un propietario" /></SelectTrigger>
          <SelectContent>{(owners ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
        </Select>
      </DField>
      <div className="grid grid-cols-2 gap-3">
        <DField label="Tipo de negocio">
          <Select value={form.tipo_negocio} onValueChange={(v) => setForm({ ...form, tipo_negocio: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{TIPO_NEGOCIO_OPTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </DField>
        <DField label="Prioridad">
          <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORIDAD_META).map(([value, meta]) => (
                <SelectItem key={value} value={value}>
                  <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DField>
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="outline" onClick={() => save(false)} disabled={!canSave}>Crear y agregar otro</Button>
        <Button onClick={() => save(true)} disabled={!canSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear</Button>
      </DialogFooter>
    </div>
  );
}

// Pestaña "Agregar existente": busca un negocio ya creado y lo asocia al contacto.
export function ExistingDealForm({ contactId, onDone, onCancel }: { contactId: string; onDone: () => void; onCancel: () => void }) {
  const [term, setTerm] = useState("");
  const [assocId, setAssocId] = useState<number | null>(null);
  const { data: results, isFetching } = useQuery({
    queryKey: ["crm-negocios-search", term.trim()],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_negocios")
        .select("id, nombre, valor, moneda").eq("activo", true)
        .ilike("nombre", `%${term.trim()}%`).order("fecha_creacion", { ascending: false }).limit(20);
      return (data ?? []) as any[];
    },
  });
  const associate = async (dealId: number) => {
    setAssocId(dealId);
    // Un negocio pertenece a un solo contacto: asociar = fijar su contacto.
    const { error } = await (supabase as any).from("crm_negocios")
      .update({ id_entidad_relacionada: Number(contactId) }).eq("id", dealId);
    setAssocId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Negocio asociado"); onDone();
  };
  return (
    <div className="grid gap-3 pt-4">
      <div className="relative">
        <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar negocio por nombre" className="pl-8" autoFocus />
      </div>
      {term.trim().length < 2 ? (
        <p className="text-xs text-muted-foreground">Escribe al menos 2 caracteres para buscar.</p>
      ) : isFetching ? (
        <p className="text-xs text-muted-foreground">Buscando…</p>
      ) : !results?.length ? (
        <p className="text-xs text-muted-foreground">Sin resultados.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {results.map((d) => (
            <button key={d.id} onClick={() => associate(d.id)} disabled={assocId === d.id}
              className="w-full text-left rounded-md border border-border p-2.5 bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50">
              <div className="text-sm font-medium truncate">{d.nombre}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{d.valor != null ? fmtMoneda(Number(d.valor), d.moneda) : "—"}</div>
            </button>
          ))}
        </div>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </DialogFooter>
    </div>
  );
}

// Diálogo "Crear negocio" desde el módulo (contacto OPCIONAL, con búsqueda).
// A diferencia de NewDealForm (que exige un contacto), aquí el contacto puede
// quedar en NULL para crear un negocio suelto desde la vista de Negocios.
export function NewDealDialog({ open, onOpenChange, onSaved, soloContactos = null, contactoObligatorio = false }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; soloContactos?: number[] | null; contactoObligatorio?: boolean }) {
  const { user } = useAuth();
  const empty = { nombre: "", id_pipeline: "", id_etapa: "", valor: "", moneda: "MXN", fecha_cierre: "", id_propietario: user?.id ?? "", tipo_negocio: "", prioridad: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [contact, setContact] = useState<{ id: number; name: string } | null>(null);
  const [contactSearch, setContactSearch] = useState("");

  const { data: pipelines } = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipelines").select("id, nombre").eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  const { data: etapas } = useQuery({
    queryKey: ["crm-etapas", form.id_pipeline],
    enabled: !!form.id_pipeline,
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipeline_etapas").select("id, nombre, orden").eq("id_pipeline", Number(form.id_pipeline)).eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  const { data: owners } = useQuery({ queryKey: ["crm-owners"], queryFn: fetchCrmOwners });

  // Búsqueda de contacto (mismo patrón que el diálogo global de tarea).
  const permitidos = useMemo(() => (soloContactos ? new Set(soloContactos) : null), [soloContactos]);
  const { data: contactResults = [], isFetching } = useQuery({
    queryKey: ["crm-deal-contact-search", contactSearch, soloContactos?.length ?? null],
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
      const encontrados = (ents ?? []).map((e: any) => ({ id: e.id, name: pName[e.id_persona] ?? "Sin nombre" })) as { id: number; name: string }[];
      // En el Portal del Personal solo se puede colgar el negocio de un contacto
      // propio: de otro modo se crearía un negocio que la persona no vería.
      return permitidos ? encontrados.filter((c) => permitidos.has(c.id)) : encontrados;
    },
  });

  const canSave = !!form.nombre.trim() && !!form.id_pipeline && !!form.id_etapa && !saving
    && (!contactoObligatorio || !!contact);
  const reset = () => { setForm(empty); setContact(null); setContactSearch(""); };

  const { logCrear } = useCrmLogger();
  const save = async (close: boolean) => {
    if (!canSave) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_negocios").insert({
      nombre: form.nombre.trim(), id_pipeline: Number(form.id_pipeline), id_etapa: Number(form.id_etapa),
      valor: form.valor ? Number(form.valor) : null, moneda: form.moneda,
      fecha_cierre_estimada: form.fecha_cierre || null,
      id_usuario_propietario: form.id_propietario || user?.id || null,
      tipo_negocio: form.tipo_negocio || null, prioridad: form.prioridad || null,
      id_entidad_relacionada: contact ? contact.id : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    logCrear("negocio", { nombre: form.nombre, id_pipeline: form.id_pipeline, contactId: contact?.id ?? null });
    toast.success("Negocio creado");
    onSaved();
    if (close) { reset(); onOpenChange(false); }
    else { setForm({ ...empty, id_pipeline: form.id_pipeline, id_etapa: form.id_etapa, id_propietario: form.id_propietario }); setContact(null); setContactSearch(""); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Crear negocio</DialogTitle></DialogHeader>
        <div className="grid gap-3 pt-2">
          <DField label="Nombre del negocio *"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus /></DField>
          <DField label="Pipeline *">
            <Select value={form.id_pipeline} onValueChange={(v) => setForm({ ...form, id_pipeline: v, id_etapa: "" })}>
              <SelectTrigger><SelectValue placeholder="Selecciona un pipeline" /></SelectTrigger>
              <SelectContent>{(pipelines ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </DField>
          <DField label="Etapa del negocio *">
            <Select value={form.id_etapa} onValueChange={(v) => setForm({ ...form, id_etapa: v })} disabled={!form.id_pipeline}>
              <SelectTrigger><SelectValue placeholder={form.id_pipeline ? "Selecciona una etapa" : "Elige un pipeline primero"} /></SelectTrigger>
              <SelectContent>{(etapas ?? []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </DField>
          {/* Contacto asociado (opcional) */}
          <div>
            <Label>
              Contacto asociado{" "}
              <span className="text-muted-foreground font-normal">
                {contactoObligatorio ? "(obligatorio — debe ser uno de tus referidos)" : "(opcional)"}
              </span>
            </Label>
            {contact ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium truncate">{contact.name}</span>
                <button type="button" onClick={() => setContact(null)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Escribe al menos 2 letras… (o déjalo vacío)" className="pl-8" />
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
          <div className="grid grid-cols-2 gap-3">
            <DField label="Valor"><Input type="number" min="0" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></DField>
            <DField label="Moneda">
              <Select value={form.moneda} onValueChange={(v) => setForm({ ...form, moneda: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MXN">Peso mexicano (MXN)</SelectItem><SelectItem value="USD">Dólar (USD)</SelectItem></SelectContent>
              </Select>
            </DField>
          </div>
          <DField label="Fecha de cierre"><Input type="date" value={form.fecha_cierre} onChange={(e) => setForm({ ...form, fecha_cierre: e.target.value })} /></DField>
          <DField label="Propietario del negocio">
            <Select value={form.id_propietario} onValueChange={(v) => setForm({ ...form, id_propietario: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona un propietario" /></SelectTrigger>
              <SelectContent>{(owners ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
            </Select>
          </DField>
          <div className="grid grid-cols-2 gap-3">
            <DField label="Tipo de negocio">
              <Select value={form.tipo_negocio} onValueChange={(v) => setForm({ ...form, tipo_negocio: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{TIPO_NEGOCIO_OPTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </DField>
            <DField label="Prioridad">
              <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDAD_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DField>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={!canSave}>Crear y agregar otro</Button>
          <Button onClick={() => save(true)} disabled={!canSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DealMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-1">{value}</p>
    </div>
  );
}

// Menú de acciones (Ver · Editar · Eliminar) de un negocio.
export function DealActionsMenu({ deal, onOpen, onEdit, onDelete, onBoard }: { deal: any; onOpen: (id: number) => void; onEdit: (d: any) => void; onDelete: (d: any) => void; onBoard?: boolean }) {
  const { permisosPath: negociosPermisos } = useCrmNegociosPortal();
  const canDelete = useCrmCanDelete(negociosPermisos);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="Acciones"
          className={`inline-flex items-center justify-center rounded-md transition-colors ${onBoard ? "h-6 w-6 text-muted-foreground/60 hover:text-foreground hover:bg-muted" : "h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onOpen(deal.id)}><Briefcase className="h-4 w-4 mr-2" />Ver negocio</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(deal)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(deal)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Señal Purchase → Meta cuando un negocio pasa a etapa "Cierre Ganado" (es_ganado).
// Auto-contenido: checa el toggle del catálogo (crm_meta_conversion_stages, fila
// 'cierre_ganado', activo=true) y, si está prendido, dispara el evento con value+moneda.
// Fire-and-forget: nunca bloquea el guardado del negocio.
export async function firePurchaseIfWon(opts: {
  id_entidad_relacionada: number | null | undefined;
  valor: number | null | undefined;
  moneda: string | null | undefined;
  esGanado: boolean;
}) {
  if (!opts.esGanado || !opts.id_entidad_relacionada) return;
  try {
    const { data: cfg } = await (supabase as any)
      .from("crm_meta_conversion_stages")
      .select("meta_event_name")
      .eq("etapa_ciclo_vida", "cierre_ganado")
      .eq("activo", true)
      .maybeSingle();
    if (!cfg?.meta_event_name) return; // toggle OFF → no se manda nada
    await (supabase as any).functions.invoke("meta-capi-lead-stage", {
      body: {
        id_entidad_relacionada: Number(opts.id_entidad_relacionada),
        event_name: cfg.meta_event_name,
        value: opts.valor != null ? Number(opts.valor) : undefined,
        currency: opts.moneda || "MXN",
      },
    });
  } catch (e: any) {
    console.warn("meta-capi purchase:", e?.message ?? e);
  }
}

// Diálogo para editar un negocio (mismos campos que "Acerca de este negocio").
export function EditDealDialog({ deal, pipelines, owners, onOpenChange, onSaved }: { deal: any | null; pipelines: any[]; owners: any[]; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (deal) setForm({
      nombre: deal.nombre ?? "",
      id_pipeline: deal.id_pipeline ? String(deal.id_pipeline) : "",
      id_etapa: deal.id_etapa ? String(deal.id_etapa) : "",
      valor: deal.valor != null ? String(deal.valor) : "",
      moneda: deal.moneda ?? "MXN",
      fecha_cierre: deal.fecha_cierre_estimada ?? "",
      id_propietario: deal.id_usuario_propietario ?? "",
      tipo_negocio: deal.tipo_negocio ?? "",
      prioridad: deal.prioridad ?? "",
    });
  }, [deal]);

  const { data: etapas } = useQuery({
    queryKey: ["edit-deal-etapas", form?.id_pipeline],
    enabled: !!form?.id_pipeline,
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipeline_etapas")
        .select("id, nombre, orden, es_ganado").eq("id_pipeline", Number(form.id_pipeline)).eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string; es_ganado?: boolean }[];
    },
  });

  const { logActualizar } = useCrmLogger();
  const save = async () => {
    if (!form || !form.nombre.trim() || !deal) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_negocios").update({
      nombre: form.nombre.trim(),
      id_pipeline: form.id_pipeline ? Number(form.id_pipeline) : null,
      id_etapa: form.id_etapa ? Number(form.id_etapa) : null,
      valor: form.valor ? Number(form.valor) : null,
      moneda: form.moneda,
      fecha_cierre_estimada: form.fecha_cierre || null,
      id_usuario_propietario: form.id_propietario || null,
      tipo_negocio: form.tipo_negocio || null,
      prioridad: form.prioridad || null,
    }).eq("id", deal.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    logActualizar("negocio", null, { id: deal.id, nombre: form.nombre });
    toast.success("Negocio actualizado");
    const etGanado = !!(etapas ?? []).find((e: any) => String(e.id) === form.id_etapa)?.es_ganado;
    firePurchaseIfWon({ id_entidad_relacionada: deal.id_entidad_relacionada, valor: form.valor ? Number(form.valor) : null, moneda: form.moneda, esGanado: etGanado });
    onSaved();
  };

  if (!form) return (
    <Dialog open={!!deal} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Editar negocio</DialogTitle></DialogHeader></DialogContent>
    </Dialog>
  );

  return (
    <Dialog open={!!deal} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar negocio</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <DField label="Nombre *"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></DField>
          <div className="grid grid-cols-2 gap-2">
            <DField label="Pipeline">
              <Select value={form.id_pipeline} onValueChange={(v) => setForm({ ...form, id_pipeline: v, id_etapa: "" })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </DField>
            <DField label="Etapa">
              <Select value={form.id_etapa} onValueChange={(v) => setForm({ ...form, id_etapa: v })} disabled={!form.id_pipeline}>
                <SelectTrigger><SelectValue placeholder={form.id_pipeline ? "Etapa" : "Elige pipeline"} /></SelectTrigger>
                <SelectContent>{(etapas ?? []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </DField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DField label="Valor"><Input type="number" min="0" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></DField>
            <DField label="Moneda">
              <Select value={form.moneda} onValueChange={(v) => setForm({ ...form, moneda: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </DField>
          </div>
          <DField label="Fecha de cierre"><Input type="date" value={form.fecha_cierre} onChange={(e) => setForm({ ...form, fecha_cierre: e.target.value })} /></DField>
          <DField label="Propietario">
            <Select value={form.id_propietario} onValueChange={(v) => setForm({ ...form, id_propietario: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
            </Select>
          </DField>
          <div className="grid grid-cols-2 gap-2">
            <DField label="Tipo de negocio">
              <Select value={form.tipo_negocio} onValueChange={(v) => setForm({ ...form, tipo_negocio: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{TIPO_NEGOCIO_OPTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </DField>
            <DField label="Prioridad">
              <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDAD_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.nombre.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Columna del tablero (zona soltable). Colapsable a una pestaña vertical.
export function BoardColumn({ etapa, deals, colorClass, collapsed, onToggle, onOpen, onEdit, onDelete }: { etapa: any; deals: any[]; colorClass: string; collapsed: boolean; onToggle: () => void; onOpen: (id: number) => void; onEdit: (d: any) => void; onDelete: (d: any) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const total = deals.reduce((s, r) => s + Number(r.valor ?? 0), 0);
  const ponderada = deals.reduce((s, r) => s + Number(r.valor ?? 0) * (Number(r.probabilidad ?? 0) / 100), 0);

  if (collapsed) {
    return (
      <div ref={setNodeRef} className={`shrink-0 w-11 self-stretch rounded-lg border ${colorClass} ${isOver ? "ring-2 ring-primary" : ""}`}>
        <button onClick={onToggle} title={`Mostrar ${etapa.nombre}`}
          className="h-full w-full min-h-[240px] flex flex-col items-center gap-2 py-2 cursor-pointer hover:opacity-80 transition-opacity">
          <ChevronRight className="h-4 w-4 shrink-0" />
          <span className="[writing-mode:vertical-lr] text-xs font-semibold whitespace-nowrap">{etapa.nombre}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{deals.length}</Badge>
        </button>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className={`min-w-[276px] max-w-[276px] flex flex-col rounded-lg ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className={`rounded-t-lg px-3 py-2 flex items-center justify-between ${colorClass}`}>
        <span className="font-semibold text-sm truncate">{etapa.nombre}</span>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary" className="text-xs">{deals.length}</Badge>
          <button onClick={onToggle} title="Contraer columna" className="opacity-70 hover:opacity-100 transition-opacity"><ChevronLeft className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="border border-t-0 bg-muted/30 p-2 space-y-2 min-h-[240px] max-h-[calc(100vh-380px)] overflow-y-auto flex-1">
        {deals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sin negocios</p>
        ) : deals.map((d) => <DealBoardCard key={d.id} deal={d} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
      <div className="rounded-b-lg border border-t-0 bg-card px-3 py-1.5 text-[11px] text-muted-foreground space-y-0.5">
        <div className="flex items-center justify-between gap-2"><span>Cantidad total</span><span className="font-semibold tabular-nums text-foreground">{fmtMXN(total)}</span></div>
        <div className="flex items-center justify-between gap-2"><span>Ponderada</span><span className="tabular-nums">{fmtMXN(ponderada)}</span></div>
      </div>
    </div>
  );
}

// Fondo/tono del pill de prioridad.
export const PRIORIDAD_PILL: Record<string, string> = {
  baja: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  media: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  alta: "bg-red-500/10 text-red-700 dark:text-red-400",
};

// Tarjeta arrastrable del tablero.
// Normaliza (sin acentos, minúsculas) para detectar si el contacto es "el mismo" que el
// nombre del negocio y evitar mostrarlo dos veces (ahorra espacio en la tarjeta).
const normName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function sameEntity(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = normName(a), nb = normName(b);
  return !!na && !!nb && (na.includes(nb) || nb.includes(na));
}

export function DealBoardCard({ deal, dragging, onOpen, onEdit, onDelete }: { deal: any; dragging?: boolean; onOpen?: (id: number) => void; onEdit?: (d: any) => void; onDelete?: (d: any) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined;
  const prio = deal.prioridad && PRIORIDAD_META[deal.prioridad] ? deal.prioridad : null;
  const sem = interactionSemaphore(deal.ultima_actividad);
  const semMeta = SEMAPHORE_META[sem];
  const rel = deal.ultima_actividad ? relTime(deal.ultima_actividad) : null;
  const hasActions = !!(onOpen && onEdit && onDelete);
  const hasValor = deal.valor != null && deal.valor !== "";
  const showContact = deal.contacto_nombre && !sameEntity(deal.contacto_nombre, deal.nombre);
  const hasFooter = hasValor || !!prio || !!deal.fecha_cierre_estimada;
  const pb = perfilBadge(deal.perfil);  // perfil del comprador (condensado)
  return (
    <Card ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`cursor-grab active:cursor-grabbing border-border hover:border-primary/40 hover:shadow-md transition-all ${(isDragging || dragging) ? "opacity-60 shadow-lg" : ""}`}>
      <CardContent className="p-3 space-y-1.5">
        {/* Header: semáforo de interacción (texto) + acciones */}
        <div className="flex items-center justify-between gap-2">
          <span title={rel ? `${semMeta.label} · última actividad ${rel}` : semMeta.label}
            className={`inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2 py-0.5 text-[10px] font-medium min-w-0 ${semMeta.tint}`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${semMeta.dot}`} />
            <span className="truncate">{semMeta.short}{rel ? ` · ${rel}` : ""}</span>
          </span>
          <div className="flex items-center gap-0.5 shrink-0">
            {hasActions && <DealActionsMenu deal={deal} onOpen={onOpen!} onEdit={onEdit!} onDelete={onDelete!} onBoard />}
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden="true" />
          </div>
        </div>

        {/* Nombre del negocio */}
        {onOpen ? (
          <button onClick={(e) => { e.stopPropagation(); onOpen(deal.id); }}
            className="block text-sm font-semibold leading-snug text-left hover:text-primary hover:underline">
            {deal.nombre}
          </button>
        ) : (
          <p className="text-sm font-semibold leading-snug">{deal.nombre}</p>
        )}

        {/* Contacto asociado (solo si aporta info nueva respecto al nombre) */}
        {showContact && (
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary text-[9px] font-semibold flex items-center justify-center">{dealInitials(deal.contacto_nombre)}</span>
            <span className="text-xs text-muted-foreground truncate">{deal.contacto_nombre}</span>
          </div>
        )}

        {/* Perfil del comprador (condensado): tipo+edad · intención · ventana */}
        {pb && (
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary max-w-full"
            title="Perfil del comprador">
            <UserRound className="h-3 w-3 shrink-0" />
            <span className="truncate">{[pb.tipoEdad, pb.intencion, pb.ventana].filter(Boolean).join(" · ")}</span>
          </span>
        )}

        {/* Próximo seguimiento sugerido por IA: canal + fecha/hora */}
        {deal.ia?.proximo_fecha && (
          <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 text-[10px] font-medium max-w-full"
            title="Próximo seguimiento sugerido por IA">
            {deal.ia.proximo_tipo === "llamada" ? <Phone className="h-3 w-3 shrink-0" /> : <MessageSquare className="h-3 w-3 shrink-0" />}
            <span className="truncate">{fmtDueDateTime(deal.ia.proximo_fecha)}</span>
          </span>
        )}

        {/* Footer adaptable: monto (o propietario) + prioridad + fecha de cierre. Se omite si no hay nada. */}
        {hasFooter && (
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2 mt-0.5">
            {hasValor ? (
              <span className="text-sm font-semibold tabular-nums truncate">{fmtMoneda(Number(deal.valor), deal.moneda)}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground truncate">{deal.propietario_nombre && deal.propietario_nombre !== "—" ? deal.propietario_nombre : "Sin monto"}</span>
            )}
            <div className="flex items-center gap-2 shrink-0">
              {prio && (
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORIDAD_PILL[prio]}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${PRIORIDAD_META[prio].dot}`} />{PRIORIDAD_META[prio].label}
                </span>
              )}
              {deal.fecha_cierre_estimada && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                  <Calendar className="h-3 w-3" />{fmtDate(deal.fecha_cierre_estimada)}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Quita etiquetas HTML de las notas (se guardan como HTML) para mandar texto plano a la IA.
const htmlToPlain = (h?: string | null) =>
  (h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;/g, "'").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ").trim();

// Pestaña "Asistente IA". El asesor captura el contexto de la cita y, además, la IA recibe
// automáticamente el historial ya registrado del negocio (perfil, notas, citas, tareas) →
// Claude (Edge Function analizar-negocio-ia) integra ambos y devuelve perfil, % de cierre,
// nota de bitácora, borrador de WhatsApp y próximo paso. El asesor revisa y aplica con 1 clic.
// Persiste en crm_negocios_ia.
export function DealAsistenteIA({ deal }: { deal: any }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const dealId = deal?.id;
  const erId = deal?.id_entidad_relacionada ?? null;
  const [texto, setTexto] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [savedTask, setSavedTask] = useState(false);
  const loadedRef = useRef<string | undefined>(undefined);

  // Carga el último análisis guardado (para reabrir sin reprocesar).
  const { data: prev } = useQuery({
    queryKey: ["deal-ia", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_negocios_ia")
        .select("*").eq("id_negocio", Number(dealId)).eq("activo", true).maybeSingle();
      if (res.error) return null;
      return res.data ?? null;
    },
  });
  useEffect(() => {
    if (prev && loadedRef.current !== String(dealId)) {
      loadedRef.current = String(dealId);
      setTexto(prev.contexto_input ?? "");
      setResult({
        perfil_cliente: prev.perfil_cliente,
        probabilidad_cierre: prev.probabilidad_cierre,
        justificacion: prev.justificacion,
        nota_bitacora: prev.nota_generada,
        whatsapp_borrador: prev.whatsapp_borrador,
        proximo_paso: { tipo: prev.proximo_tipo, fecha_iso: prev.proximo_fecha, razonamiento: prev.proximo_razonamiento },
        modelo: prev.modelo,
        fecha_generacion: prev.fecha_generacion,
      });
    }
  }, [prev, dealId]);

  const combineISO = (fecha?: string, hora?: string): string | null => {
    if (!fecha) return null;
    const d = new Date(`${fecha}T${hora || "09:00"}:00`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  // Fase 2: junta lo que ya existe del negocio (perfil del comprador + notas + citas + tareas)
  // para que la IA lo use junto con lo que el asesor pega. Respeta RLS (mismo cliente del asesor).
  const { data: historial } = useQuery({
    queryKey: ["deal-historial-ia", dealId, erId],
    enabled: !!dealId,
    queryFn: async () => {
      const [perfilRes, notasRes, tareasRes, citasRes] = await Promise.all([
        (supabase as any).from("crm_negocios_perfil_comprador").select("*").eq("id_negocio", Number(dealId)).eq("activo", true).maybeSingle(),
        erId ? (supabase as any).from("crm_notas").select("contenido, fecha_creacion").eq("id_entidad_relacionada", Number(erId)).eq("activo", true).order("fecha_creacion", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
        erId ? (supabase as any).from("crm_tareas").select("titulo, tipo, estatus, prioridad, descripcion, fecha_vencimiento").eq("id_entidad_relacionada", Number(erId)).eq("activo", true).order("fecha_creacion", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
        erId ? (supabase as any).from("crm_citas").select("titulo, tipo, estatus, fecha_inicio, resultado, descripcion").eq("id_entidad_relacionada", Number(erId)).eq("activo", true).order("fecha_inicio", { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
      ]);
      const pr = (perfilRes as any)?.error ? null : (perfilRes as any)?.data;
      const perfilObj = pr ? {
        tipo_asistente: optLabel(TIPO_ASISTENTE, pr.tipo_asistente),
        rango_edad: optLabel(RANGO_EDAD, pr.rango_edad),
        toma_decision: optLabel(TOMA_DECISION, pr.toma_decision),
        intencion_uso: optLabel(INTENCION_USO, pr.intencion_uso),
        experiencia_preventa: optLabel(EXPERIENCIA_PREVENTA, pr.experiencia_preventa),
        etapa_exploracion: optLabel(ETAPA_EXPLORACION, pr.etapa_exploracion),
        proyeccion_cierre: optLabel(PROYECCION_CIERRE, pr.proyeccion_cierre),
        competencia_visitada: pr.competencia_visitada || null,
        puntos_positivos: (pr.puntos_positivos ?? []).map((v: string) => optLabel(PUNTOS_POSITIVOS, v)).filter(Boolean),
        puntos_negativos: (pr.puntos_negativos ?? []).map((v: string) => optLabel(PUNTOS_NEGATIVOS, v)).filter(Boolean),
      } : null;
      const perfil = perfilObj
        ? Object.fromEntries(Object.entries(perfilObj).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)))
        : null;
      const notas = (((notasRes as any)?.data ?? []) as any[])
        .map((n) => ({ fecha: n.fecha_creacion, texto: htmlToPlain(n.contenido).slice(0, 800) })).filter((n) => n.texto);
      const tareas = (((tareasRes as any)?.data ?? []) as any[])
        .map((t) => ({ titulo: t.titulo, tipo: t.tipo, estatus: t.estatus, prioridad: t.prioridad, vence: t.fecha_vencimiento, descripcion: t.descripcion || undefined }));
      const citas = (((citasRes as any)?.error ? [] : ((citasRes as any)?.data ?? [])) as any[])
        .map((c) => ({ titulo: c.titulo, tipo: c.tipo, estatus: c.estatus, fecha: c.fecha_inicio, resultado: c.resultado || undefined, descripcion: c.descripcion || undefined }));
      const payload: any = {};
      if (perfil && Object.keys(perfil).length) payload.perfil = perfil;
      if (notas.length) payload.notas = notas;
      if (citas.length) payload.citas = citas;
      if (tareas.length) payload.tareas = tareas;
      return { payload, counts: { perfil: !!(perfil && Object.keys(perfil).length), notas: notas.length, citas: citas.length, tareas: tareas.length } };
    },
  });
  const cnt = historial?.counts;
  const hasHistory = !!cnt && (cnt.perfil || cnt.notas > 0 || cnt.citas > 0 || cnt.tareas > 0);

  const analyze = async () => {
    if (!texto.trim() && !hasHistory) { toast.error("Escribe el contexto de la cita, o registra notas/citas/perfil del negocio para que la IA tenga con qué trabajar."); return; }
    setAnalyzing(true); setSavedNote(false); setSavedTask(false);
    try {
      const negocio = { nombre: deal?.nombre, etapa: deal?.etapa_nombre, pipeline: deal?.pipeline_nombre, valor: deal?.valor, contacto: deal?.contacto?.nombre ?? deal?.contacto_nombre };
      const histPayload = historial?.payload && Object.keys(historial.payload).length ? historial.payload : undefined;
      const { data, error } = await (supabase as any).functions.invoke("analizar-negocio-ia", { body: { texto: texto.trim(), negocio, historial: histPayload } });
      if (error) throw new Error(error.message || "Error al invocar la IA");
      if (!data?.ok) throw new Error(data?.error || "La IA no pudo procesar el contexto");
      const r = data.resultado;
      const proximoISO = combineISO(r?.proximo_paso?.fecha_sugerida, r?.proximo_paso?.hora_sugerida);
      const { error: upErr } = await (supabase as any).from("crm_negocios_ia").upsert({
        id_negocio: Number(dealId),
        perfil_cliente: r.perfil_cliente || null,
        probabilidad_cierre: r.probabilidad_cierre ?? null,
        justificacion: r.justificacion || null,
        nota_generada: r.nota_bitacora || null,
        whatsapp_borrador: r.whatsapp_borrador || null,
        proximo_tipo: r.proximo_paso?.tipo || null,
        proximo_fecha: proximoISO,
        proximo_razonamiento: r.proximo_paso?.razonamiento || null,
        contexto_input: texto.trim(),
        modelo: r.modelo || null,
        generado_por: user?.id ?? null,
        fecha_generacion: new Date().toISOString(),
      }, { onConflict: "id_negocio" });
      if (upErr) toast.error("Análisis listo, pero no se pudo guardar: " + upErr.message);
      setResult({ ...r, proximo_paso: { ...r.proximo_paso, fecha_iso: proximoISO } });
      qc.invalidateQueries({ queryKey: ["deals-list"] });
      qc.invalidateQueries({ queryKey: ["deal-ia", dealId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Error al analizar");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveAsNote = async () => {
    if (!erId) { toast.error("El negocio no tiene contacto asociado para guardar la nota."); return; }
    if (!result) return;
    setSavingNote(true);
    const prob = result.probabilidad_cierre;
    const html = `<p><strong>Análisis IA — probabilidad de cierre: ${prob ?? "?"}%</strong> · Perfil: ${result.perfil_cliente || "—"}</p>`
      + `<p>${(result.nota_bitacora || "").replace(/\n/g, "<br/>")}</p>`
      + (result.justificacion ? `<p><em>${result.justificacion.replace(/\n/g, "<br/>")}</em></p>` : "");
    const { error } = await (supabase as any).from("crm_notas").insert({
      id_entidad_relacionada: Number(erId), id_usuario: user?.id ?? null, contenido: html,
      fecha_actividad: new Date().toISOString().split("T")[0],
    });
    setSavingNote(false);
    if (error) { toast.error(error.message); return; }
    setSavedNote(true); toast.success("Nota guardada en el CRM");
    qc.invalidateQueries({ queryKey: ["deal-activity", erId] });
    qc.invalidateQueries({ queryKey: ["deal-historial-ia", dealId, erId] });
  };

  const scheduleTask = async () => {
    if (!erId) { toast.error("El negocio no tiene contacto asociado para agendar la tarea."); return; }
    if (!result?.proximo_paso) return;
    setSavingTask(true);
    const pp = result.proximo_paso;
    const { error } = await (supabase as any).from("crm_tareas").insert({
      id_entidad_relacionada: Number(erId),
      titulo: pp.tipo === "llamada" ? "Llamada de seguimiento (IA)" : "Mensaje de seguimiento (IA)",
      tipo: pp.tipo === "llamada" ? "llamada" : "whatsapp",
      prioridad: "normal",
      descripcion: pp.razonamiento || null,
      fecha_vencimiento: pp.fecha_iso ?? null,
      id_usuario_asignado: user?.id ?? null,
      estatus: "pendiente",
    });
    setSavingTask(false);
    if (error) { toast.error(error.message); return; }
    setSavedTask(true); toast.success("Tarea agendada");
    qc.invalidateQueries({ queryKey: ["deal-activity", erId] });
    qc.invalidateQueries({ queryKey: ["deal-historial-ia", dealId, erId] });
  };

  const copyWhatsapp = () => {
    if (!result?.whatsapp_borrador) return;
    try { navigator.clipboard.writeText(result.whatsapp_borrador); toast.success("Borrador copiado"); }
    catch { toast.error("No se pudo copiar"); }
  };

  const prob = result?.probabilidad_cierre;
  const probColor = prob == null ? "text-muted-foreground" : prob >= 66 ? "text-emerald-600" : prob >= 33 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-4">
      {/* Módulo A: contexto */}
      <section className="bg-card border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Contexto de la cita / interacción</h3>
        </div>
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5}
          placeholder="Describe cómo estuvo la cita: qué dijo el cliente, objeciones, presupuesto, quién decide, nivel de interés… (opcional si el negocio ya tiene historial)" />
        {hasHistory && (
          <p className="text-[11px] text-muted-foreground">
            La IA también usará lo que ya existe del negocio:{" "}
            {[
              cnt?.perfil ? "perfil del comprador" : null,
              cnt?.notas ? `${cnt.notas} nota${cnt.notas > 1 ? "s" : ""}` : null,
              cnt?.citas ? `${cnt.citas} cita${cnt.citas > 1 ? "s" : ""}` : null,
              cnt?.tareas ? `${cnt.tareas} tarea${cnt.tareas > 1 ? "s" : ""}` : null,
            ].filter(Boolean).join(" · ")}.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Voz y archivos (imágenes/PDF) llegan en una fase posterior.</p>
          <Button size="sm" onClick={analyze} disabled={analyzing || (!texto.trim() && !hasHistory)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {analyzing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Analizando…</> : <><Sparkles className="h-4 w-4 mr-1.5" />Analizar con IA</>}
          </Button>
        </div>
      </section>

      {result && (
        <>
          <section className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Perfil del cliente</div>
                <div className="text-sm font-medium mt-0.5">{result.perfil_cliente || "—"}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prob. de cierre</div>
                <div className={`text-2xl font-bold tabular-nums ${probColor}`}>{prob != null ? `${prob}%` : "—"}</div>
              </div>
            </div>
            {result.justificacion && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{result.justificacion}</p>}
          </section>

          <section className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nota de bitácora</h3>
              <Button size="sm" variant="outline" onClick={saveAsNote} disabled={savingNote || savedNote || !erId} className="h-7 text-xs">
                {savingNote ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Guardando…</> : savedNote ? <><Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />Guardada</> : "Guardar como nota"}
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{result.nota_bitacora || "—"}</p>
          </section>

          <section className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-emerald-600" />Sugerencia de seguimiento (WhatsApp)</h3>
              <Button size="sm" variant="outline" onClick={copyWhatsapp} disabled={!result.whatsapp_borrador} className="h-7 text-xs"><Copy className="h-3.5 w-3.5 mr-1" />Copiar</Button>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed rounded-md bg-muted/40 p-2.5">{result.whatsapp_borrador || "—"}</p>
          </section>

          <section className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Próximo paso sugerido</h3>
              <Button size="sm" variant="outline" onClick={scheduleTask} disabled={savingTask || savedTask || !erId} className="h-7 text-xs">
                {savingTask ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Agendando…</> : savedTask ? <><Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />Agendada</> : "Agendar tarea"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400 px-2 py-0.5 text-xs font-medium">
                {result.proximo_paso?.tipo === "llamada" ? <Phone className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                {result.proximo_paso?.tipo === "llamada" ? "Llamada" : "Mensaje"}
              </span>
              {result.proximo_paso?.fecha_iso && (
                <span className="inline-flex items-center gap-1 text-muted-foreground text-xs"><Calendar className="h-3.5 w-3.5" />{fmtDueDateTime(result.proximo_paso.fecha_iso)}</span>
              )}
            </div>
            {result.proximo_paso?.razonamiento && <p className="text-xs text-muted-foreground leading-relaxed">{result.proximo_paso.razonamiento}</p>}
          </section>

          {result.fecha_generacion && (
            <p className="text-[11px] text-muted-foreground text-center">Generado {relTime(result.fecha_generacion)} · modelo {result.modelo || "—"}</p>
          )}
        </>
      )}
    </div>
  );
}

// Pestaña "Perfil del comprador" de la ficha del negocio. Autoguardado a
// crm_negocios_perfil_comprador (1:1 con el negocio). Catálogos fijos en crm-perfil-comprador.
export function DealPerfilComprador({ dealId }: { dealId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<any | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const loadedRef = useRef<string | undefined>(undefined);
  const skipSave = useRef(true);

  const { data: perfil, isLoading } = useQuery({
    queryKey: ["deal-perfil", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_negocios_perfil_comprador")
        .select("*").eq("id_negocio", Number(dealId)).eq("activo", true).maybeSingle();
      if (res.error) return null; // fail-soft si la tabla aún no existe
      return res.data ?? null;
    },
  });

  // Hidrata una sola vez por negocio (tras resolver la query), sin pisar ediciones.
  useEffect(() => {
    if (!isLoading && loadedRef.current !== dealId) {
      loadedRef.current = dealId;
      skipSave.current = true;
      setForm({
        tipo_asistente: perfil?.tipo_asistente ?? "",
        rango_edad: perfil?.rango_edad ?? "",
        toma_decision: perfil?.toma_decision ?? "",
        intencion_uso: perfil?.intencion_uso ?? "",
        experiencia_preventa: perfil?.experiencia_preventa ?? "",
        etapa_exploracion: perfil?.etapa_exploracion ?? "",
        competencia_visitada: perfil?.competencia_visitada ?? "",
        puntos_positivos: perfil?.puntos_positivos ?? [],
        puntos_negativos: perfil?.puntos_negativos ?? [],
        proyeccion_cierre: perfil?.proyeccion_cierre ?? "",
      });
    }
  }, [isLoading, perfil, dealId]);

  // Autoguardado con debounce (upsert 1:1 por id_negocio).
  useEffect(() => {
    if (!form) return;
    if (skipSave.current) { skipSave.current = false; return; }
    setSaveState("saving");
    const t = setTimeout(async () => {
      const payload = {
        id_negocio: Number(dealId),
        tipo_asistente: form.tipo_asistente || null,
        rango_edad: form.rango_edad || null,
        toma_decision: form.toma_decision || null,
        intencion_uso: form.intencion_uso || null,
        experiencia_preventa: form.experiencia_preventa || null,
        etapa_exploracion: form.etapa_exploracion || null,
        competencia_visitada: form.competencia_visitada?.trim() || null,
        puntos_positivos: form.puntos_positivos ?? [],
        puntos_negativos: form.puntos_negativos ?? [],
        proyeccion_cierre: form.proyeccion_cierre || null,
        ...(perfil ? {} : { creado_por: user?.id ?? null }),
      };
      const { error } = await (supabase as any).from("crm_negocios_perfil_comprador")
        .upsert(payload, { onConflict: "id_negocio" });
      if (error) { toast.error(error.message); setSaveState("idle"); return; }
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: ["deals-list"] }); // refresca el badge del tablero
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleTag = (field: "puntos_positivos" | "puntos_negativos", val: string) =>
    setForm((f: any) => {
      const arr: string[] = f[field] ?? [];
      return { ...f, [field]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });

  if (!form) return <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  const sel = (label: string, k: string, opts: PerfilOpt[]) => (
    <DField label={label}>
      <Select value={form[k]} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </DField>
  );
  const tagGroup = (field: "puntos_positivos" | "puntos_negativos", opts: PerfilOpt[], accent: string) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
      {opts.map((o) => (
        <label key={o.value} className="flex items-start gap-2 text-xs cursor-pointer rounded px-1 py-1 hover:bg-muted/50">
          <Checkbox checked={(form[field] ?? []).includes(o.value)} onCheckedChange={() => toggleTag(field, o.value)} className={`mt-0.5 ${accent}`} />
          <span className="leading-snug">{o.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Tipifica al cliente de la cita — se guarda automáticamente.</p>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          {saveState === "saving" ? <><Loader2 className="h-3 w-3 animate-spin" />Guardando…</>
            : saveState === "saved" ? <><Check className="h-3 w-3 text-emerald-600" />Guardado</> : null}
        </span>
      </div>

      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold">Datos demográficos y composición</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {sel("Tipo de asistente a cita", "tipo_asistente", TIPO_ASISTENTE)}
          {sel("Rango de edad principal", "rango_edad", RANGO_EDAD)}
        </div>
        {sel("Toma de decisión", "toma_decision", TOMA_DECISION)}
      </section>

      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold">Intención y madurez de compra</h3>
        {sel("Intención de uso", "intencion_uso", INTENCION_USO)}
        <div className="grid gap-3 sm:grid-cols-2">
          {sel("Experiencia previa en preventas", "experiencia_preventa", EXPERIENCIA_PREVENTA)}
          {sel("Etapa de exploración de mercado", "etapa_exploracion", ETAPA_EXPLORACION)}
        </div>
        <DField label="Competencia visitada">
          <Textarea value={form.competencia_visitada} onChange={(e) => set("competencia_visitada", e.target.value)}
            placeholder="Ej.: Visitó VEQ, Simona y desarrollos en Chapalita." rows={2} />
        </DField>
      </section>

      <section className="bg-card border border-border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold">Factores clave de la cita</h3>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />Puntos positivos
          </div>
          {tagGroup("puntos_positivos", PUNTOS_POSITIVOS, "data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500")}
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />Puntos negativos / fricciones
          </div>
          {tagGroup("puntos_negativos", PUNTOS_NEGATIVOS, "data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500")}
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold">Ventana temporal de decisión</h3>
        {sel("Proyección de cierre", "proyeccion_cierre", PROYECCION_CIERRE)}
      </section>
    </div>
  );
}

// Sección "Contactos" de la ficha del negocio (tabla estilo HubSpot).
export function DealContactsSection({ contacto }: { contacto: any | null }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Contactos</h3>
        <div className="flex items-center gap-3">
          <button onClick={() => toast.message("Asociar más contactos llegará en una fase posterior")} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" />Agregar
          </button>
          <button className="text-muted-foreground/70 hover:text-foreground transition-colors" title="Configurar columnas"><Settings2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar" className="pl-8 h-8 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><FilterIcon className="h-3.5 w-3.5" />Filtros</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><ChevronDown className="h-3.5 w-3.5" />Ordenar</Button>
      </div>
      {!contacto ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Sin contactos asociados</div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] uppercase tracking-wide">Nombre</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide">Correo</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide">Número de teléfono</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center">{dealInitials(contacto.nombre)}</span>
                    <Link to={`/admin/portal-crm/ventas/contactos/${contacto.id}`} className="text-sm text-primary hover:underline truncate">{contacto.nombre}</Link>
                  </div>
                </TableCell>
                <TableCell>{contacto.email ? <a href={`mailto:${contacto.email}`} className="text-sm text-primary hover:underline">{contacto.email}</a> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>
                <TableCell>{contacto.telefono ? <a href={`tel:${contacto.telefono}`} className="text-sm text-primary hover:underline whitespace-nowrap">{contacto.telefono}</a> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
