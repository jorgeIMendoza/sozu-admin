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
  Calendar, ChevronRight, Check, ChevronDown, Download, Settings2, Upload, Loader2,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Image as ImageIcon, Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmOrgId } from "@/hooks/useCrmOrgId";
import { PageHeader, EmptyState, ComingSoon } from "@/components/admin/portal-crm/ui";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { isToday, isPast, isFuture, parseISO, format as fmtDateFns } from "date-fns";
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
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import { TextStyle as TextStyleExt } from "@tiptap/extension-text-style";

// ─── Contacts list ────────────────────────────────────────────────────────────

type ColumnId = "name" | "email" | "phone" | "lead_status" | "lifecycle" | "owner" | "created" | "updated" | "source";
type ColumnConfig = { id: ColumnId; label: string; visible: boolean };

const DEFAULT_CONTACT_COLUMNS: ColumnConfig[] = [
  { id: "name", label: "Nombre", visible: true },
  { id: "email", label: "Correo", visible: true },
  { id: "phone", label: "Número teléfono", visible: true },
  { id: "lead_status", label: "Estado lead", visible: true },
  { id: "lifecycle", label: "Etapa ciclo de vida", visible: true },
  { id: "owner", label: "Propietario del contacto", visible: true },
  { id: "created", label: "Fecha creación", visible: true },
  { id: "updated", label: "Última actualización", visible: true },
  { id: "source", label: "Fuente del registro", visible: true },
];

const CONTACT_COLUMNS_KEY = "sozu:contacts:columns:v2";

const META_LEAD_STATUSES: { value: string; label: string }[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "en_curso", label: "En curso" },
  { value: "negocio_abierto", label: "Negocio abierto" },
  { value: "sin_calificar", label: "Sin calificar" },
  { value: "intento_contacto", label: "Intento de contacto" },
  { value: "conectado", label: "Conectado" },
  { value: "fuera_presupuesto", label: "Fuera de presupuesto" },
  { value: "compra_futura", label: "Compra futura" },
  { value: "sin_respuesta_7", label: "Sin respuesta 7+" },
  { value: "tiempo_entrega", label: "Tiempo de entrega" },
  { value: "asesor_inmobiliario", label: "Asesor inmobiliario" },
  { value: "registro_error", label: "Registro por error" },
  { value: "proveedor", label: "Proveedor" },
  { value: "fuera_area", label: "Fuera del área" },
];

function loadContactColumns(): ColumnConfig[] {
  if (typeof window === "undefined") return DEFAULT_CONTACT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(CONTACT_COLUMNS_KEY);
    if (!raw) return DEFAULT_CONTACT_COLUMNS;
    const parsed = JSON.parse(raw) as ColumnConfig[];
    const byId = new Map(parsed.map((c) => [c.id, c]));
    const merged = DEFAULT_CONTACT_COLUMNS.map((d) => byId.get(d.id) ?? d);
    return [
      ...parsed.filter((c) => merged.find((m) => m.id === c.id)).map((c) => merged.find((m) => m.id === c.id)!),
      ...merged.filter((m) => !parsed.find((c) => c.id === m.id)),
    ];
  } catch {
    return DEFAULT_CONTACT_COLUMNS;
  }
}

type ContactRow = {
  id: string; full_name: string; email: string | null; phone: string | null;
  development_id: string | null; lead_status: string; lifecycle_stage: string;
  source_platform: string | null; source_name: string | null;
  contact_owner: string | null; last_activity_at: string | null;
  next_task_at: string | null; lead_score: number; created_at: string;
};

type View = "all" | "mine" | "unassigned" | "no_followup";

type StageTab = "all" | "mine" | "unassigned";

function DateChip({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="flex items-center justify-center w-[22px] h-[22px] rounded bg-purple-100 dark:bg-purple-950/70 shrink-0">
        <Calendar className="h-3 w-3 text-foreground" />
      </span>
      <span className="text-xs text-muted-foreground">{fmtDate(date)}</span>
    </div>
  );
}

export function CrmContacts() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stageTab, setStageTab] = useState<StageTab>("all");
  const [search, setSearch] = useState("");
  const [filterDev, setFilterDev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLifecycle, setFilterLifecycle] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [columns, setColumns] = useState<ColumnConfig[]>(() => loadContactColumns());
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);

  const persistColumns = (next: ColumnConfig[]) => {
    setColumns(next);
    try { window.localStorage.setItem(CONTACT_COLUMNS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const toggleColumn = (id: ColumnId) => persistColumns(columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  const moveColumn = (id: ColumnId, dir: -1 | 1) => {
    const idx = columns.findIndex((c) => c.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[idx], next[target]] = [next[target], next[idx]];
    persistColumns(next);
  };
  const visibleColumns = columns.filter((c) => c.visible);

  const { data: developments } = useQuery({
    queryKey: ["proyectos-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("proyectos").select("id,nombre").eq("activo", true).order("nombre");
      return (data ?? []).map((p: any) => ({ id: String(p.id), name: p.nombre }));
    },
  });

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts-sozu", stageTab, search, filterDev, filterLifecycle, page],
    queryFn: async () => {
      const tipoFilter = filterLifecycle !== "all"
        ? filterLifecycle === "customer" ? [2] : [7]
        : [2, 7];
      const proyectoId = filterDev !== "all" ? Number(filterDev) : null;

      let searchPersonaIds: number[] | null = null;
      if (search.trim()) {
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

  const allRows = contacts?.rows ?? [];
  const rows = allRows.filter((c) => {
    if (filterStatus !== "all" && c.lead_status !== filterStatus) return false;
    if (stageTab === "mine" && c.contact_owner !== user?.id) return false;
    if (stageTab === "unassigned" && c.contact_owner !== null) return false;
    return true;
  });
  const totalCount = contacts?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize + pageSize, totalCount);
  const devName = (id: string | null) => (developments as any[])?.find((d: any) => d.id === id)?.name ?? null;

  const CONTACT_TABS = [
    { id: "all" as StageTab, label: "Todos contactos" },
    { id: "mine" as StageTab, label: "Mis contactos" },
    { id: "unassigned" as StageTab, label: "Contactos no asignados" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Contactos{" "}
            <span className="text-base text-muted-foreground font-normal">({totalCount.toLocaleString()})</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <CreateContactDialog orgId={orgId ?? undefined} developments={developments ?? []} onCreated={() => qc.invalidateQueries({ queryKey: ["contacts-sozu"] })} />
        </div>
      </div>

      {/* Border-bottom tabs */}
      <div className="border-b border-border flex gap-1">
        {CONTACT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setStageTab(t.id); setPage(0); }}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors duration-150 ${stageTab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <CFilter value={filterDev} onChange={(v) => { setFilterDev(v); setPage(0); }} placeholder="Proyecto"
          options={[{ v: "all", l: "Todos los proyectos" }, ...(developments ?? []).map((d: any) => ({ v: d.id, l: d.name }))]} />
        <Button variant="outline" size="sm" className="h-8 text-xs font-normal text-muted-foreground">
          <ChevronDown className="size-3 mr-1" /> Fecha de creación
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs font-normal text-muted-foreground">
          <ChevronDown className="size-3 mr-1" /> Última actividad
        </Button>
        <CFilter value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(0); }} placeholder="Estado del lead"
          options={[{ v: "all", l: "Todos estados" }, ...META_LEAD_STATUSES.map((s) => ({ v: s.value, l: s.label }))]} />
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Plus className="size-3 mr-1" /> Filtros avanzados
        </Button>
      </div>

      {/* Table card */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {/* Table toolbar */}
        <div className="p-3 flex items-center gap-2 border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar nombre, email o teléfono" className="pl-8 h-8 text-sm focus-visible:ring-primary/50 focus-visible:border-primary/50" />
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setEditColumnsOpen(true)}>
            <Settings2 className="size-3 mr-1" /> Editar columnas
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !rows.length ? (
            <EmptyState title="No hay contactos" description="Ajusta los filtros o crea un contacto nuevo." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-border">
                <tr>
                  <th className="p-3 text-left w-8"><Checkbox /></th>
                  {visibleColumns.map((col) => (
                    <th key={col.id} className="p-3 text-left font-medium whitespace-nowrap">{col.label}</th>
                  ))}
                  <th className="p-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} role="button" tabIndex={0}
                    onClick={() => navigate(`/admin/portal-crm/ventas/contactos/${c.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/admin/portal-crm/ventas/contactos/${c.id}`); } }}
                    className="border-t border-border hover:bg-primary/5/40 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 transition-colors duration-150 group"
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}><Checkbox /></td>
                    {visibleColumns.map((col) => {
                      switch (col.id) {
                        case "name":
                          return (
                            <td key={col.id} className="p-3 font-medium whitespace-nowrap"
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/portal-crm/ventas/contactos/${c.id}`); }}>
                              <span className="inline-flex items-center gap-2 text-primary group-hover:text-primary font-medium">
                                <span className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0 ring-1 ring-primary/20">
                                  {c.full_name.charAt(0).toUpperCase()}
                                </span>
                                {c.full_name}
                              </span>
                            </td>
                          );
                        case "email":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.email || "—"}</td>;
                        case "phone":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.phone || "—"}</td>;
                        case "lead_status": {
                          const metaLabel = META_LEAD_STATUSES.find((s) => s.value === c.lead_status)?.label ?? leadStatusLabel[c.lead_status] ?? c.lead_status;
                          const statusColor: Record<string, string> = {
                            nuevo: "bg-sky-50 text-sky-700 border-sky-200",
                            en_curso: "bg-amber-50 text-amber-700 border-amber-200",
                            negocio_abierto: "bg-emerald-50 text-emerald-700 border-emerald-200",
                            conectado: "bg-primary/5 text-primary border-primary/20",
                            sin_calificar: "bg-slate-50 text-slate-500 border-slate-200",
                            intento_contacto: "bg-orange-50 text-orange-700 border-orange-200",
                            fuera_presupuesto: "bg-red-50 text-red-600 border-red-200",
                            compra_futura: "bg-violet-50 text-violet-700 border-violet-200",
                            sin_respuesta_7: "bg-rose-50 text-rose-600 border-rose-200",
                            tiempo_entrega: "bg-blue-50 text-blue-700 border-blue-200",
                            asesor_inmobiliario: "bg-indigo-50 text-indigo-700 border-indigo-200",
                            registro_error: "bg-red-50 text-red-500 border-red-200",
                            proveedor: "bg-purple-50 text-purple-700 border-purple-200",
                            fuera_area: "bg-orange-50 text-orange-600 border-orange-200",
                            new: "bg-sky-50 text-sky-700 border-sky-200",
                            contacted: "bg-amber-50 text-amber-700 border-amber-200",
                            engaged: "bg-primary/5 text-primary border-primary/20",
                            qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
                            unqualified: "bg-slate-50 text-slate-500 border-slate-200",
                            lost: "bg-red-50 text-red-600 border-red-200",
                          };
                          const cls = statusColor[c.lead_status] ?? "bg-slate-50 text-slate-500 border-slate-200";
                          return (
                            <td key={col.id} className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{metaLabel}</span>
                            </td>
                          );
                        }
                        case "lifecycle": {
                          const lcColor: Record<string, string> = {
                            lead: "bg-sky-50 text-sky-700 border-sky-200",
                            mql: "bg-amber-50 text-amber-700 border-amber-200",
                            sql: "bg-orange-50 text-orange-700 border-orange-200",
                            opportunity: "bg-violet-50 text-violet-700 border-violet-200",
                            customer: "bg-primary/5 text-primary border-primary/20",
                            evangelist: "bg-emerald-50 text-emerald-700 border-emerald-200",
                          };
                          const lcCls = lcColor[c.lifecycle_stage] ?? "bg-slate-50 text-slate-500 border-slate-200";
                          return (
                            <td key={col.id} className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${lcCls}`}>
                                {lifecycleLabel[c.lifecycle_stage] ?? c.lifecycle_stage}
                              </span>
                            </td>
                          );
                        }
                        case "owner":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.contact_owner ?? "Sin asignar"}</td>;
                        case "created":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.created_at ? fmtDate(c.created_at) : "—"}</td>;
                        case "updated":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.last_activity_at ? fmtDate(c.last_activity_at) : "—"}</td>;
                        case "source":
                          return (
                            <td key={col.id} className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.source_platform ? "bg-primary/5 text-primary border-primary/20" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                {c.source_platform ? "Por form" : "Manual"}
                              </span>
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5 opacity-0 group-hover:opacity-100 transition-all duration-150" asChild>
                        <Link to={`/admin/portal-crm/ventas/contactos/${c.id}`} aria-label="Ver detalle">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span>
          {totalCount === 0 ? "Sin resultados" : <>{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} de {totalCount.toLocaleString()} contactos</>}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      </div>

      {/* Column management sheet */}
      <Sheet open={editColumnsOpen} onOpenChange={setEditColumnsOpen}>
        <SheetContent side="right" className="w-[360px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Editar columnas</SheetTitle>
            <SheetDescription>Activa, desactiva y reordena las columnas visibles. Tu preferencia se guarda en este navegador.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-1">
            {columns.map((col, idx) => (
              <div key={col.id} className="flex items-center gap-3 p-2 rounded-md border border-border bg-card">
                <Checkbox checked={col.visible} onCheckedChange={() => toggleColumn(col.id)} id={`col-${col.id}`} />
                <label htmlFor={`col-${col.id}`} className="flex-1 text-sm cursor-pointer">{col.label}</label>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === 0} onClick={() => moveColumn(col.id, -1)} aria-label="Subir">↑</Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === columns.length - 1} onClick={() => moveColumn(col.id, 1)} aria-label="Bajar">↓</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" size="sm" onClick={() => persistColumns(DEFAULT_CONTACT_COLUMNS)}>Restablecer</Button>
            <Button size="sm" onClick={() => setEditColumnsOpen(false)}>Listo</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NoReg() {
  return <span className="text-xs italic text-muted-foreground/40">Sin registro</span>;
}

function CFilter({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string; options: { v: string; l: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
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
      <DialogTrigger asChild><Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="h-4 w-4 mr-1" />Nuevo contacto</Button></DialogTrigger>
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
          <Button onClick={submit} disabled={busy || !form.full_name} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear contacto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

// ─── Contact detail ───────────────────────────────────────────────────────────

// ─── Rich Note Editor ─────────────────────────────────────────────────────────

function RichNoteToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ext = file.name.split(".").pop();
      const path = `crm-notes/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage.from("public").upload(path, file, { contentType: file.type, upsert: false });
      if (error) { toast.error("Error al subir imagen"); return; }
      const { data: url } = supabase.storage.from("public").getPublicUrl(data.path);
      editor.chain().focus().setImage({ src: url.publicUrl }).run();
    };
    input.click();
  };

  const setLink = () => {
    const url = window.prompt("URL del enlace:");
    if (!url) return;
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };

  const btnClass = (active?: boolean) =>
    `h-7 w-7 flex items-center justify-center rounded transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))} title="Negrita">
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))} title="Cursiva">
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive("underline"))} title="Subrayado">
        <UnderlineIcon className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-border mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))} title="Lista">
        <List className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))} title="Lista numerada">
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-border mx-1" />
      <button type="button" onClick={setLink} className={btnClass(editor.isActive("link"))} title="Enlace">
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={addImage} className={btnClass()} title="Imagen">
        <ImageIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function InlineNoteForm({ contactId, userId, onSaved }: { contactId: string; userId?: string; onSaved: () => void }) {
  const [activityDate, setActivityDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      ImageExt.configure({ inline: false, allowBase64: false }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      TextStyleExt,
    ],
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none min-h-[80px] px-3 py-2 text-sm focus:outline-none" },
    },
  });

  const save = async () => {
    if (!userId || !editor || editor.isEmpty) return;
    setSaving(true);
    const html = editor.getHTML();
    const { error } = await (supabase as any).from("notes").insert({
      contact_id: contactId,
      user_id: userId,
      content: html,
      activity_date: activityDate,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Nota guardada");
    editor.commands.clearContent();
    onSaved();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <RichNoteToolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/20 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span>Fecha</span>
          <Input
            type="date"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            className="h-6 text-xs w-auto px-2 py-0 border border-border rounded shadow-none focus-visible:ring-0"
          />
        </div>
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !editor || editor.isEmpty}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
        >
          {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar nota"}
        </Button>
      </div>
    </div>
  );
}

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

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2"><Skeleton className="h-96 w-full" /></div>
        <div className="lg:col-span-3"><Skeleton className="h-64 w-full" /></div>
      </div>
    </div>
  );

  if (contactError) {
    const msg = (contactError as any).message?.toLowerCase() ?? "";
    const isPerm = msg.includes("permission") || msg.includes("forbidden") || msg.includes("rls") || msg.includes("not allowed");
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-destructive" />{isPerm ? "Sin permiso" : "Error al cargar"}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{isPerm ? "Tu usuario no tiene acceso a esta ficha." : "Ocurrió un problema al cargar la ficha."}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/admin/portal-crm/ventas/contactos"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link></Button>
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
          <Button variant="outline" size="sm" asChild><Link to="/admin/portal-crm/ventas/contactos"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const initials = contact.full_name.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p[0]).join("").toUpperCase() || "?";

  return (
    <div className="space-y-0 -mx-4 -mt-4 -mb-4 lg:-mx-8 lg:-mt-6 lg:-mb-6">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-3 border-b border-border bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/5 -ml-2 transition-colors" asChild>
            <Link to="/admin/portal-crm/ventas/contactos"><ArrowLeft className="h-4 w-4 mr-1.5" />Contactos</Link>
          </Button>
          <span className="text-muted-foreground/40 text-sm">/</span>
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{contact.full_name}</span>
        </div>
        <div className="flex gap-2">
          <NoteDialog contactId={contactId!} userId={user?.id} onSaved={invalidateAll} />
          <TaskDialog contactId={contactId!} orgId={orgId} owners={owners ?? []} onSaved={invalidateAll} />
          <AppointmentDialog contactId={contactId!} orgId={orgId} developmentId={contact.development_id} owners={owners ?? []} onSaved={invalidateAll} />
          <DealDialog contactId={contactId!} orgId={orgId} developmentId={contact.development_id} onSaved={invalidateAll} />
        </div>
      </div>

      {/* 3-column body */}
      <div className="grid grid-cols-12 min-h-[calc(100vh-112px)]">
        {/* Left: profile + info */}
        <aside className="col-span-3 border-r border-border p-5 space-y-5 bg-white overflow-y-auto">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold select-none ring-4 ring-primary/5 shadow-sm">
              {initials}
            </div>
            <div className="text-center">
              <h2 className="font-semibold text-sm leading-tight">{contact.full_name}</h2>
              {contact.email && (
                <div className="flex items-center justify-center gap-1 mt-1 text-xs text-primary">
                  <span className="truncate max-w-[130px]">{contact.email}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(contact.email!); toast.success("Correo copiado"); }}
                    className="shrink-0 hover:text-primary/80 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              )}
              {contact.phone && (
                <p className="text-xs text-muted-foreground mt-0.5">{contact.phone}</p>
              )}
            </div>
          </div>

          {/* Quick action icons */}
          <div className="grid grid-cols-5 gap-1">
            {[
              { Icon: StickyNote, label: "Nota" },
              { Icon: Mail, label: "Correo" },
              { Icon: Phone, label: "Llamada" },
              { Icon: ClipboardList, label: "Tarea" },
              { Icon: CalendarClock, label: "Reunión" },
            ].map(({ Icon, label }) => (
              <button key={label} className="flex flex-col items-center gap-1 p-1.5 rounded-md hover:bg-primary/5 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[9px] text-muted-foreground leading-none">{label}</span>
              </button>
            ))}
          </div>

          {/* Accordion: Acerca de este contacto */}
          <Accordion type="single" collapsible defaultValue="info">
            <AccordionItem value="info" className="border-0">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-widest text-slate-500 hover:no-underline py-2 hover:text-primary transition-colors">
                Acerca de este contacto
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0">
                <LeftPanel contact={contact} developments={developments ?? []} owners={owners ?? []} onSaved={invalidateAll} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>

        {/* Center: activity tabs */}
        <section className="col-span-6 border-r border-border">
          <Tabs defaultValue="actividades" className="flex flex-col">
            <div className="border-b border-border">
              <TabsList className="justify-start rounded-none bg-transparent h-auto px-4 gap-0">
                <TabsTrigger value="descripcion" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Descripción</TabsTrigger>
                <TabsTrigger value="actividades" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Actividades</TabsTrigger>
                <TabsTrigger value="avanzado" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Información avanzada</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="descripcion" className="p-4 mt-0">
              <p className="text-sm text-muted-foreground">Sin descripción para este contacto.</p>
            </TabsContent>
            <TabsContent value="actividades" className="p-4 space-y-4 mt-0">
              <InlineNoteForm contactId={contactId!} userId={user?.id} onSaved={invalidateAll} />
              {/* Tarea inline section */}
              <div className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tarea</span>
                  <button
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary font-medium transition-colors"
                    onClick={() => {/* TaskDialog trigger */}}
                  >
                    <Plus className="h-3.5 w-3.5" />Crear tarea
                  </button>
                </div>
              </div>
              {/* Línea de tiempo */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Línea de tiempo</p>
                <Timeline
                  notes={notes ?? []} tasks={tasks ?? []} appointments={appointments ?? []}
                  deals={deals ?? []} pipelineEvents={pipelineEvents ?? []} conversionEvents={conversionEvents ?? []}
                  contact={contact}
                />
              </div>
            </TabsContent>
            <TabsContent value="avanzado" className="p-4 mt-0">
              <div className="space-y-2 text-sm">
                {!attribution ? (
                  <p className="text-muted-foreground">Sin datos de atribución para este contacto.</p>
                ) : (
                  <>
                    <ARow label="UTM source" v={attribution.first_touch_source ?? contact.source_platform} />
                    <ARow label="UTM medium" v={attribution.first_touch_medium} />
                    <ARow label="UTM campaign" v={attribution.first_touch_campaign ?? contact.source_name} />
                    <ARow label="fbclid" v={attribution.fbclid} mono />
                    <ARow label="gclid" v={attribution.gclid} mono />
                    <ARow label="Landing" v={attribution.landing_page} mono />
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* Right: related entities */}
        <aside className="col-span-3 p-4 bg-slate-50/40">
          <Accordion type="multiple" defaultValue={["empresas", "deals", "tickets"]}>
            <AccordionItem value="empresas">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Empresas <span className="text-xs text-muted-foreground font-normal">0</span></span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground py-2">Sin empresas asociadas</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="deals">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Negocios <span className="text-xs text-muted-foreground font-normal">{(deals ?? []).length}</span></span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <button className="flex items-center gap-1 text-xs text-primary hover:text-primary font-medium transition-colors mb-1">
                    <Plus className="h-3.5 w-3.5" />Agregar
                  </button>
                  {!(deals ?? []).length ? (
                    <p className="text-xs text-muted-foreground py-1">Sin negocios</p>
                  ) : (
                    (deals ?? []).map((d: any) => (
                      <div key={d.id} className="p-2.5 rounded-md border border-primary/20 bg-primary/5 text-xs">
                        <div className="font-medium truncate text-primary">{d.deal_name}</div>
                        <div className="text-primary mt-0.5 flex items-center justify-between">
                          <span>{DEAL_STAGES.find((s) => s.id === d.deal_stage)?.label ?? d.deal_stage}</span>
                          {d.value && <span className="font-semibold">{fmtMXN(Number(d.value))}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tickets" className="border-b-0">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Tickets <span className="text-xs text-muted-foreground font-normal">0</span></span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground py-2">Sin tickets asociados</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>
      </div>
    </div>
  );
}

function LeftPanel({ contact, developments, owners, onSaved }: any) {
  const [form, setForm] = useState({
    email: contact.email ?? "", phone: contact.phone ?? "",
    lead_status: contact.lead_status ?? "new", lifecycle_stage: contact.lifecycle_stage ?? "lead",
    development_id: contact.development_id ?? "", contact_owner: contact.contact_owner ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("contacts").update({
      email: form.email || null, phone: form.phone || null,
      lead_status: form.lead_status, lifecycle_stage: form.lifecycle_stage,
      development_id: form.development_id || null, contact_owner: form.contact_owner || null,
      last_activity_at: new Date().toISOString(),
    }).eq("id", contact.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contacto actualizado"); onSaved();
  };

  return (
    <div className="space-y-3 text-sm">
      <CField label="Correo electrónico">
        <Input className="h-8 text-sm" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" />
      </CField>
      <CField label="Número de móvil">
        <Input className="h-8 text-sm" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+52 55 0000 0000" />
      </CField>
      <CField label="Proyecto">
        <Select value={form.development_id} onValueChange={(v) => setForm({ ...form, development_id: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
          <SelectContent>{(developments as any[]).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      </CField>
      <CField label="Estado del lead">
        <Select value={form.lead_status} onValueChange={(v) => setForm({ ...form, lead_status: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {META_LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            {Object.entries(leadStatusLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </CField>
      <CField label="Etapa del ciclo de vida">
        <Select value={form.lifecycle_stage} onValueChange={(v) => setForm({ ...form, lifecycle_stage: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(lifecycleLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </CField>
      <CField label="Propietario del contacto">
        <Select value={form.contact_owner} onValueChange={(v) => setForm({ ...form, contact_owner: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
          <SelectContent>{(owners as any[]).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
        </Select>
      </CField>
      <Button size="sm" onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-1">
        {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</> : <><Save className="h-3.5 w-3.5 mr-1.5" />Guardar cambios</>}
      </Button>
    </div>
  );
}

function DField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

type TLItem = { id: string; ts: string; kind: string; title: string; subtitle?: string; html?: string; icon: any; tone?: string };

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function Timeline({ notes, tasks, appointments, deals, pipelineEvents, conversionEvents, contact }: any) {
  const synthetic: TLItem = {
    id: "contact-created",
    ts: contact.created_at,
    kind: "Sistema",
    title: "Contacto registrado en SOZU",
    icon: UserPlus,
    tone: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  };

  const items: TLItem[] = [
    ...notes.map((n: any) => ({ id: `n-${n.id}`, ts: n.created_at, kind: "Nota", title: stripHtml(n.content ?? "").slice(0, 80) || "Nota", html: n.content, icon: StickyNote, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" })),
    ...tasks.map((t: any) => ({ id: `t-${t.id}`, ts: t.due_date ? `${t.due_date}T${t.due_time ?? "09:00:00"}` : t.created_at, kind: `Tarea · ${t.status}`, title: t.title, subtitle: t.due_date ? `Vence ${fmtDate(t.due_date)}` : undefined, icon: ClipboardList, tone: "bg-blue-500/15 text-blue-700 dark:text-blue-400" })),
    ...appointments.map((a: any) => ({ id: `a-${a.id}`, ts: a.scheduled_at, kind: `Cita · ${apptStatusLabel[a.status] ?? a.status}`, title: a.appointment_type, subtitle: fmtDateTime(a.scheduled_at), icon: CalendarClock, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-400" })),
    ...deals.map((d: any) => ({ id: `d-${d.id}`, ts: d.created_at, kind: `Deal · ${DEAL_STAGES.find((s) => s.id === d.deal_stage)?.label ?? d.deal_stage}`, title: d.deal_name, subtitle: d.value ? fmtMXN(Number(d.value)) : undefined, icon: Briefcase, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400" })),
    ...pipelineEvents.map((p: any) => ({ id: `p-${p.id}`, ts: p.changed_at, kind: "Pipeline", title: `${p.old_stage ?? "—"} → ${p.new_stage}`, icon: GitBranch, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" })),
    ...conversionEvents.map((c: any) => ({ id: `c-${c.id}`, ts: c.event_time, kind: "Evento", title: c.event_name, subtitle: `Meta: ${c.meta_status} · Google: ${c.google_status}`, icon: Zap, tone: "bg-pink-500/15 text-pink-700 dark:text-pink-400" })),
    synthetic,
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const hasRealActivity = items.length > 1;

  return (
    <div>
      <div className="space-y-0">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <div key={it.id} className="flex gap-3 relative pb-5 last:pb-0 group/item">
              {i < items.length - 1 && (
                <div className="absolute left-3.5 top-7 bottom-0 w-px bg-border/60" />
              )}
              <div className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center z-10 ring-2 ring-background shadow-sm ${it.tone ?? "bg-muted"}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5 rounded-lg p-2 -ml-0.5 group-hover/item:bg-slate-50/80 transition-colors duration-100">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{it.kind}</span>
                  <span className="text-xs text-muted-foreground/70 shrink-0 tabular-nums">{relTime(it.ts)}</span>
                </div>
                {it.html ? (
                  <div
                    className="mt-1 prose prose-sm max-w-none text-foreground prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0 prose-strong:font-semibold prose-a:text-primary prose-img:rounded-md prose-img:my-2"
                    dangerouslySetInnerHTML={{ __html: it.html }}
                  />
                ) : (
                  <>
                    <div className="text-sm mt-0.5 font-medium text-foreground">{it.title}</div>
                    {it.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{it.subtitle}</div>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!hasRealActivity && (
        <div className="text-center py-8 border border-dashed border-primary/20 rounded-xl bg-primary/5">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-primary/80">Sin actividad registrada aún</p>
          <p className="text-xs text-primary/60 mt-1">Agrega una nota para comenzar el historial</p>
        </div>
      )}
    </div>
  );
}

function ARow({ label, v, mono }: { label: string; v?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-1 border-b last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-xs truncate max-w-[180px] ${mono ? "font-mono" : ""}`}>{v ?? "—"}</span>
    </div>
  );
}

function NoteDialog({ contactId, userId, onSaved }: { contactId: string; userId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      ImageExt.configure({ inline: false, allowBase64: false }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      TextStyleExt,
    ],
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none min-h-[120px] px-3 py-2 text-sm focus:outline-none" },
    },
  });

  const save = async () => {
    if (!userId || !editor || editor.isEmpty) return;
    setSaving(true);
    const html = editor.getHTML();
    const { error } = await (supabase as any).from("notes").insert({ contact_id: contactId, user_id: userId, content: html });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await (supabase as any).from("contacts").update({ last_activity_at: new Date().toISOString() }).eq("id", contactId);
    toast.success("Nota guardada");
    setOpen(false);
    editor.commands.clearContent();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors">
          <StickyNote className="h-4 w-4 mr-1.5" />Nota
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nueva nota</DialogTitle></DialogHeader>
        <div className="border border-border rounded-lg overflow-hidden">
          <RichNoteToolbar editor={editor} />
          <EditorContent editor={editor} />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !editor || editor.isEmpty} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar nota"}
          </Button>
        </DialogFooter>
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
      <DialogTrigger asChild><Button size="sm" variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors"><ClipboardList className="h-4 w-4 mr-1.5" />Tarea</Button></DialogTrigger>
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
        <DialogFooter><Button onClick={save} disabled={!form.title} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear tarea</Button></DialogFooter>
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
      <DialogTrigger asChild><Button size="sm" variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors"><CalendarClock className="h-4 w-4 mr-1.5" />Cita</Button></DialogTrigger>
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
        <DialogFooter><Button onClick={save} disabled={!form.scheduled_at} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear cita</Button></DialogFooter>
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
      <DialogTrigger asChild><Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"><Briefcase className="h-4 w-4 mr-1.5" />Deal</Button></DialogTrigger>
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
        <DialogFooter><Button onClick={save} disabled={!form.deal_name} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear deal</Button></DialogFooter>
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
          <Link to={`/admin/portal-crm/ventas/contactos/${deal.contact.id}`} className="hover:underline" onPointerDown={(e) => e.stopPropagation()}>
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
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Nueva cita</Button>
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
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear cita</Button>
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
  const [tab, setTab] = useState<"all" | "today" | "overdue" | "upcoming">("today");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ contact_id: "", title: "", due_date: "", assigned_to: user?.id ?? "", priority: "normal" });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["crm-tasks", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_tasks").select("id,title,status,priority,due_date,assigned_to,contacts(full_name)").eq("organization_id", orgId).order("due_date", { ascending: true }).limit(500);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const filtered = tasks.filter((tk: any) => {
    if (tk.status === "completed" && tab !== "all") return false;
    if (!tk.due_date) return tab === "all";
    const d = parseISO(tk.due_date);
    if (tab === "today") return isToday(d);
    if (tab === "overdue") return isPast(d) && !isToday(d);
    if (tab === "upcoming") return isFuture(d);
    return true;
  });

  const complete = useMutation({
    mutationFn: async (tk: any) => {
      const newStatus = tk.status === "completed" ? "pending" : "completed";
      await (supabase as any).from("crm_tasks").update({ status: newStatus }).eq("id", tk.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks", orgId] }),
  });

  const create = useMutation({
    mutationFn: async () => { if (!orgId) return; await (supabase as any).from("crm_tasks").insert({ organization_id: orgId, ...form }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-tasks", orgId] }); setOpen(false); toast.success("Tarea creada"); },
  });

  const TASK_TABS = [
    { id: "all" as const, label: "Todo" },
    { id: "today" as const, label: "Vencen hoy" },
    { id: "overdue" as const, label: "Atrasado" },
    { id: "upcoming" as const, label: "Próximamente" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold">Tareas</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Nueva tarea</Button>
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
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">Crear tarea</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Border-bottom tabs */}
      <div className="border-b border-border flex gap-1">
        {TASK_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors duration-150 ${tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 w-10"></th>
                <th className="p-3 text-left font-medium">Título</th>
                <th className="p-3 text-left font-medium">Vencimiento</th>
                <th className="p-3 text-left font-medium">Contacto asociado</th>
                <th className="p-3 text-left font-medium">Asignado a</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">Sin tareas.</td>
                </tr>
              )}
              {filtered.map((tk: any) => {
                const isOverdue = tk.due_date && isPast(parseISO(tk.due_date)) && !isToday(parseISO(tk.due_date)) && tk.status !== "completed";
                const dueLabel = tk.due_date
                  ? isToday(parseISO(tk.due_date))
                    ? "Hoy"
                    : fmtDateFns(parseISO(tk.due_date), "dd MMM yyyy")
                  : "—";
                return (
                  <tr key={tk.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => complete.mutate(tk)}
                        className={`size-5 rounded-full border-2 flex items-center justify-center transition-colors ${tk.status === "completed" ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-info"}`}
                      >
                        {tk.status === "completed" && <Check className="size-3" />}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className={tk.status === "completed" ? "line-through text-muted-foreground" : ""}>{tk.title}</div>
                    </td>
                    <td className={`p-3 whitespace-nowrap ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>{dueLabel}</td>
                    <td className="p-3">{tk.contacts?.full_name ? (
                      <Badge variant="outline" className="bg-info/10 text-info border-info/30">{tk.contacts.full_name}</Badge>
                    ) : "—"}</td>
                    <td className="p-3 text-muted-foreground">{tk.assigned_to ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
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
                          <Link to={`/admin/portal-crm/ventas/contactos/${c.id}`} className="font-medium text-sm hover:underline">{c.full_name}</Link>
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
                  <Link to={`/admin/portal-crm/ventas/contactos/${c.id}`} className="font-medium text-sm hover:underline">{c.full_name}</Link>
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
