// Cluster de negocios (deals) del CRM: tarjeta en ficha de contacto, formularios de
// alta (nuevo/existente), diálogos de crear/editar, y piezas del tablero (columna,
// tarjeta arrastrable, menú de acciones). Extraído de crm.tsx. Consumido por
// CrmContactDetail, CrmDeals y CrmDealDetail (que se quedan y orquestan dnd-kit).

import { useState, useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Plus, Briefcase, Search, X, Loader2, MoreHorizontal, Pencil, Trash2,
  ChevronRight, ChevronLeft, GripVertical, Calendar, Settings2, ChevronDown,
  Filter as FilterIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { DField } from "@/components/admin/portal-crm/ui";
import { fmtMoneda, dealInitials, TIPO_NEGOCIO_OPTS, PRIORIDAD_META } from "@/lib/crm-format";
import { fmtMXN, fmtDate } from "@/lib/crm-lib";
import { fetchCrmOwners } from "@/hooks/useCrmCatalogos";
import { useCrmCanDelete } from "@/hooks/useCrmCanDelete";

// ─── (símbolos extraídos abajo; se les añade `export` automáticamente) ──────────
export function DealsCard({ contactId, deals, onSaved }: { contactId: string; deals: any[]; onSaved: () => void }) {
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
                <Link key={d.id} to={`/admin/portal-crm/ventas/negocios/${d.id}`}
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
export function NewDealDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
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
  const { data: contactResults = [], isFetching } = useQuery({
    queryKey: ["crm-deal-contact-search", contactSearch],
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

  const canSave = !!form.nombre.trim() && !!form.id_pipeline && !!form.id_etapa && !saving;
  const reset = () => { setForm(empty); setContact(null); setContactSearch(""); };

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
            <Label>Contacto asociado <span className="text-muted-foreground font-normal">(opcional)</span></Label>
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
  const canDelete = useCrmCanDelete("/admin/portal-crm/ventas/negocios");
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
        .select("id, nombre, orden").eq("id_pipeline", Number(form.id_pipeline)).eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });

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
    toast.success("Negocio actualizado");
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
export function DealBoardCard({ deal, dragging, onOpen, onEdit, onDelete }: { deal: any; dragging?: boolean; onOpen?: (id: number) => void; onEdit?: (d: any) => void; onDelete?: (d: any) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined;
  const prio = deal.prioridad && PRIORIDAD_META[deal.prioridad] ? deal.prioridad : null;
  const hasActions = !!(onOpen && onEdit && onDelete);
  return (
    <Card ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`cursor-grab active:cursor-grabbing border-border hover:shadow-md transition-shadow ${(isDragging || dragging) ? "opacity-60 shadow-lg" : ""}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 min-h-[18px]">
          {prio ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORIDAD_PILL[prio]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${PRIORIDAD_META[prio].dot}`} />{PRIORIDAD_META[prio].label}
            </span>
          ) : <span />}
          <div className="flex items-center gap-0.5 shrink-0">
            {hasActions && <DealActionsMenu deal={deal} onOpen={onOpen!} onEdit={onEdit!} onDelete={onDelete!} onBoard />}
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden="true" />
          </div>
        </div>
        {onOpen ? (
          <button onClick={(e) => { e.stopPropagation(); onOpen(deal.id); }}
            className="text-sm font-medium leading-snug text-left hover:text-primary hover:underline">
            {deal.nombre}
          </button>
        ) : (
          <p className="text-sm font-medium leading-snug">{deal.nombre}</p>
        )}
        {deal.contacto_nombre && (
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary text-[9px] font-semibold flex items-center justify-center">{dealInitials(deal.contacto_nombre)}</span>
            <span className="text-xs text-muted-foreground truncate">{deal.contacto_nombre}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-sm font-semibold tabular-nums">{deal.valor != null ? fmtMoneda(Number(deal.valor), deal.moneda) : "—"}</span>
          {deal.fecha_cierre_estimada && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />{fmtDate(deal.fecha_cierre_estimada)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
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
