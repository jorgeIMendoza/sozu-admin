import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowLeft, StickyNote, ClipboardList, CalendarClock, Briefcase,
  Mail, Phone, Save, GitBranch, Zap, TriangleAlert, Plus, Search,
  Filter as FilterIcon, RefreshCw, Copy, CheckCircle2, UserPlus,
  Bell, Sparkles, MessageSquare, X, ShieldAlert, PlayCircle, Pause,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmOrgId } from "@/hooks/useCrmOrgId";
import { PageHeader, EmptyState, ComingSoon } from "@/components/admin/portal-crm/ui";
import { LeadIntelligencePanel } from "@/components/admin/portal-crm/LeadIntelligencePanel";
import { RevenueIntelligencePanel } from "@/components/admin/portal-crm/RevenueIntelligencePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  leadStatusLabel, lifecycleLabel, leadScoreColor, relTime, fmtDate,
  fmtDateTime, fmtMXN, stageColor, DEAL_STAGES, apptStatusLabel,
  taskStatusLabel, TASK_STATUS, APPT_STATUS, type DealStage,
} from "@/lib/crm-lib";
import {
  computeLeadIntelligence, LEAD_LABEL_TONE, type AdvisorLoad, recommendOwner,
} from "@/lib/crm-lead-scoring";
import { aggregateAgentPerf, fmtNum, fmtPct } from "@/lib/crm-analytics";
import { type DateRange, RANGE_LABEL, rangeToSince } from "@/lib/crm-marketing";
import {
  calculateSlaStatus, getFollowUpPriority, SLA_TONE,
  generateMessage, SEQUENCES, DEFAULT_AUTOMATION_RULES,
} from "@/lib/crm-sales-ops";

// ─── Contacts list ────────────────────────────────────────────────────────────

type ContactRow = {
  id: string; full_name: string; email: string | null; phone: string | null;
  development_id: string | null; lead_status: string; lifecycle_stage: string;
  source_platform: string | null; source_name: string | null;
  contact_owner: string | null; last_activity_at: string | null;
  next_task_at: string | null; lead_score: number; created_at: string;
};

type View = "all" | "mine" | "unassigned" | "no_followup";

export function CrmContacts() {
  const orgId = useCrmOrgId();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterDev, setFilterDev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: developments } = useQuery({
    queryKey: ["proyectos-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("proyectos").select("id,nombre").eq("activo", true).order("nombre");
      return (data ?? []).map((p: any) => ({ id: String(p.id), name: p.nombre }));
    },
  });

  const { data: universe } = useQuery({
    queryKey: ["contact-universe", orgId], enabled: !!orgId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("contacts").select("source_platform, source_name").eq("organization_id", orgId!).limit(5000);
      const sp = new Set<string>(); const sn = new Set<string>();
      (data ?? []).forEach((r: any) => { if (r.source_platform) sp.add(r.source_platform); if (r.source_name) sn.add(r.source_name); });
      return { sources: Array.from(sp).sort(), campaigns: Array.from(sn).sort() };
    },
  });

  const { data: owners } = useQuery({
    queryKey: ["agentes-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("usuarios").select("auth_user_id,nombre,email").eq("activo", true).eq("rol_id", 3);
      return (data ?? []).map((u: any) => ({ id: u.auth_user_id, full_name: u.nombre, email: u.email })) as { id: string; full_name: string; email: string }[];
    },
  });

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts-sozu", view, search, filterOwner, filterDev, filterStatus, filterStage, page],
    queryFn: async () => {
      const tipoFilter = filterStage === "lead" ? [7] : filterStage === "customer" ? [2] : [2, 7];
      const proyectoId = filterDev !== "all" ? Number(filterDev) : null;

      // Search: resolve persona IDs first
      let searchPersonaIds: number[] | null = null;
      if (search) {
        const { data: matchPers } = await (supabase as any).from("personas")
          .select("id").eq("activo", true)
          .or(`nombre_legal.ilike.%${search}%,nombre_comercial.ilike.%${search}%,email.ilike.%${search}%,telefono.ilike.%${search}%`);
        searchPersonaIds = (matchPers ?? []).map((p: any) => p.id);
        if (searchPersonaIds!.length === 0) return { rows: [], count: 0 };
      }

      const buildQ = (sel: string, opts?: Record<string, unknown>) => {
        let q = (supabase as any).from("entidades_relacionadas").select(sel, opts ?? {});
        q = q.in("id_tipo_entidad", tipoFilter).eq("activo", true);
        if (proyectoId) q = q.eq("id_proyecto", proyectoId);
        if (searchPersonaIds) q = q.in("id_persona", searchPersonaIds);
        return q;
      };

      const [countRes, pageRes] = await Promise.all([
        buildQ("id", { count: "exact", head: true }),
        buildQ("id, id_persona, id_proyecto, id_tipo_entidad, fecha_creacion, fecha_actualizacion")
          .order("fecha_creacion", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1),
      ]);

      if (pageRes.error) throw pageRes.error;
      const ers: any[] = pageRes.data ?? [];
      if (!ers.length) return { rows: [], count: countRes.count ?? 0 };

      const { data: personas } = await (supabase as any).from("personas")
        .select("id, nombre_legal, nombre_comercial, email, telefono")
        .in("id", ers.map((e: any) => e.id_persona))
        .eq("activo", true);

      const pMap: Record<number, any> = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p]));

      const rows: ContactRow[] = ers
        .filter((e: any) => pMap[e.id_persona])
        .map((e: any) => {
          const p = pMap[e.id_persona];
          return {
            id: String(e.id),
            full_name: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
            email: p.email ?? null,
            phone: p.telefono ?? null,
            development_id: e.id_proyecto ? String(e.id_proyecto) : null,
            lead_status: "new" as const,
            lifecycle_stage: e.id_tipo_entidad === 2 ? "customer" : "lead",
            source_platform: null,
            source_name: null,
            contact_owner: null,
            last_activity_at: e.fecha_actualizacion ?? null,
            next_task_at: null,
            lead_score: 0,
            created_at: e.fecha_creacion ?? new Date().toISOString(),
          };
        });

      return { rows, count: countRes.count ?? 0 };
    },
  });

  const rows = contacts?.rows ?? [];
  const totalCount = contacts?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const sources = universe?.sources ?? [];
  const campaigns = universe?.campaigns ?? [];

  const devName = (id: string | null) => (developments as any[])?.find((d: any) => d.id === id)?.name ?? "—";
  const ownerLabel = (id: string | null) => {
    if (!id) return "Sin asignar";
    const o = (owners ?? []).find((x: any) => x.id === id);
    return (o as any)?.full_name ?? (o as any)?.email ?? "—";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Contactos" description="CRM · filtros, vistas y segmentación"
        actions={<CreateContactDialog orgId={orgId ?? undefined} developments={developments ?? []} onCreated={() => qc.invalidateQueries({ queryKey: ["contacts-sozu"] })} />}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="mine">Mis contactos</TabsTrigger>
          <TabsTrigger value="unassigned">Sin asignar</TabsTrigger>
          <TabsTrigger value="no_followup">Sin seguimiento</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, email o teléfono…" className="pl-8" />
        </div>
        <FilterIcon className="h-4 w-4 text-muted-foreground hidden md:block" />
        <CFilter value={filterOwner} onChange={setFilterOwner} placeholder="Propietario"
          options={[{ v: "all", l: "Todos los propietarios" }, { v: "none", l: "Sin asignar" }, ...(owners ?? []).map((o: any) => ({ v: o.id, l: o.full_name ?? o.email }))]} />
        <CFilter value={filterDev} onChange={setFilterDev} placeholder="Desarrollo"
          options={[{ v: "all", l: "Todos los desarrollos" }, ...(developments ?? []).map((d: any) => ({ v: d.id, l: d.name }))]} />
        <CFilter value={filterStatus} onChange={setFilterStatus} placeholder="Estado"
          options={[{ v: "all", l: "Estado: todos" }, ...Object.entries(leadStatusLabel).map(([v, l]) => ({ v, l }))]} />
        <CFilter value={filterStage} onChange={setFilterStage} placeholder="Etapa"
          options={[{ v: "all", l: "Lifecycle: todos" }, ...Object.entries(lifecycleLabel).map(([v, l]) => ({ v, l }))]} />
        <CFilter value={filterSource} onChange={setFilterSource} placeholder="Fuente"
          options={[{ v: "all", l: "Fuente: todas" }, ...sources.map((s: string) => ({ v: s, l: s }))]} />
        <CFilter value={filterCampaign} onChange={setFilterCampaign} placeholder="Campaña"
          options={[{ v: "all", l: "Campaña: todas" }, ...campaigns.map((s: string) => ({ v: s, l: s }))]} />
      </div>

      <div className="rounded-md border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !rows.length ? (
          <EmptyState title="No hay contactos" description="Ajusta los filtros o crea un contacto nuevo." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Desarrollo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Lifecycle</TableHead>
                <TableHead className="hidden xl:table-cell">Fuente</TableHead>
                <TableHead className="hidden xl:table-cell">Campaña</TableHead>
                <TableHead className="hidden lg:table-cell">Propietario</TableHead>
                <TableHead className="hidden md:table-cell">Última actividad</TableHead>
                <TableHead className="hidden lg:table-cell">Próxima tarea</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_12px_-12px_hsl(var(--foreground)/0.35)]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={(e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest('a,button,input,select,textarea,[role="menuitem"],[role="checkbox"],[role="combobox"]')) return;
                    navigate(`/admin/portal-crm/crm/contacts/${c.id}`);
                  }}
                >
                  <TableCell className="font-medium">
                    <Link to={`/admin/portal-crm/crm/contacts/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline underline-offset-2">{c.full_name}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{devName(c.development_id)}</TableCell>
                  <TableCell><Badge variant="outline">{leadStatusLabel[c.lead_status] ?? c.lead_status}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell">{lifecycleLabel[c.lifecycle_stage] ?? c.lifecycle_stage}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">{c.source_platform ?? "—"}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground truncate max-w-[160px]">{c.source_name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{ownerLabel(c.contact_owner)}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{relTime(c.last_activity_at ?? c.created_at)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{fmtDate(c.next_task_at)}</TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${leadScoreColor(c.lead_score)}`}>{c.lead_score}</span>
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_12px_-12px_hsl(var(--foreground)/0.35)]">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/portal-crm/crm/contacts/${c.id}`} onClick={(e) => e.stopPropagation()}>Abrir ficha</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{totalCount} contactos · página {page + 1} de {totalPages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
}

function CFilter({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string; options: { v: string; l: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px] h-9 text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function CreateContactDialog({ orgId, developments, onCreated }: { orgId?: string; developments: { id: string; name: string }[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", development_id: "", source_platform: "manual", source_name: "Manual", lifecycle_stage: "lead", lead_status: "new" });

  const submit = async () => {
    if (!orgId || !form.full_name) return;
    setBusy(true);
    const { error } = await (supabase as any).from("contacts").insert({
      organization_id: orgId,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      normalized_email: form.email ? form.email.toLowerCase().trim() : null,
      normalized_phone: form.phone ? form.phone.replace(/\D/g, "") : null,
      development_id: form.development_id || null,
      source_platform: form.source_platform,
      source_name: form.source_name,
      lifecycle_stage: form.lifecycle_stage,
      lead_status: form.lead_status,
      contact_owner: user?.id ?? null,
      consent_status: "unknown",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contacto creado");
    setOpen(false);
    setForm({ ...form, full_name: "", email: "", phone: "" });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo contacto</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear contacto</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <CField label="Nombre completo *"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></CField>
          <div className="grid grid-cols-2 gap-3">
            <CField label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></CField>
            <CField label="Teléfono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></CField>
          </div>
          <CField label="Desarrollo">
            <Select value={form.development_id} onValueChange={(v) => setForm({ ...form, development_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>{developments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </CField>
          <div className="grid grid-cols-2 gap-3">
            <CField label="Lead status">
              <Select value={form.lead_status} onValueChange={(v) => setForm({ ...form, lead_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(leadStatusLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </CField>
            <CField label="Lifecycle">
              <Select value={form.lifecycle_stage} onValueChange={(v) => setForm({ ...form, lifecycle_stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(lifecycleLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </CField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !form.full_name}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

// ─── Contact detail ───────────────────────────────────────────────────────────

export function CrmContactDetail() {
  const { contactId } = useParams<{ contactId: string }>();
  const orgId = useCrmOrgId();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: contact, isLoading, error: contactError } = useQuery({
    queryKey: ["contact-sozu", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data: er } = await (supabase as any).from("entidades_relacionadas")
        .select("id, id_persona, id_proyecto, id_tipo_entidad, fecha_creacion, fecha_actualizacion")
        .eq("id", Number(contactId)).maybeSingle();
      if (!er) return null;
      const { data: p } = await (supabase as any).from("personas")
        .select("id, nombre_legal, nombre_comercial, email, telefono")
        .eq("id", er.id_persona).maybeSingle();
      if (!p) return null;
      return {
        id: String(er.id),
        full_name: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
        email: p.email ?? null,
        phone: p.telefono ?? null,
        development_id: er.id_proyecto ? String(er.id_proyecto) : null,
        lead_status: "new",
        lifecycle_stage: er.id_tipo_entidad === 2 ? "customer" : "lead",
        source_platform: null, source_name: null, contact_owner: null,
        last_activity_at: er.fecha_actualizacion ?? null,
        next_task_at: null, lead_score: 0,
        created_at: er.fecha_creacion ?? new Date().toISOString(),
        buying_intent: null, score: null,
      };
    },
  });

  const { data: attribution } = useQuery({
    queryKey: ["contact-attribution", contactId],
    queryFn: async () => (await (supabase as any).from("contact_attribution").select("*").eq("contact_id", contactId).maybeSingle()).data,
  });

  const { data: developments } = useQuery({
    queryKey: ["proyectos-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("proyectos").select("id,nombre").eq("activo", true).order("nombre");
      return (data ?? []).map((p: any) => ({ id: String(p.id), name: p.nombre }));
    },
  });

  const { data: owners } = useQuery({
    queryKey: ["agentes-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("usuarios").select("auth_user_id,nombre,email").eq("activo", true).eq("rol_id", 3);
      return (data ?? []).map((u: any) => ({ id: u.auth_user_id, full_name: u.nombre, email: u.email })) as { id: string; full_name: string; email: string }[];
    },
  });

  const { data: notes } = useQuery({
    queryKey: ["contact-notes", contactId],
    queryFn: async () => (await (supabase as any).from("notes").select("*").eq("contact_id", contactId).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: tasks } = useQuery({
    queryKey: ["contact-tasks", contactId],
    queryFn: async () => (await (supabase as any).from("tasks").select("*").eq("contact_id", contactId).order("due_date", { ascending: true })).data ?? [],
  });

  const { data: appointments } = useQuery({
    queryKey: ["contact-appts", contactId],
    queryFn: async () => (await (supabase as any).from("appointments").select("*").eq("contact_id", contactId).order("scheduled_at", { ascending: false })).data ?? [],
  });

  const { data: deals } = useQuery({
    queryKey: ["contact-deals", contactId],
    queryFn: async () => (await (supabase as any).from("deals").select("*").eq("contact_id", contactId).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: pipelineEvents } = useQuery({
    queryKey: ["contact-pipeline", contactId],
    queryFn: async () => (await (supabase as any).from("pipeline_events").select("*").eq("contact_id", contactId).order("changed_at", { ascending: false })).data ?? [],
  });

  const { data: conversionEvents } = useQuery({
    queryKey: ["contact-conv", contactId],
    queryFn: async () => (await (supabase as any).from("conversion_events").select("*").eq("contact_id", contactId).order("event_time", { ascending: false })).data ?? [],
  });

  const invalidateAll = () => {
    ["contact", "contact-notes", "contact-tasks", "contact-appts", "contact-deals", "contact-pipeline", "contact-conv"].forEach(
      (k) => qc.invalidateQueries({ queryKey: [k, contactId] }),
    );
  };

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;

  if (contactError) {
    const msg = (contactError as any).message?.toLowerCase() ?? "";
    const isPerm = msg.includes("permission") || msg.includes("forbidden") || msg.includes("rls") || msg.includes("not allowed");
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TriangleAlert className="h-4 w-4" />{isPerm ? "Sin permiso para ver este contacto" : "Error cargando contacto"}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{isPerm ? "Tu usuario no tiene acceso a esta ficha." : "Ocurrió un problema al cargar la ficha."}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/admin/portal-crm/crm/contacts"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link></Button>
            <Button size="sm" onClick={invalidateAll}>Reintentar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!contact) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Contacto no encontrado</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Este contacto no existe o no pertenece a tu organización.</p>
          <Button variant="outline" size="sm" asChild><Link to="/admin/portal-crm/crm/contacts"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild><Link to="/admin/portal-crm/crm/contacts"><ArrowLeft className="h-4 w-4 mr-1" />Contactos</Link></Button>
          <h1 className="text-xl font-semibold">{contact.full_name}</h1>
          <Badge variant="outline">{leadStatusLabel[contact.lead_status] ?? contact.lead_status}</Badge>
          <Badge variant="secondary">{lifecycleLabel[contact.lifecycle_stage] ?? contact.lifecycle_stage}</Badge>
        </div>
        <div className="flex gap-2">
          <NoteDialog contactId={contactId!} userId={user?.id} onSaved={invalidateAll} />
          <TaskDialog contactId={contactId!} orgId={orgId} owners={owners ?? []} onSaved={invalidateAll} />
          <AppointmentDialog contactId={contactId!} orgId={orgId} developmentId={contact.development_id} owners={owners ?? []} onSaved={invalidateAll} />
          <DealDialog contactId={contactId!} orgId={orgId} developmentId={contact.development_id} onSaved={invalidateAll} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3 space-y-4">
          <LeftPanel contact={contact} developments={developments ?? []} owners={owners ?? []} onSaved={invalidateAll} />
        </div>

        <div className="lg:col-span-6">
          <Timeline
            notes={notes ?? []} tasks={tasks ?? []} appointments={appointments ?? []}
            deals={deals ?? []} pipelineEvents={pipelineEvents ?? []} conversionEvents={conversionEvents ?? []}
          />
        </div>

        <div className="lg:col-span-3 space-y-4">
          <LeadIntelligencePanel
            contact={contact} attribution={attribution}
            notes={notes ?? []} tasks={tasks ?? []} appointments={appointments ?? []}
            deals={deals ?? []} conversionEvents={conversionEvents ?? []}
          />
          <RevenueIntelligencePanel deals={deals ?? []} attribution={attribution} />
          <RightPanel
            deals={deals ?? []} appointments={appointments ?? []}
            conversionEvents={conversionEvents ?? []} attribution={attribution} contact={contact}
          />
        </div>
      </div>
    </div>
  );
}

function LeftPanel({ contact, developments, owners, onSaved }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: contact.full_name, email: contact.email ?? "", phone: contact.phone ?? "",
    lead_status: contact.lead_status, lifecycle_stage: contact.lifecycle_stage,
    development_id: contact.development_id ?? "", contact_owner: contact.contact_owner ?? "",
  });

  const save = async () => {
    const { error } = await (supabase as any).from("contacts").update({
      full_name: form.full_name, email: form.email || null, phone: form.phone || null,
      lead_status: form.lead_status, lifecycle_stage: form.lifecycle_stage,
      development_id: form.development_id || null, contact_owner: form.contact_owner || null,
      last_activity_at: new Date().toISOString(),
    }).eq("id", contact.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contacto actualizado"); setEditing(false); onSaved();
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Información</CardTitle>
        {editing ? <Button size="sm" onClick={save}><Save className="h-3 w-3 mr-1" />Guardar</Button>
          : <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-3 rounded-md border p-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
            {contact.full_name.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p[0]).join("") || "—"}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{contact.full_name}</div>
            <div className="truncate text-xs text-muted-foreground">{contact.email ?? contact.phone ?? "Sin dato"}</div>
          </div>
        </div>
        <DField label="Nombre">{editing ? <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /> : <div>{contact.full_name}</div>}</DField>
        <DField label="Email">{editing ? <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /> : <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{contact.email ?? "—"}</div>}</DField>
        <DField label="Teléfono">{editing ? <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /> : <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{contact.phone ?? "—"}</div>}</DField>
        <DField label="Lead status">
          {editing ? <Select value={form.lead_status} onValueChange={(v) => setForm({ ...form, lead_status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(leadStatusLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
            : <Badge variant="outline">{leadStatusLabel[contact.lead_status]}</Badge>}
        </DField>
        <DField label="Lifecycle">
          {editing ? <Select value={form.lifecycle_stage} onValueChange={(v) => setForm({ ...form, lifecycle_stage: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(lifecycleLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
            : <Badge variant="secondary">{lifecycleLabel[contact.lifecycle_stage]}</Badge>}
        </DField>
        <DField label="Desarrollo">
          {editing ? <Select value={form.development_id} onValueChange={(v) => setForm({ ...form, development_id: v })}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{(developments as any[]).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
            : <div>{(developments as any[]).find((d: any) => d.id === contact.development_id)?.name ?? "—"}</div>}
        </DField>
        <DField label="Propietario">
          {editing ? <Select value={form.contact_owner} onValueChange={(v) => setForm({ ...form, contact_owner: v })}><SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger><SelectContent>{(owners as any[]).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent></Select>
            : <div>{(owners as any[]).find((o: any) => o.id === contact.contact_owner)?.full_name ?? "Sin asignar"}</div>}
        </DField>
        <DField label="Fuente · Campaña"><div className="text-muted-foreground">{contact.source_platform ?? "—"} · {contact.source_name ?? "—"}</div></DField>
        <DField label="Lead score"><span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${leadScoreColor(contact.lead_score)}`}>{contact.lead_score} pts</span></DField>
      </CardContent>
    </Card>
  );
}

function DField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1"><Label className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</Label><div>{children}</div></div>;
}

type TLItem = { id: string; ts: string; kind: string; title: string; subtitle?: string; icon: any; tone?: string };

function Timeline({ notes, tasks, appointments, deals, pipelineEvents, conversionEvents }: any) {
  const items: TLItem[] = [
    ...notes.map((n: any) => ({ id: `n-${n.id}`, ts: n.created_at, kind: "Nota", title: n.content.slice(0, 120), icon: StickyNote, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" })),
    ...tasks.map((t: any) => ({ id: `t-${t.id}`, ts: t.due_date ? `${t.due_date}T${t.due_time ?? "09:00:00"}` : t.created_at, kind: `Tarea · ${t.status}`, title: t.title, subtitle: t.due_date ? `Vence ${fmtDate(t.due_date)}` : undefined, icon: ClipboardList, tone: "bg-blue-500/15 text-blue-700 dark:text-blue-400" })),
    ...appointments.map((a: any) => ({ id: `a-${a.id}`, ts: a.scheduled_at, kind: `Cita · ${apptStatusLabel[a.status] ?? a.status}`, title: a.appointment_type, subtitle: fmtDateTime(a.scheduled_at), icon: CalendarClock, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-400" })),
    ...deals.map((d: any) => ({ id: `d-${d.id}`, ts: d.created_at, kind: `Deal · ${DEAL_STAGES.find((s) => s.id === d.deal_stage)?.label ?? d.deal_stage}`, title: d.deal_name, subtitle: d.value ? fmtMXN(Number(d.value)) : undefined, icon: Briefcase, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400" })),
    ...pipelineEvents.map((p: any) => ({ id: `p-${p.id}`, ts: p.changed_at, kind: "Pipeline", title: `${p.old_stage ?? "—"} → ${p.new_stage}`, icon: GitBranch, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" })),
    ...conversionEvents.map((c: any) => ({ id: `c-${c.id}`, ts: c.event_time, kind: "Conv event", title: c.event_name, subtitle: `Meta: ${c.meta_status} · Google: ${c.google_status}`, icon: Zap, tone: "bg-pink-500/15 text-pink-700 dark:text-pink-400" })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
      <CardContent>
        {!items.length ? <p className="text-sm text-muted-foreground">Sin actividad todavía.</p> : (
          <div className="space-y-4">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <div key={it.id} className="flex gap-3">
                  <div className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${it.tone ?? "bg-muted"}`}><Icon className="h-3.5 w-3.5" /></div>
                  <div className="flex-1 min-w-0 border-b pb-3">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">{it.kind}</span>
                      <span className="text-xs text-muted-foreground">{relTime(it.ts)}</span>
                    </div>
                    <div className="text-sm mt-0.5">{it.title}</div>
                    {it.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{it.subtitle}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RightPanel({ deals, appointments, conversionEvents, attribution, contact }: any) {
  const qc = useQueryClient();
  const updateApptStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("appointments").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cita actualizada");
    qc.invalidateQueries({ queryKey: ["contact-appts", contact?.id] });
  };
  return (
    <>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Briefcase className="h-4 w-4" />Deals ({deals.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!deals.length && <p className="text-xs text-muted-foreground">Sin deals.</p>}
          {deals.map((d: any) => (
            <div key={d.id} className="text-sm border rounded p-2">
              <div className="font-medium truncate">{d.deal_name}</div>
              <div className="flex justify-between items-center mt-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${stageColor(d.deal_stage)}`}>{DEAL_STAGES.find((s) => s.id === d.deal_stage)?.label ?? d.deal_stage}</span>
                <span className="text-xs text-muted-foreground">{d.value ? fmtMXN(Number(d.value)) : "—"}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><CalendarClock className="h-4 w-4" />Citas ({appointments.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!appointments.length && <p className="text-xs text-muted-foreground">Sin citas.</p>}
          {appointments.slice(0, 5).map((a: any) => (
            <div key={a.id} className="text-sm border rounded p-2">
              <div className="font-medium">{a.appointment_type}</div>
              <div className="text-xs text-muted-foreground">{fmtDateTime(a.scheduled_at)}</div>
              <Select value={a.status} onValueChange={(v) => updateApptStatus(a.id, v)}>
                <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(apptStatusLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l as string}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Zap className="h-4 w-4" />Conv events ({conversionEvents.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {!conversionEvents.length && <p className="text-xs text-muted-foreground">Sin eventos.</p>}
          {conversionEvents.slice(0, 6).map((c: any) => (
            <div key={c.id} className="text-xs flex justify-between border-b pb-1.5 last:border-0">
              <span>{c.event_name}</span><span className="text-muted-foreground">{relTime(c.event_time)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Atribución</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs">
          {!attribution && <p className="text-muted-foreground">Sin datos de atribución.</p>}
          {attribution && <>
            <ARow label="UTM source" v={attribution.first_touch_source ?? contact?.source_platform} />
            <ARow label="UTM medium" v={attribution.first_touch_medium} />
            <ARow label="UTM campaign" v={attribution.first_touch_campaign ?? contact?.source_name} />
            <ARow label="fbclid" v={attribution.fbclid} mono />
            <ARow label="gclid" v={attribution.gclid} mono />
            <ARow label="Landing" v={attribution.landing_page} mono />
          </>}
        </CardContent>
      </Card>
    </>
  );
}

function ARow({ label, v, mono }: { label: string; v?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`truncate max-w-[140px] ${mono ? "font-mono" : ""}`}>{v ?? "—"}</span>
    </div>
  );
}

function NoteDialog({ contactId, userId, onSaved }: { contactId: string; userId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const save = async () => {
    if (!userId || !content.trim()) return;
    const { error } = await (supabase as any).from("notes").insert({ contact_id: contactId, user_id: userId, content });
    if (error) { toast.error(error.message); return; }
    await (supabase as any).from("contacts").update({ last_activity_at: new Date().toISOString() }).eq("id", contactId);
    toast.success("Nota guardada"); setOpen(false); setContent(""); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><StickyNote className="h-4 w-4 mr-1" />Nota</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva nota</DialogTitle></DialogHeader>
        <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escribe la nota…" />
        <DialogFooter><Button onClick={save} disabled={!content.trim()}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ contactId, orgId, owners, onSaved }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", task_type: "follow_up", due_date: "", priority: "normal", assigned_to: user?.id ?? "" });
  const save = async () => {
    if (!orgId || !form.title) return;
    const { error } = await (supabase as any).from("tasks").insert({
      organization_id: orgId, contact_id: contactId, title: form.title,
      task_type: form.task_type, priority: form.priority,
      due_date: form.due_date || null, assigned_to: form.assigned_to || null,
    });
    if (error) { toast.error(error.message); return; }
    if (form.due_date) await (supabase as any).from("contacts").update({ next_task_at: form.due_date }).eq("id", contactId);
    toast.success("Tarea creada"); setOpen(false); setForm({ ...form, title: "" }); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><ClipboardList className="h-4 w-4 mr-1" />Tarea</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva tarea</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <DField label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></DField>
          <div className="grid grid-cols-2 gap-3">
            <DField label="Tipo">
              <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Seguimiento</SelectItem>
                  <SelectItem value="call">Llamada</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="visit">Visita</SelectItem>
                </SelectContent>
              </Select>
            </DField>
            <DField label="Prioridad">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </DField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DField label="Fecha"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></DField>
            <DField label="Asignar a">
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{(owners as any[]).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
              </Select>
            </DField>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={!form.title}>Crear</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentDialog({ contactId, orgId, developmentId, owners, onSaved }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ appointment_type: "call", scheduled_at: "", assigned_to: user?.id ?? "" });
  const save = async () => {
    if (!orgId || !form.scheduled_at) return;
    const { error } = await (supabase as any).from("appointments").insert({
      organization_id: orgId, contact_id: contactId, development_id: developmentId,
      appointment_type: form.appointment_type, scheduled_at: new Date(form.scheduled_at).toISOString(),
      assigned_to: form.assigned_to || null, status: "scheduled",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cita creada"); setOpen(false); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><CalendarClock className="h-4 w-4 mr-1" />Cita</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva cita</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <DField label="Tipo">
            <Select value={form.appointment_type} onValueChange={(v) => setForm({ ...form, appointment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Llamada</SelectItem>
                <SelectItem value="video">Videollamada</SelectItem>
                <SelectItem value="showroom">Showroom</SelectItem>
                <SelectItem value="site_visit">Visita en obra</SelectItem>
              </SelectContent>
            </Select>
          </DField>
          <DField label="Fecha y hora"><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></DField>
          <DField label="Asesor">
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(owners as any[]).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
            </Select>
          </DField>
        </div>
        <DialogFooter><Button onClick={save} disabled={!form.scheduled_at}>Crear</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealDialog({ contactId, orgId, developmentId, onSaved }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ deal_name: "", value: "", deal_stage: "new" });
  const save = async () => {
    if (!orgId || !form.deal_name) return;
    const { error } = await (supabase as any).from("deals").insert({
      organization_id: orgId, contact_id: contactId, development_id: developmentId,
      deal_name: form.deal_name, value: form.value ? Number(form.value) : null,
      deal_stage: form.deal_stage, pipeline: "sales", currency: "MXN",
      deal_owner: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Deal creado"); setOpen(false); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Briefcase className="h-4 w-4 mr-1" />Deal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo deal</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <DField label="Nombre *"><Input value={form.deal_name} onChange={(e) => setForm({ ...form, deal_name: e.target.value })} /></DField>
          <div className="grid grid-cols-2 gap-3">
            <DField label="Valor (MXN)"><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></DField>
            <DField label="Etapa">
              <Select value={form.deal_stage} onValueChange={(v) => setForm({ ...form, deal_stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEAL_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </DField>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={!form.deal_name}>Crear</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Deals Kanban ─────────────────────────────────────────────────────────────

type KanbanDeal = {
  id: string; deal_name: string; deal_stage: DealStage;
  value: number | null; currency: string;
  contact_id: string | null; development_id: string | null;
  contact?: { id: string; full_name: string } | null;
  development?: { id: string; name: string } | null;
};

export function CrmDeals() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();
  const [devFilter, setDevFilter] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: developments } = useQuery({
    queryKey: ["proyectos-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("proyectos").select("id,nombre").eq("activo", true).order("nombre");
      return (data ?? []).map((p: any) => ({ id: String(p.id), name: p.nombre }));
    },
  });

  const { data: deals, isLoading } = useQuery({
    queryKey: ["deals-kanban", orgId, devFilter], enabled: !!orgId,
    queryFn: async () => {
      let q = (supabase as any).from("deals")
        .select("id, deal_name, deal_stage, value, currency, contact_id, development_id, contact:contacts(id, full_name), development:developments(id, name)")
        .eq("organization_id", orgId!).order("created_at", { ascending: false }).limit(500);
      if (devFilter !== "all") q = q.eq("development_id", devFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as KanbanDeal[];
    },
  });

  const byStage = useMemo(() => {
    const map: Record<string, KanbanDeal[]> = {};
    DEAL_STAGES.forEach((s) => (map[s.id] = []));
    (deals ?? []).forEach((d) => { (map[d.deal_stage] ??= []).push(d); });
    return map;
  }, [deals]);

  const stageTotals = useMemo(() => {
    const t: Record<string, number> = {};
    DEAL_STAGES.forEach((s) => { t[s.id] = (byStage[s.id] ?? []).reduce((sum, d) => sum + Number(d.value ?? 0), 0); });
    return t;
  }, [byStage]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const dealId = String(e.active.id);
    const targetStage = e.over?.id ? String(e.over.id) : null;
    if (!targetStage) return;
    const deal = deals?.find((d) => d.id === dealId);
    if (!deal || deal.deal_stage === targetStage) return;

    qc.setQueryData<KanbanDeal[]>(["deals-kanban", orgId, devFilter],
      (old) => (old ?? []).map((d) => d.id === dealId ? { ...d, deal_stage: targetStage as DealStage } : d),
    );

    const patch: any = { deal_stage: targetStage };
    if (targetStage === "won") patch.won_at = new Date().toISOString();
    if (targetStage === "lost") patch.lost_at = new Date().toISOString();
    if (targetStage === "reservation") patch.reservation_date = new Date().toISOString().slice(0, 10);
    if (targetStage === "contract") patch.contract_date = new Date().toISOString().slice(0, 10);
    if (targetStage === "down_payment") patch.down_payment_date = new Date().toISOString().slice(0, 10);

    const { error } = await (supabase as any).from("deals").update(patch).eq("id", dealId);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["deals-kanban"] }); return; }
    toast.success(`Movido a ${DEAL_STAGES.find((s) => s.id === targetStage)?.label}`);
    qc.invalidateQueries({ queryKey: ["deals-kanban"] });
    qc.invalidateQueries({ queryKey: ["contact-pipeline", deal.contact_id] });
    qc.invalidateQueries({ queryKey: ["contact-conv", deal.contact_id] });
  };

  const activeDeal = deals?.find((d) => d.id === activeId);

  return (
    <div className="space-y-4">
      <PageHeader title="Pipeline Kanban"
        description="Arrastra deals entre etapas · cada cambio dispara pipeline_event + conversion_event"
        actions={
          <Select value={devFilter} onValueChange={setDevFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todos los desarrollos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los desarrollos</SelectItem>
              {(developments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {DEAL_STAGES.map((s) => (
              <KanbanColumn key={s.id} id={s.id} label={s.label} deals={byStage[s.id] ?? []} total={stageTotals[s.id] ?? 0} />
            ))}
          </div>
          <DragOverlay>{activeDeal && <DealCard deal={activeDeal} dragging />}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function KanbanColumn({ id, label, deals, total }: { id: string; label: string; deals: KanbanDeal[]; total: number }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`w-72 shrink-0 rounded-md border bg-muted/30 p-2 ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${stageColor(id)}`}>{label}</span>
          <span className="text-xs text-muted-foreground">{deals.length}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{fmtMXN(total)}</span>
      </div>
      <div className="space-y-2 min-h-[80px]">
        {deals.map((d) => <DealCard key={d.id} deal={d} />)}
        {!deals.length && <div className="text-[11px] text-muted-foreground p-3 text-center">Sin deals</div>}
      </div>
    </div>
  );
}

function DealCard({ deal, dragging }: { deal: KanbanDeal; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined;
  return (
    <Card ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`p-2.5 cursor-grab active:cursor-grabbing ${(isDragging || dragging) ? "opacity-60 shadow-lg" : ""}`}
    >
      <div className="text-sm font-medium truncate">{deal.deal_name}</div>
      <div className="text-xs text-muted-foreground truncate mt-0.5">
        {deal.contact ? (
          <Link to={`/admin/portal-crm/crm/contacts/${deal.contact.id}`} className="hover:underline" onPointerDown={(e) => e.stopPropagation()}>
            {deal.contact.full_name}
          </Link>
        ) : "Sin contacto"}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <Badge variant="outline" className="text-[10px] truncate max-w-[120px]">{deal.development?.name ?? "—"}</Badge>
        <span className="text-xs font-medium">{deal.value ? fmtMXN(Number(deal.value)) : "—"}</span>
      </div>
    </Card>
  );
}

// ─── CrmAppointments ──────────────────────────────────────────────────────────

export function CrmAppointments() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "today" | "past" | "all">("upcoming");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ contact_id: "", scheduled_at: "", title: "", notes: "" });

  const { data: appts = [], isLoading } = useQuery({
    queryKey: ["crm-appts", orgId, tab],
    queryFn: async () => {
      if (!orgId) return [];
      const now = new Date().toISOString();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      let q = (supabase as any).from("crm_appointments").select("id,title,scheduled_at,status,notes,contacts(full_name)").eq("organization_id", orgId).order("scheduled_at", { ascending: tab !== "past" });
      if (tab === "upcoming") q = q.gt("scheduled_at", now);
      if (tab === "today") q = q.gte("scheduled_at", today.toISOString()).lte("scheduled_at", todayEnd.toISOString());
      if (tab === "past") q = q.lt("scheduled_at", now);
      const { data } = await q.limit(50);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await (supabase as any).from("crm_appointments").update({ status }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-appts", orgId] }),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      await (supabase as any).from("crm_appointments").insert({ organization_id: orgId, ...form });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-appts", orgId] }); setOpen(false); setForm({ contact_id: "", scheduled_at: "", title: "", notes: "" }); toast.success("Cita creada"); },
  });

  const TABS = [
    { id: "upcoming", label: "Próximas" },
    { id: "today", label: "Hoy" },
    { id: "past", label: "Pasadas" },
    { id: "all", label: "Todas" },
  ] as const;

  return (
    <div className="space-y-4">
      <PageHeader title="Citas" subtitle="Gestión de citas con prospectos">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nueva cita</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva cita</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label>ID Contacto</Label><Input value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))} placeholder="UUID del contacto" /></div>
              <div><Label>Título</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Visita al desarrollo" /></div>
              <div><Label>Fecha y hora</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList>{TABS.map(t => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>
        {TABS.map(t => (
          <TabsContent key={t.id} value={t.id}>
            {isLoading ? <Skeleton className="h-40 w-full mt-2" /> : appts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sin citas</p>
            ) : (
              <div className="rounded-md border overflow-auto mt-2">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estatus</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {appts.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.title ?? "—"}</TableCell>
                        <TableCell>{a.contacts?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDateTime(a.scheduled_at)}</TableCell>
                        <TableCell>
                          <Select value={a.status ?? "scheduled"} onValueChange={s => updateStatus.mutate({ id: a.id, status: s })}>
                            <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>{APPT_STATUS.map(s => <SelectItem key={s} value={s}>{apptStatusLabel[s] ?? s}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─── CrmTasks ─────────────────────────────────────────────────────────────────

export function CrmTasks() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"mine" | "all" | "overdue">("mine");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ contact_id: "", title: "", due_date: "", assigned_to: user?.id ?? "", priority: "normal" });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["crm-tasks", orgId, tab],
    queryFn: async () => {
      if (!orgId) return [];
      const now = new Date().toISOString();
      let q = (supabase as any).from("crm_tasks").select("id,title,status,priority,due_date,assigned_to,contacts(full_name)").eq("organization_id", orgId).order("due_date", { ascending: true });
      if (tab === "mine") q = q.eq("assigned_to", user?.id ?? "");
      if (tab === "overdue") q = q.lt("due_date", now).neq("status", "completed");
      const { data } = await q.limit(100);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const complete = useMutation({
    mutationFn: async (id: string) => { await (supabase as any).from("crm_tasks").update({ status: "completed" }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks", orgId] }),
  });

  const create = useMutation({
    mutationFn: async () => { if (!orgId) return; await (supabase as any).from("crm_tasks").insert({ organization_id: orgId, ...form }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-tasks", orgId] }); setOpen(false); toast.success("Tarea creada"); },
  });

  const PRIORITY_TONE: Record<string, string> = {
    urgent: "bg-red-500/15 text-red-700 dark:text-red-400",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    normal: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    low: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Tareas" subtitle="Bandeja de tareas del equipo">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nueva tarea</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva tarea</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label>Título</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Llamar al prospecto" /></div>
              <div><Label>ID Contacto</Label><Input value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))} placeholder="UUID" /></div>
              <div><Label>Vencimiento</Label><Input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              <div><Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["urgent","high","normal","low"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="mine">Mis tareas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="overdue">Vencidas</TabsTrigger>
        </TabsList>
        {(["mine","all","overdue"] as const).map(t => (
          <TabsContent key={t} value={t}>
            {isLoading ? <Skeleton className="h-40 w-full mt-2" /> : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sin tareas</p>
            ) : (
              <div className="rounded-md border overflow-auto mt-2">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Tarea</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estatus</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {tasks.map((tk: any) => (
                      <TableRow key={tk.id} className={tk.status === "completed" ? "opacity-50" : ""}>
                        <TableCell>
                          <button onClick={() => complete.mutate(tk.id)} disabled={tk.status === "completed"} className="rounded-full p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors">
                            <CheckCircle2 className={`w-4 h-4 ${tk.status === "completed" ? "text-emerald-500" : "text-muted-foreground"}`} />
                          </button>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{tk.title}</TableCell>
                        <TableCell className="text-sm">{tk.contacts?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(tk.due_date)}</TableCell>
                        <TableCell><Badge className={`text-xs ${PRIORITY_TONE[tk.priority ?? "normal"]}`}>{tk.priority ?? "normal"}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{taskStatusLabel[tk.status] ?? tk.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─── CrmSequences ─────────────────────────────────────────────────────────────

export function CrmSequences() {
  const [activeSeq, setActiveSeq] = useState(SEQUENCES[0].id);
  const seq = SEQUENCES.find(s => s.id === activeSeq) ?? SEQUENCES[0];

  const CHANNEL_ICON: Record<string, React.ReactNode> = {
    call: <Phone className="w-3.5 h-3.5 text-blue-500" />,
    whatsapp_mock: <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />,
    email_mock: <Mail className="w-3.5 h-3.5 text-violet-500" />,
    task: <ClipboardList className="w-3.5 h-3.5 text-amber-500" />,
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Secuencias" subtitle="Cadencias de seguimiento por stage del lead" />
      <div className="flex gap-4">
        <div className="w-52 shrink-0 space-y-1">
          {SEQUENCES.map(s => (
            <button key={s.id} onClick={() => setActiveSeq(s.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeSeq === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <div className="font-medium truncate">{s.name}</div>
              <div className="text-[11px] opacity-70 truncate">{s.stage}</div>
            </button>
          ))}
        </div>
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{seq.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{seq.objective}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {seq.steps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-muted/40 border">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background border text-[11px] font-semibold shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {CHANNEL_ICON[step.channel]}
                      <span className="text-xs font-medium capitalize">{step.channel.replace("_mock","").replace("_"," ")}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{step.timing}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.copy}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 italic">Objetivo: {step.objective}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(step.copy); toast.success("Copiado"); }}
                    className="shrink-0 p-1 hover:bg-background rounded transition-colors">
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── CrmRouting ───────────────────────────────────────────────────────────────

export function CrmRouting() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();

  const { data: unassigned = [], isLoading } = useQuery({
    queryKey: ["crm-unassigned", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_contacts")
        .select("id,full_name,lead_status,source_name,created_at").eq("organization_id", orgId)
        .is("contact_owner", null).order("created_at", { ascending: true }).limit(50);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const MOCK_ADVISORS: AdvisorLoad[] = [
    { user_id: "a1", name: "Ana García", active_leads: 12, pending_tasks: 3, lead_to_appt_rate: 0.32, appt_to_reservation_rate: 0.21 },
    { user_id: "a2", name: "Carlos López", active_leads: 8, pending_tasks: 1, lead_to_appt_rate: 0.41, appt_to_reservation_rate: 0.18 },
    { user_id: "a3", name: "María Torres", active_leads: 19, pending_tasks: 7, lead_to_appt_rate: 0.28, appt_to_reservation_rate: 0.25 },
  ];

  const assign = useMutation({
    mutationFn: async ({ contactId, advisorId }: { contactId: string; advisorId: string }) => {
      await (supabase as any).from("crm_contacts").update({ contact_owner: advisorId }).eq("id", contactId);
      await (supabase as any).from("lead_assignment_history").insert({ contact_id: contactId, assigned_to: advisorId, organization_id: orgId, reason: "manual_routing" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-unassigned", orgId] }); toast.success("Lead asignado"); },
  });

  const [overrides, setOverrides] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <PageHeader title="Routing" subtitle="Asignación de leads no asignados a asesores" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MOCK_ADVISORS.map(a => (
          <Card key={a.user_id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">{a.name[0]}</div>
              <div><p className="text-sm font-medium">{a.name}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Leads activos</span><span className="text-right font-medium text-foreground">{a.active_leads}</span>
              <span>Lead→Cita</span><span className="text-right font-medium text-foreground">{fmtPct(a.lead_to_appt_rate)}</span>
              <span>Cita→Apart.</span><span className="text-right font-medium text-foreground">{fmtPct(a.appt_to_reservation_rate)}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Contacto</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead>Fuente</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead>Recomendado</TableHead>
            <TableHead>Asignar a</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : unassigned.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin leads sin asignar</TableCell></TableRow>
            ) : unassigned.map((c: any) => {
              const rec = recommendOwner(c, MOCK_ADVISORS);
              const selectedAdvisor = overrides[c.id] ?? rec?.recommended_owner_id ?? "";
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{leadStatusLabel[c.lead_status] ?? c.lead_status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.source_name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relTime(c.created_at)}</TableCell>
                  <TableCell className="text-xs">{rec ? <span title={rec.reason}>{rec.recommended_owner_name}</span> : "—"}</TableCell>
                  <TableCell>
                    <Select value={selectedAdvisor} onValueChange={v => setOverrides(prev => ({ ...prev, [c.id]: v }))}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Elegir" /></SelectTrigger>
                      <SelectContent>{MOCK_ADVISORS.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => selectedAdvisor && assign.mutate({ contactId: c.id, advisorId: selectedAdvisor })}
                      disabled={!selectedAdvisor || assign.isPending}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" />Asignar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── CrmAutomationRules ───────────────────────────────────────────────────────

export function CrmAutomationRules() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();

  const { data: dbRules = [], isLoading } = useQuery({
    queryKey: ["crm-automation-rules", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_automation_rules")
        .select("*").eq("organization_id", orgId).order("created_at");
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const rows = DEFAULT_AUTOMATION_RULES.map(r => ({ ...r, organization_id: orgId, is_active: true }));
      await (supabase as any).from("crm_automation_rules").upsert(rows, { onConflict: "organization_id,name" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-automation-rules", orgId] }); toast.success("Reglas base sembradas"); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await (supabase as any).from("crm_automation_rules").update({ is_active }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-automation-rules", orgId] }),
  });

  const PRIORITY_TONE: Record<string, string> = {
    urgent: "bg-red-500/15 text-red-700 dark:text-red-400",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    normal: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  };

  const displayRules = dbRules.length ? dbRules : DEFAULT_AUTOMATION_RULES.map((r, i) => ({ ...r, id: `mock-${i}`, is_active: true, isMock: true }));

  return (
    <div className="space-y-4">
      <PageHeader title="Reglas de automatización" subtitle="Triggers automáticos para acciones del CRM">
        <Button size="sm" variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
          <Zap className="w-4 h-4 mr-1" />{seedDefaults.isPending ? "Sembrando…" : "Sembrar defaults"}
        </Button>
      </PageHeader>

      {dbRules.length === 0 && (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0" />
          Mostrando reglas de ejemplo. Presiona "Sembrar defaults" para guardarlas en BD.
        </div>
      )}

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Activa</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
            ) : displayRules.map((rule: any) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium text-sm">{rule.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{rule.trigger_type?.replace(/_/g," ")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{rule.action_type?.replace(/_/g," ")}</TableCell>
                <TableCell><Badge className={`text-xs ${PRIORITY_TONE[rule.priority ?? "normal"]}`}>{rule.priority ?? "normal"}</Badge></TableCell>
                <TableCell>
                  <button onClick={() => !rule.isMock && toggleActive.mutate({ id: rule.id, is_active: !rule.is_active })}
                    className={`w-9 h-5 rounded-full transition-colors ${rule.is_active ? "bg-emerald-500" : "bg-muted"}`} title={rule.isMock ? "Sembrar para activar" : ""}>
                    <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${rule.is_active ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast.info(`Simulando: ${rule.name}`)}>
                    <PlayCircle className="w-3.5 h-3.5 mr-1" />Simular
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── CrmEscalations ───────────────────────────────────────────────────────────

export function CrmEscalations() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();

  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ["crm-escalations", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_escalations")
        .select("id,title,severity,status,created_at,resolved_at,contacts(full_name)").eq("organization_id", orgId)
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "resolved") patch.resolved_at = new Date().toISOString();
      await (supabase as any).from("crm_escalations").update(patch).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-escalations", orgId] }); toast.success("Escalación actualizada"); },
  });

  const SEVERITY_TONE: Record<string, string> = {
    critical: "bg-red-500/15 text-red-700 dark:text-red-400",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    info: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  };
  const STATUS_TONE: Record<string, string> = {
    open: "bg-red-500/15 text-red-700 dark:text-red-400",
    acknowledged: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    dismissed: "bg-muted text-muted-foreground",
  };

  const MOCK_ESC = [
    { id: "m1", title: "Lead hot sin contacto >4h", severity: "critical", status: "open", created_at: new Date(Date.now()-5*3600000).toISOString(), contacts: { full_name: "Jorge M." } },
    { id: "m2", title: "Asesor con +10 tareas vencidas", severity: "warning", status: "acknowledged", created_at: new Date(Date.now()-2*3600000).toISOString(), contacts: null },
    { id: "m3", title: "Deal sin next-task >48h", severity: "high", status: "open", created_at: new Date(Date.now()-26*3600000).toISOString(), contacts: { full_name: "Ana Ruiz" } },
  ];

  const display = escalations.length ? escalations : MOCK_ESC;

  return (
    <div className="space-y-4">
      <PageHeader title="Escalaciones" subtitle="SLA incumplidos y alertas del equipo" />
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Escalación</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Severidad</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead>Creada</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
            ) : display.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium text-sm max-w-[200px] truncate">{e.title}</TableCell>
                <TableCell className="text-sm">{e.contacts?.full_name ?? "—"}</TableCell>
                <TableCell><Badge className={`text-xs ${SEVERITY_TONE[e.severity ?? "info"]}`}><ShieldAlert className="w-3 h-3 mr-1" />{e.severity}</Badge></TableCell>
                <TableCell><Badge className={`text-xs ${STATUS_TONE[e.status ?? "open"]}`}>{e.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{relTime(e.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {e.status === "open" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: e.id, status: "acknowledged" })}>
                        <Bell className="w-3 h-3 mr-1" />Ack
                      </Button>
                    )}
                    {e.status !== "resolved" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: e.id, status: "resolved" })}>
                        <CheckCircle2 className="w-3 h-3 mr-1" />Resolver
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => updateStatus.mutate({ id: e.id, status: "dismissed" })}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── CrmLeadIntelligence ──────────────────────────────────────────────────────

export function CrmLeadIntelligence() {
  const orgId = useCrmOrgId();
  const [activeTab, setActiveTab] = useState<"hot" | "at_risk" | "tracking" | "sales_ready">("hot");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm-lead-intel-global", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_contacts")
        .select("id,full_name,lead_status,lifecycle_stage,last_contacted_at,last_activity_at,created_at,buying_intent,budget_range,development_id,contact_owner")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const scored = useMemo(() => contacts.map((c: any) => ({ c, intel: computeLeadIntelligence({ contact: c }) })), [contacts]);

  const hot = scored.filter(({ intel }) => intel.label === "Hot" || intel.label === "High intent");
  const atRisk = scored.filter(({ intel }) => intel.label === "At risk");
  const tracking = scored.filter(({ intel }) => intel.label === "Tracking issue");
  const salesReady = scored.filter(({ intel }) => intel.label === "Sales ready");

  const KPIs = [
    { label: "Hot / High intent", value: hot.length, tone: "text-red-600 dark:text-red-400" },
    { label: "En riesgo", value: atRisk.length, tone: "text-rose-600 dark:text-rose-400" },
    { label: "Tracking issue", value: tracking.length, tone: "text-violet-600 dark:text-violet-400" },
    { label: "Sales ready", value: salesReady.length, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Total analizados", value: scored.length, tone: "text-foreground" },
    { label: "Score promedio", value: fmtNum(scored.reduce((s, x) => s + x.intel.final_score, 0) / Math.max(1, scored.length)), tone: "text-foreground" },
  ];

  const BUCKETS: Record<typeof activeTab, typeof scored> = { hot, at_risk: atRisk, tracking, sales_ready: salesReady };
  const bucket = BUCKETS[activeTab];

  return (
    <div className="space-y-6">
      <PageHeader title="Lead Intelligence Global" subtitle="Scoring automatizado de toda la base" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPIs.map(k => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.tone}`}>{isLoading ? "…" : k.value}</p>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="hot">Hot <span className="ml-1 text-[10px]">({hot.length})</span></TabsTrigger>
          <TabsTrigger value="at_risk">En riesgo <span className="ml-1 text-[10px]">({atRisk.length})</span></TabsTrigger>
          <TabsTrigger value="tracking">Tracking issue <span className="ml-1 text-[10px]">({tracking.length})</span></TabsTrigger>
          <TabsTrigger value="sales_ready">Sales ready <span className="ml-1 text-[10px]">({salesReady.length})</span></TabsTrigger>
        </TabsList>
        {(["hot","at_risk","tracking","sales_ready"] as const).map(t => (
          <TabsContent key={t} value={t}>
            {isLoading ? <Skeleton className="h-40 w-full mt-2" /> : bucket.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sin leads en esta categoría</p>
            ) : (
              <div className="rounded-md border overflow-auto mt-2">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Fit</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Recomendación</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {bucket.slice(0, 30).map(({ c, intel }) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link to={`/admin/portal-crm/crm/contacts/${c.id}`} className="font-medium text-sm hover:underline">{c.full_name}</Link>
                        </TableCell>
                        <TableCell><Badge className={`text-xs ${LEAD_LABEL_TONE[intel.label] ?? ""}`}>{intel.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{intel.final_score}</span>
                            <Progress value={intel.final_score} className="w-16 h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{intel.fit.score} · {intel.fit.label}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{intel.engagement.score} · {intel.engagement.label}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">{intel.recommendation}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─── CrmAgentPerformance ──────────────────────────────────────────────────────

export function CrmAgentPerformance() {
  const orgId = useCrmOrgId();
  const [range, setRange] = useState<DateRange>("30d");

  const since = useMemo(() => rangeToSince(range), [range]);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm-agent-perf-contacts", orgId, since],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_contacts")
        .select("id,contact_owner,lead_status,lifecycle_stage,created_at,last_contacted_at,crm_deals(deal_stage,value)")
        .eq("organization_id", orgId).gte("created_at", since).limit(500);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["crm-agent-perf-tasks", orgId, since],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_tasks")
        .select("assigned_to,status,due_date").eq("organization_id", orgId).gte("created_at", since).limit(2000);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const perf = useMemo(() => aggregateAgentPerf(contacts, [], [], tasks, []), [contacts, tasks]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Desempeño de asesores"
        description="Métricas de conversión por asesor"
        actions={
          <Select value={range} onValueChange={v => setRange(v as DateRange)}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.entries(RANGE_LABEL) as [DateRange,string][]).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      {isLoading ? <Skeleton className="h-40 w-full" /> : perf.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Sin datos para el período</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Asesor</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Contactados</TableHead>
              <TableHead className="text-right">Citas</TableHead>
              <TableHead className="text-right">Reservas</TableHead>
              <TableHead className="text-right">Lead→Cita</TableHead>
              <TableHead className="text-right">Cita→Reserva</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Vencidas</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {perf.map(a => (
                <TableRow key={a.user_id}>
                  <TableCell className="font-medium text-sm">{a.name ?? "Sin asesor"}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.leads_assigned)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.leads_contacted)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.appointments_scheduled)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.reservations)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtPct(a.lead_to_appt_rate)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtPct(a.appt_to_reservation_rate)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(a.revenue)}</TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={a.overdue_tasks > 3 ? "text-red-500 font-medium" : ""}>{fmtNum(a.overdue_tasks)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── CrmSalesOperations ───────────────────────────────────────────────────────

export function CrmSalesOperations() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgContact, setMsgContact] = useState<any>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm-sales-ops-queue", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_contacts")
        .select("id,full_name,lead_status,lifecycle_stage,last_contacted_at,last_activity_at,created_at,buying_intent,development_id,contact_owner,crm_tasks(status,due_date)")
        .eq("organization_id", orgId).neq("lead_status", "lost").order("last_activity_at", { ascending: true }).limit(60);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const queue = useMemo(() => {
    return contacts.map((c: any) => {
      const intel = computeLeadIntelligence({ contact: c, tasks: c.crm_tasks ?? [] });
      const sla = calculateSlaStatus(c, { intelLabel: intel.label });
      const priority = getFollowUpPriority(sla, intel.label);
      return { c, intel, sla, priority };
    }).sort((a, b) => {
      const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });
  }, [contacts]);

  const PRIORITY_TONE: Record<string, string> = {
    P0: "bg-red-500/15 text-red-700 dark:text-red-400 font-bold",
    P1: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    P2: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    P3: "bg-muted text-muted-foreground",
  };

  const createTask = useMutation({
    mutationFn: async (contactId: string) => {
      if (!orgId) return;
      await (supabase as any).from("crm_tasks").insert({ organization_id: orgId, contact_id: contactId, title: "Seguimiento urgente (sales ops)", priority: "high", status: "pending" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-sales-ops-queue", orgId] }); toast.success("Tarea creada"); },
  });

  const selectedMsg = useMemo(() => {
    if (!msgContact) return null;
    const intel = computeLeadIntelligence({ contact: msgContact });
    return generateMessage(intel.label === "Hot" || intel.label === "High intent" ? "whatsapp_hot_lead" : "whatsapp_new_lead", {
      contact_name: msgContact.full_name,
      advisor_name: "tu asesor",
    });
  }, [msgContact]);

  return (
    <div className="space-y-4">
      <PageHeader title="Sales Operations" subtitle="Cola de seguimiento por prioridad SLA" />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Contacto</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Regla SLA</TableHead>
            <TableHead>Recomendación</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
            ) : queue.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin leads en cola</TableCell></TableRow>
            ) : queue.map(({ c, intel, sla, priority }) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link to={`/admin/portal-crm/crm/contacts/${c.id}`} className="font-medium text-sm hover:underline">{c.full_name}</Link>
                </TableCell>
                <TableCell><Badge className={`text-xs ${LEAD_LABEL_TONE[intel.label] ?? ""}`}>{intel.label}</Badge></TableCell>
                <TableCell><Badge className={`text-xs ${SLA_TONE[sla.status]}`}>{sla.status.replace(/_/g," ")}</Badge></TableCell>
                <TableCell><Badge className={`text-xs ${PRIORITY_TONE[priority]}`}>{priority}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{sla.reason}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{sla.recommendation}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => createTask.mutate(c.id)}>
                      <ClipboardList className="w-3 h-3 mr-1" />Tarea
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setMsgContact(c); setMsgOpen(true); }}>
                      <MessageSquare className="w-3 h-3 mr-1" />Msg
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mensaje generado — {msgContact?.full_name}</DialogTitle></DialogHeader>
          {selectedMsg && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />{selectedMsg.channel.replace("_mock","")}
              </div>
              <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{selectedMsg.body}</div>
              <p className="text-xs text-amber-600 dark:text-amber-400">{selectedMsg.disclaimer}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(selectedMsg?.body ?? ""); toast.success("Copiado"); }}>
              <Copy className="w-4 h-4 mr-1" />Copiar
            </Button>
            <Button onClick={() => setMsgOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
