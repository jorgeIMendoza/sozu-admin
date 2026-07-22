import { useMemo, useState, useEffect, useRef } from "react";
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
  Calendar, ChevronRight, ChevronLeft, Check, ChevronDown, Download, Settings2, Upload, Loader2,
  MoreHorizontal, Pencil, Trash2, Video, MapPin, Building2, Store, ExternalLink, Clock, Users,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, LayoutGrid, GripVertical,
  Image as ImageIcon, Link as LinkIcon, Paperclip, Mic, FileText, Square,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmOrgId } from "@/hooks/useCrmOrgId";
import { PageHeader, EmptyState, ComingSoon, ARow } from "@/components/admin/portal-crm/ui";
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
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { isToday, isPast, isFuture, parseISO, format as fmtDateFns, addDays, addWeeks, addMonths, addYears } from "date-fns";
import {
  leadStatusLabel, lifecycleLabel, leadScoreColor, relTime, fmtDate,
  fmtDateTime, fmtMXN, DEAL_STAGES,
  taskStatusLabel, TASK_STATUS, type DealStage,
} from "@/lib/crm-lib";
import {
  fmtMoneda, stripHtml, dealInitials, etapaColorClasses,
  advanceByRecurrence, fmtDueDateTime, fmtCitaWhen,
  TIPO_NEGOCIO_OPTS, PRIORIDAD_META,
} from "@/lib/crm-format";
import {
  META_LEAD_STATUSES, useLeadStates, fetchCrmCategorias,
  fetchCrmOwners, type CrmOwner,
} from "@/hooks/useCrmCatalogos";
import {
  PERSONA_EMAIL_RE, PERSONA_PHONE_RE, MSG_TELEFONO_INVALIDO,
  MSG_EMAIL_INVALIDO, mensajeErrorContacto,
} from "@/lib/crm-validaciones";
import {
  CRM_ATTACH_BUCKET, classifyAttachment, humanFileSize,
  saveNoteAttachments, fetchNoteAttachments, NoteAttachmentsStrip,
  type AttachKind, type PendingAttachment, type NoteAttachment,
} from "./crm-adjuntos";
import { InlineNoteForm, NoteCard, NoteDialog } from "./crm-notas";
import {
  TaskDialog, CitaDialog, TaskActivityCard, regenerateRecurringTask,
  NewGlobalCitaDialog, CitaPreviewSheet, NewGlobalTaskDialog,
  CITA_TYPE_META, CITA_STATUS_META, CITA_STATUS_ORDER,
  TASK_TYPE_META, TASK_PRIORITY_META, RECURRENCE_LABEL,
  type GlobalCita,
} from "./crm-tareas-citas";
import { ActivityPanel, Timeline, DealActivityFeed } from "./crm-actividad";
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

type ColumnId =
  | "name"
  | "categoria"
  | "email"
  | "phone"
  | "lead_status"
  | "lifecycle"
  | "owner"
  | "created"
  | "updated"
  | "source"
  | "meta_form_name"
  | "meta_campaign_id"
  | "meta_ad_id"
  | "meta_platform"
  | "meta_created_time"
  | "meta_field_data";

type ColumnConfig = { id: ColumnId; label: string; visible: boolean };

const DEFAULT_CONTACT_COLUMNS: ColumnConfig[] = [
  { id: "name", label: "Nombre", visible: true },
  { id: "categoria", label: "Categoría", visible: true },
  { id: "email", label: "Correo", visible: true },
  { id: "phone", label: "Número teléfono", visible: true },
  { id: "lead_status", label: "Estado lead", visible: true },
  { id: "lifecycle", label: "Etapa ciclo de vida", visible: true },
  { id: "owner", label: "Propietario del contacto", visible: true },
  { id: "created", label: "Fecha creación", visible: true },
  { id: "updated", label: "Última actualización", visible: true },
  { id: "source", label: "Fuente del registro", visible: true },
  { id: "meta_form_name", label: "Formulario (Meta)", visible: false },
  { id: "meta_campaign_id", label: "Campaña (Meta)", visible: false },
  { id: "meta_ad_id", label: "Anuncio (Meta)", visible: false },
  { id: "meta_platform", label: "Plataforma (Meta)", visible: false },
  { id: "meta_created_time", label: "Fecha lead (Meta)", visible: false },
  { id: "meta_field_data", label: "Respuestas del formulario", visible: false },
];

const CONTACT_COLUMNS_KEY = "sozu:contacts:columns:v4";



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
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  development_id: string | null;
  lead_status: string;
  lifecycle_stage: string;
  source_platform: string | null;
  source_name: string | null;
  contact_owner: string | null;
  owner_name: string | null;
  last_activity_at: string | null;
  next_task_at: string | null;
  lead_score: number;
  created_at: string;
  meta_form_name: string | null;
  meta_campaign_id: string | null;
  meta_ad_id: string | null;
  meta_platform: string | null;
  meta_created_time: string | null;
  meta_field_data: any[] | null;
  categoria_ids: number[];
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

// ─── Categorías de contacto (procedencia) ──────────────────────────────────────


// Categoría del contacto en la ficha (select único; persiste al instante).
function ContactCategories({ contactId }: { contactId: number }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data: catalog = [] } = useQuery({ queryKey: ["crm-categorias"], queryFn: fetchCrmCategorias });
  const { data: selected = [], refetch } = useQuery({
    queryKey: ["contact-categorias", contactId],
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await (supabase as any)
        .from("entidades_relacionadas_categorias")
        .select("id_categoria")
        .eq("id_entidad_relacionada", contactId)
        .eq("activo", true);
      if (error) return [];
      return (data ?? []).map((r: any) => r.id_categoria as number);
    },
  });
  if (!catalog.length) return null;
  const current = (selected as number[])[0];
  const setCategoria = async (idStr: string) => {
    const id = Number(idStr);
    setSaving(true);
    try {
      const tbl = () => (supabase as any).from("entidades_relacionadas_categorias");
      const up = await tbl().upsert(
        { id_entidad_relacionada: contactId, id_categoria: id, activo: true },
        { onConflict: "id_entidad_relacionada,id_categoria" },
      );
      if (up.error) throw up.error;
      // Select único: desactivar cualquier otra categoría del contacto.
      const off = await tbl().update({ activo: false })
        .eq("id_entidad_relacionada", contactId).eq("activo", true).neq("id_categoria", id);
      if (off.error) throw off.error;
      await refetch();
      qc.invalidateQueries({ queryKey: ["contacts-sozu"] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar la categoría");
    } finally {
      setSaving(false);
    }
  };
  return (
    <CField label="Categoría">
      <div className="flex items-center gap-2">
        <Select value={current != null ? String(current) : ""} onValueChange={setCategoria}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
          <SelectContent>{catalog.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}</SelectContent>
        </Select>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
      </div>
    </CField>
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
  const [filterSource, setFilterSource] = useState("all");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [columns, setColumns] = useState<ColumnConfig[]>(() => loadContactColumns());
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const { data: leadStates = META_LEAD_STATUSES } = useLeadStates();

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
      // Solo proyectos SOZU: proyectos con relación de entidad SOZU (id_tipo_entidad=5) y publicados.
      const { data: rels } = await (supabase as any).from("entidades_relacionadas")
        .select("id_proyecto").eq("id_tipo_entidad", 5).eq("activo", true).not("id_proyecto", "is", null);
      const ids = Array.from(new Set((rels ?? []).map((r: any) => r.id_proyecto)));
      if (!ids.length) return [];
      const { data } = await (supabase as any).from("proyectos")
        .select("id,nombre").in("id", ids).eq("activo", true).eq("publicar", true).order("nombre");
      return (data ?? []).map((p: any) => ({ id: String(p.id), name: p.nombre }));
    },
  });

  const { data: categoriasCatalog = [] } = useQuery({ queryKey: ["crm-categorias"], queryFn: fetchCrmCategorias });
  const catNameMap = useMemo<Record<number, string>>(
    () => Object.fromEntries((categoriasCatalog as any[]).map((c: any) => [c.id, c.nombre])),
    [categoriasCatalog],
  );

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts-sozu", stageTab, search, filterDev, filterLifecycle, filterSource, filterCategoria, page],
    queryFn: async () => {
      // Contactos = entidades_relacionadas (prospecto=7 / comprador=2) + personas.
      // La atribución de Meta se agrega vía LEFT JOIN a crm_leads_atribucion.
      const tipoFilter = filterLifecycle !== "all"
        ? filterLifecycle === "customer" ? [2] : [7]
        : [2, 7];
      const proyectoId = filterDev !== "all" ? Number(filterDev) : null;

      // Búsqueda por nombre/email/teléfono → resolver ids de persona primero.
      let searchPersonaIds: number[] | null = null;
      if (search.trim()) {
        const { data: matchPers } = await (supabase as any).from("personas")
          .select("id").eq("activo", true)
          .or(`nombre_legal.ilike.%${search}%,nombre_comercial.ilike.%${search}%,email.ilike.%${search}%,telefono.ilike.%${search}%`);
        searchPersonaIds = (matchPers ?? []).map((p: any) => p.id);
        if (searchPersonaIds!.length === 0) return { rows: [], count: 0 };
      }

      // Filtro por fuente vía crm_leads_atribucion (Meta = tiene meta_leadgen_id).
      let sourceErIds: number[] | null = null;   // restringir a estos (solo Meta)
      let excludeErIds: number[] = [];            // excluir estos (manual = no Meta)
      if (filterSource === "meta" || filterSource === "manual") {
        const { data: metaRows } = await (supabase as any).from("crm_leads_atribucion")
          .select("id_entidad_relacionada").eq("activo", true).not("meta_leadgen_id", "is", null);
        const metaIds = (metaRows ?? []).map((r: any) => Number(r.id_entidad_relacionada));
        if (filterSource === "meta") {
          sourceErIds = metaIds;
          if (!sourceErIds.length) return { rows: [], count: 0 };
        } else {
          excludeErIds = metaIds;
        }
      }

      // Filtro por categoría (procedencia) vía tabla puente.
      let catErIds: number[] | null = null;
      if (filterCategoria !== "all") {
        const { data: catRows } = await (supabase as any).from("entidades_relacionadas_categorias")
          .select("id_entidad_relacionada").eq("activo", true).eq("id_categoria", Number(filterCategoria));
        catErIds = (catRows ?? []).map((r: any) => Number(r.id_entidad_relacionada));
        if (!catErIds.length) return { rows: [], count: 0 };
      }

      const buildQ = (sel: string, opts?: Record<string, unknown>) => {
        let q = (supabase as any).from("entidades_relacionadas").select(sel, opts ?? {});
        q = q.in("id_tipo_entidad", tipoFilter).eq("activo", true);
        if (proyectoId) q = q.eq("id_proyecto", proyectoId);
        if (searchPersonaIds) q = q.in("id_persona", searchPersonaIds);
        if (sourceErIds) q = q.in("id", sourceErIds);
        if (catErIds) q = q.in("id", catErIds);
        if (excludeErIds.length) q = q.not("id", "in", `(${excludeErIds.join(",")})`);
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

      // Datos de contacto desde personas.
      const { data: personas } = await (supabase as any).from("personas")
        .select("id, nombre_legal, nombre_comercial, email, telefono")
        .in("id", ers.map((e: any) => e.id_persona))
        .eq("activo", true);
      const pMap: Record<number, any> = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p]));

      // Atribución de Meta (opcional): puede no existir la tabla todavía (DDL pendiente).
      let atrMap: Record<number, any> = {};
      const atrRes = await (supabase as any).from("crm_leads_atribucion")
        .select("id_entidad_relacionada, estatus_lead, etapa_ciclo_vida, id_propietario, meta_form_name, meta_campaign_id, meta_ad_id, meta_platform, meta_created_time, meta_field_data")
        .in("id_entidad_relacionada", ers.map((e: any) => e.id))
        .eq("activo", true);
      if (!atrRes.error) {
        atrMap = Object.fromEntries((atrRes.data ?? []).map((a: any) => [a.id_entidad_relacionada, a]));
      }

      // Resolver nombres de los propietarios (id_propietario es un auth_user_id / UUID).
      const ownerIds = Array.from(new Set(Object.values(atrMap).map((a: any) => a?.id_propietario).filter(Boolean)));
      let ownerNameMap: Record<string, string> = {};
      if (ownerIds.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", ownerIds);
        ownerNameMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }

      // Categorías (procedencia) de cada contacto de la página.
      const catByEr: Record<number, number[]> = {};
      const catAllRes = await (supabase as any).from("entidades_relacionadas_categorias")
        .select("id_entidad_relacionada, id_categoria")
        .in("id_entidad_relacionada", ers.map((e: any) => e.id))
        .eq("activo", true);
      if (!catAllRes.error) {
        for (const r of (catAllRes.data ?? [])) {
          (catByEr[r.id_entidad_relacionada] ??= []).push(r.id_categoria);
        }
      }

      const rows: ContactRow[] = ers
        .filter((e: any) => pMap[e.id_persona])
        .map((e: any) => {
          const p = pMap[e.id_persona];
          const a = atrMap[e.id] ?? null;
          return {
            id: String(e.id),
            full_name: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
            email: p.email ?? null,
            phone: p.telefono ?? null,
            development_id: e.id_proyecto ? String(e.id_proyecto) : null,
            lead_status: a?.estatus_lead ?? "nuevo",
            lifecycle_stage: a?.etapa_ciclo_vida ?? (e.id_tipo_entidad === 2 ? "customer" : "lead"),
            source_platform: a?.meta_platform ?? null,
            source_name: a?.meta_form_name ?? null,
            contact_owner: a?.id_propietario ?? null,
            owner_name: a?.id_propietario ? (ownerNameMap[a.id_propietario] ?? null) : null,
            last_activity_at: e.fecha_actualizacion ?? null,
            next_task_at: null,
            lead_score: 0,
            created_at: e.fecha_creacion ?? new Date().toISOString(),
            meta_form_name: a?.meta_form_name ?? null,
            meta_campaign_id: a?.meta_campaign_id ?? null,
            meta_ad_id: a?.meta_ad_id ?? null,
            meta_platform: a?.meta_platform ?? null,
            meta_created_time: a?.meta_created_time ?? null,
            meta_field_data: a?.meta_field_data ?? null,
            categoria_ids: catByEr[e.id] ?? [],
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
        <CFilter value={filterSource} onChange={(v) => { setFilterSource(v); setPage(0); }} placeholder="Fuente"
          options={[{ v: "all", l: "Todas las fuentes" }, { v: "meta", l: "Solo Meta" }, { v: "manual", l: "Manual" }]} />
        <CFilter value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(0); }} placeholder="Estado del lead"
          options={[{ v: "all", l: "Todos estados" }, ...leadStates.map((s) => ({ v: s.value, l: s.label }))]} />
        {(categoriasCatalog as any[]).length > 0 && (
          <CFilter value={filterCategoria} onChange={(v) => { setFilterCategoria(v); setPage(0); }} placeholder="Categoría"
            options={[{ v: "all", l: "Todas las categorías" }, ...(categoriasCatalog as any[]).map((c: any) => ({ v: String(c.id), l: c.nombre }))]} />
        )}
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
              <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm border-b border-border">
                <tr>
                  <th className="px-3 py-2.5 text-left w-8"><Checkbox /></th>
                  {visibleColumns.map((col) => (
                    <th key={col.id} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{col.label}</th>
                  ))}
                  <th className="px-3 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} role="button" tabIndex={0}
                    onClick={() => navigate(`/admin/portal-crm/ventas/contactos/${c.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/admin/portal-crm/ventas/contactos/${c.id}`); } }}
                    className="border-t border-border hover:bg-muted/50 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40 transition-colors duration-150 group"
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}><Checkbox /></td>
                    {visibleColumns.map((col) => {
                      switch (col.id) {
                        case "name":
                          return (
                            <td key={col.id} className="p-3 font-medium whitespace-nowrap"
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/portal-crm/ventas/contactos/${c.id}`); }}>
                              <span className="inline-flex items-center gap-2.5 max-w-[260px]">
                                <span className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0 ring-1 ring-primary/15">
                                  {c.full_name.charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate text-foreground group-hover:text-primary transition-colors">{c.full_name}</span>
                              </span>
                            </td>
                          );
                        case "categoria":
                          return (
                            <td key={col.id} className="p-3">
                              {c.categoria_ids?.length ? (
                                <span className="flex flex-wrap gap-1">
                                  {c.categoria_ids.map((cid) => (
                                    <span key={cid} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap">
                                      {catNameMap[cid] ?? "—"}
                                    </span>
                                  ))}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        case "email":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.email || "—"}</td>;
                        case "phone":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap tabular-nums">{c.phone || "—"}</td>;
                        case "lead_status": {
                          const st = leadStates.find((s) => s.value === c.lead_status);
                          const metaLabel = st?.label ?? leadStatusLabel[c.lead_status] ?? c.lead_status;
                          const statusColor: Record<string, string> = {
                            nuevo: "bg-sky-50 text-sky-700 border-sky-200",
                            en_curso: "bg-amber-50 text-amber-700 border-amber-200",
                            negocio_abierto: "bg-emerald-50 text-emerald-700 border-emerald-200",
                            conectado: "bg-primary/5 text-primary border-primary/20",
                            sin_calificar: "bg-slate-50 text-slate-500 border-slate-200",
                            intento_contacto: "bg-orange-50 text-orange-700 border-orange-200",
                            programo_cita: "bg-teal-50 text-teal-700 border-teal-200",
                            asistio_cita: "bg-green-50 text-green-700 border-green-200",
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
                          // Color configurable (hex de crm_estados_lead) vía estilo inline;
                          // si el estado no trae color, cae al mapa de clases de siempre.
                          const badgeStyle = st?.color
                            ? { backgroundColor: `${st.color}1a`, color: st.color, borderColor: `${st.color}55` }
                            : undefined;
                          const cls = st?.color ? "" : (statusColor[c.lead_status] ?? "bg-slate-50 text-slate-500 border-slate-200");
                          return (
                            <td key={col.id} className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`} style={badgeStyle}>{metaLabel}</span>
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
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.owner_name ?? "Sin asignar"}</td>;
                        case "created":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap tabular-nums">{c.created_at ? fmtDate(c.created_at) : "—"}</td>;
                        case "updated":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap tabular-nums">{c.last_activity_at ? fmtDate(c.last_activity_at) : "—"}</td>;
                        case "source":
                          return (
                            <td key={col.id} className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.source_platform ? "bg-primary/5 text-primary border-primary/20" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                {c.source_platform ? "Por form" : "Manual"}
                              </span>
                            </td>
                          );
                        case "meta_form_name":
                          return (
                            <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">
                              {c.meta_form_name ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                  {c.meta_form_name}
                                </span>
                              ) : "—"}
                            </td>
                          );
                        case "meta_campaign_id":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap font-mono text-xs">{c.meta_campaign_id || "—"}</td>;
                        case "meta_ad_id":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap font-mono text-xs">{c.meta_ad_id || "—"}</td>;
                        case "meta_platform":
                          return (
                            <td key={col.id} className="p-3 whitespace-nowrap">
                              {c.meta_platform ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/5 text-primary border border-primary/20 uppercase">
                                  {c.meta_platform}
                                </span>
                              ) : "—"}
                            </td>
                          );
                        case "meta_created_time":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.meta_created_time ? fmtDate(c.meta_created_time) : "—"}</td>;
                        case "meta_field_data": {
                          const count = Array.isArray(c.meta_field_data) ? c.meta_field_data.length : 0;
                          return (
                            <td key={col.id} className="p-3 whitespace-nowrap">
                              {count > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium">
                                  {count} {count === 1 ? "respuesta" : "respuestas"}
                                </span>
                              ) : "—"}
                            </td>
                          );
                        }
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
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", development_id: "", source_platform: "manual", source_name: "Manual", lifecycle_stage: "lead", lead_status: "nuevo", categoria: "", contact_owner: "" });
  const { data: catalog = [] } = useQuery({ queryKey: ["crm-categorias"], queryFn: fetchCrmCategorias });
  const { data: owners = [] } = useQuery({ queryKey: ["crm-owners"], queryFn: fetchCrmOwners });
  const { data: leadStates = META_LEAD_STATUSES } = useLeadStates();
  // Auto-asignar el propietario al usuario actual (editable antes de crear).
  useEffect(() => {
    const uid = user?.id;
    if (uid) setForm((f) => (f.contact_owner ? f : { ...f, contact_owner: uid }));
  }, [user?.id]);

  const submit = async () => {
    if (!form.full_name) return;
    const email = form.email.trim();
    const phone = form.phone.trim();
    // Validación acorde a los CHECK de la tabla personas (evita error crudo de BD).
    if (email && !PERSONA_EMAIL_RE.test(email)) { toast.error(MSG_EMAIL_INVALIDO); return; }
    if (phone && !PERSONA_PHONE_RE.test(phone)) { toast.error(MSG_TELEFONO_INVALIDO); return; }
    setBusy(true);
    try {
      // 1. Persona (datos de contacto)
      const { data: persona, error: pErr } = await (supabase as any).from("personas").insert({
        tipo_persona: "pf",
        nombre_legal: form.full_name,
        email: email || null,
        telefono: phone || null,
      }).select("id").single();
      if (pErr) throw pErr;
      // 2. Entidad relacionada (prospecto tipo 7)
      const { data: er, error: eErr } = await (supabase as any).from("entidades_relacionadas").insert({
        id_persona: persona.id,
        id_tipo_entidad: 7,
        id_proyecto: form.development_id ? Number(form.development_id) : null,
      }).select("id").single();
      if (eErr) throw eErr;
      // 3. Estado del CRM (best-effort: si la tabla aún no existe, el contacto igual queda creado)
      const { error: aErr } = await (supabase as any).from("crm_leads_atribucion").insert({
        id_entidad_relacionada: er.id,
        estatus_lead: form.lead_status,
        etapa_ciclo_vida: form.lifecycle_stage,
        id_propietario: form.contact_owner || user?.id || null,
      });
      if (aErr) console.warn("crm_leads_atribucion no disponible:", aErr.message);
      // 4. Categoría (procedencia) seleccionada (best-effort: si la tabla aún no existe, el contacto igual queda creado)
      if (form.categoria) {
        const { error: cErr } = await (supabase as any).from("entidades_relacionadas_categorias")
          .insert({ id_entidad_relacionada: er.id, id_categoria: Number(form.categoria), activo: true });
        if (cErr) console.warn("crm_categorias no disponible:", cErr.message);
      }
      toast.success("Contacto creado");
      setOpen(false);
      setForm({ ...form, full_name: "", email: "", phone: "", categoria: "" });
      onCreated();
    } catch (e: any) {
      toast.error(mensajeErrorContacto(e));
    } finally {
      setBusy(false);
    }
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
          {catalog.length > 0 && (
            <CField label="Categoría">
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>{catalog.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </CField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <CField label="Estado del lead">
              <Select value={form.lead_status} onValueChange={(v) => setForm({ ...form, lead_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{leadStates.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </CField>
            <CField label="Lifecycle">
              <Select value={form.lifecycle_stage} onValueChange={(v) => setForm({ ...form, lifecycle_stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(lifecycleLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </CField>
          </div>
          <CField label="Propietario del contacto">
            <Select value={form.contact_owner} onValueChange={(v) => setForm({ ...form, contact_owner: v })}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>{(owners as CrmOwner[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
            </Select>
          </CField>
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
  return <div className="grid gap-1.5"><Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

// ─── Contact detail ───────────────────────────────────────────────────────────


// ─── Rich Note Editor ─────────────────────────────────────────────────────────


export function CrmContactDetail() {
  const { contactId } = useParams<{ contactId: string }>();
  const orgId = useCrmOrgId();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Solo en esta vista: acotar el <main> del layout al alto visible exacto para que
  // NO haya scroll de ventana y cada panel de la ficha scrollee por su cuenta (estilo HubSpot).
  // Se restaura al desmontar, así no afecta a las demás páginas del CRM.
  useEffect(() => {
    const el = document.querySelector("main") as HTMLElement | null;
    const bodyPrev = document.body.style.overflow;
    const htmlPrev = document.documentElement.style.overflow;
    const prev = el ? { height: el.style.height, minHeight: el.style.minHeight, padding: el.style.padding, overflow: el.style.overflow } : null;
    const apply = () => {
      // Bloquear el scroll de la ventana (mata el sobrante del banner + min-h-screen del shell).
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      if (el) {
        window.scrollTo(0, 0);
        const top = el.getBoundingClientRect().top; // banner + header, medido en runtime
        el.style.height = `${window.innerHeight - top}px`;
        el.style.minHeight = "0";
        el.style.padding = "0";
        el.style.overflow = "hidden";
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      document.documentElement.style.overflow = htmlPrev;
      document.body.style.overflow = bodyPrev;
      if (el && prev) { el.style.height = prev.height; el.style.minHeight = prev.minHeight; el.style.padding = prev.padding; el.style.overflow = prev.overflow; }
    };
  }, []);

  const { data: contact, isLoading, error: contactError } = useQuery({
    queryKey: ["contact-sozu", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const erId = Number(contactId);
      const { data: er } = await (supabase as any).from("entidades_relacionadas")
        .select("id, id_persona, id_proyecto, id_tipo_entidad, fecha_creacion, fecha_actualizacion")
        .eq("id", erId).maybeSingle();
      if (!er) return null;
      const { data: p } = await (supabase as any).from("personas")
        .select("id, nombre_legal, nombre_comercial, email, telefono")
        .eq("id", er.id_persona).maybeSingle();
      if (!p) return null;
      // Atribución / estado del CRM (opcional: la tabla puede no existir aún).
      let a: any = null;
      const atrRes = await (supabase as any).from("crm_leads_atribucion")
        .select("*").eq("id_entidad_relacionada", erId).eq("activo", true).maybeSingle();
      if (!atrRes.error) a = atrRes.data;
      return {
        id: String(er.id),
        id_persona: er.id_persona,
        full_name: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
        email: p.email ?? null,
        phone: p.telefono ?? null,
        development_id: er.id_proyecto ? String(er.id_proyecto) : null,
        lead_status: a?.estatus_lead ?? "nuevo",
        lifecycle_stage: a?.etapa_ciclo_vida ?? (er.id_tipo_entidad === 2 ? "customer" : "lead"),
        source_platform: a?.meta_platform ?? null,
        source_name: a?.meta_form_name ?? null,
        contact_owner: a?.id_propietario ?? null,
        last_activity_at: er.fecha_actualizacion ?? null,
        next_task_at: null, lead_score: 0,
        created_at: er.fecha_creacion ?? new Date().toISOString(),
        meta_form_name: a?.meta_form_name ?? null,
        meta_campaign_id: a?.meta_campaign_id ?? null,
        meta_ad_id: a?.meta_ad_id ?? null,
        meta_platform: a?.meta_platform ?? null,
        meta_created_time: a?.meta_created_time ?? null,
        buying_intent: null, score: null,
      };
    },
  });

  const { data: developments } = useQuery({
    queryKey: ["proyectos-list"],
    queryFn: async () => {
      // Solo proyectos SOZU: proyectos con relación de entidad SOZU (id_tipo_entidad=5) y publicados.
      const { data: rels } = await (supabase as any).from("entidades_relacionadas")
        .select("id_proyecto").eq("id_tipo_entidad", 5).eq("activo", true).not("id_proyecto", "is", null);
      const ids = Array.from(new Set((rels ?? []).map((r: any) => r.id_proyecto)));
      if (!ids.length) return [];
      const { data } = await (supabase as any).from("proyectos")
        .select("id,nombre").in("id", ids).eq("activo", true).eq("publicar", true).order("nombre");
      return (data ?? []).map((p: any) => ({ id: String(p.id), name: p.nombre }));
    },
  });

  const { data: owners } = useQuery({ queryKey: ["crm-owners"], queryFn: fetchCrmOwners });

  const { data: notes } = useQuery({
    queryKey: ["contact-notes", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_notas")
        .select("id, contenido, fecha_actividad, fecha_creacion, id_usuario, anclado")
        .eq("id_entidad_relacionada", Number(contactId)).eq("activo", true)
        .order("anclado", { ascending: false })
        .order("fecha_creacion", { ascending: false });
      if (res.error) return [];
      const rows = res.data ?? [];
      // Resolver nombre del autor (lectura a usuarios).
      const authorIds = Array.from(new Set(rows.map((n: any) => n.id_usuario).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (authorIds.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", authorIds);
        nameMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }
      // Adjuntos por nota (best-effort: {} si la tabla aún no existe en el ambiente).
      const attByNote = await fetchNoteAttachments(rows.map((n: any) => n.id));
      return rows.map((n: any) => ({ id: n.id, content: n.contenido, created_at: n.fecha_creacion, author: n.id_usuario ? (nameMap[n.id_usuario] ?? null) : null, anclado: n.anclado ?? false, attachments: attByNote[n.id] ?? [] }));
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["contact-tasks", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_tareas")
        .select("id, titulo, tipo, prioridad, estatus, descripcion, fecha_vencimiento, fecha_recordatorio, recurrencia, fecha_creacion, id_entidad_relacionada, id_usuario_asignado")
        .eq("id_entidad_relacionada", Number(contactId)).eq("activo", true)
        .order("fecha_vencimiento", { ascending: true });
      if (res.error) return [];
      return (res.data ?? []).map((t: any) => ({
        id: t.id, title: t.titulo, status: t.estatus, priority: t.prioridad,
        due_date: t.fecha_vencimiento, created_at: t.fecha_creacion,
        descripcion: t.descripcion ?? null, recurrencia: t.recurrencia ?? null,
        // Campos crudos para regenerar la recurrencia al completar.
        raw: {
          recurrencia: t.recurrencia ?? null, fecha_vencimiento: t.fecha_vencimiento,
          fecha_recordatorio: t.fecha_recordatorio ?? null,
          id_entidad_relacionada: t.id_entidad_relacionada, id_usuario_asignado: t.id_usuario_asignado ?? null,
          titulo: t.titulo, tipo: t.tipo, prioridad: t.prioridad, descripcion: t.descripcion ?? null,
        },
      }));
    },
  });

  // Citas del contacto (tabla real crm_citas; fail-soft si aún no existe en el ambiente).
  const { data: citas } = useQuery({
    queryKey: ["contact-citas", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_citas")
        .select("id, titulo, tipo, estatus, fecha_inicio, fecha_fin, ubicacion, enlace_reunion, resultado, descripcion, fecha_recordatorio, fecha_creacion, id_entidad_relacionada, id_usuario_asignado")
        .eq("id_entidad_relacionada", Number(contactId)).eq("activo", true)
        .order("fecha_inicio", { ascending: false });
      if (res.error) return [];
      return (res.data ?? []).map((c: any) => ({
        id: c.id, title: c.titulo, tipo: c.tipo, status: c.estatus,
        start_at: c.fecha_inicio, end_at: c.fecha_fin,
        ubicacion: c.ubicacion ?? null, enlace: c.enlace_reunion ?? null,
        resultado: c.resultado ?? null, descripcion: c.descripcion ?? null,
        created_at: c.fecha_creacion,
      }));
    },
  });

  // Negocios del contacto (un negocio pertenece a un solo contacto).
  const { data: contactDeals } = useQuery({
    queryKey: ["contact-deals", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data: negocios, error } = await (supabase as any).from("crm_negocios")
        .select("id, nombre, valor, moneda, id_pipeline, id_etapa, prioridad")
        .eq("id_entidad_relacionada", Number(contactId)).eq("activo", true)
        .order("fecha_creacion", { ascending: false });
      if (error || !negocios?.length) return [];
      const etapaIds = Array.from(new Set(negocios.map((n: any) => n.id_etapa).filter(Boolean)));
      const pipeIds = Array.from(new Set(negocios.map((n: any) => n.id_pipeline).filter(Boolean)));
      const [etRes, pRes] = await Promise.all([
        etapaIds.length ? (supabase as any).from("crm_pipeline_etapas").select("id, nombre").in("id", etapaIds) : Promise.resolve({ data: [] }),
        pipeIds.length ? (supabase as any).from("crm_pipelines").select("id, nombre").in("id", pipeIds) : Promise.resolve({ data: [] }),
      ]);
      const etapaMap = Object.fromEntries((etRes.data ?? []).map((e: any) => [e.id, e.nombre]));
      const pipeMap = Object.fromEntries((pRes.data ?? []).map((p: any) => [p.id, p.nombre]));
      return negocios.map((n: any) => ({
        ...n,
        etapa_nombre: etapaMap[n.id_etapa] ?? "—",
        pipeline_nombre: n.id_pipeline ? (pipeMap[n.id_pipeline] ?? null) : null,
      }));
    },
  });

  // Fase 1: pipeline y eventos de conversión aún no persisten.
  const deals: any[] = [];
  const pipelineEvents: any[] = [];
  const conversionEvents: any[] = [];

  const invalidateAll = () => {
    ["contact-sozu", "contact-notes", "contact-tasks", "contact-citas", "contact-deals"].forEach(
      (k) => qc.invalidateQueries({ queryKey: [k, contactId] }),
    );
    // También refrescar la lista de contactos para que refleje los cambios al volver.
    qc.invalidateQueries({ queryKey: ["contacts-sozu"] });
  };

  const completeTask = async (id: number) => {
    const { error } = await (supabase as any).from("crm_tareas").update({ estatus: "completada" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    // Si la tarea es recurrente, genera la siguiente ocurrencia.
    const done = (tasks ?? []).find((t: any) => t.id === id);
    if (done?.raw?.recurrencia && done.raw.fecha_vencimiento) {
      await regenerateRecurringTask(done.raw);
      toast.success("Tarea completada · se generó la siguiente");
    } else {
      toast.success("Tarea completada");
    }
    invalidateAll();
  };
  const deleteTask = async (id: number) => {
    const { error } = await (supabase as any).from("crm_tareas").update({ activo: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarea eliminada"); invalidateAll();
  };
  const deleteNote = async (id: number) => {
    const { error } = await (supabase as any).from("crm_notas").update({ activo: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Nota eliminada"); invalidateAll();
  };
  const updateCitaStatus = async (id: number, estatus: string) => {
    const { error } = await (supabase as any).from("crm_citas").update({ estatus }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cita actualizada"); invalidateAll();
  };
  const deleteCita = async (id: number) => {
    const { error } = await (supabase as any).from("crm_citas").update({ activo: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cita eliminada"); invalidateAll();
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-3 border-b border-border bg-card shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/5 -ml-2 transition-colors" asChild>
            <Link to="/admin/portal-crm/ventas/contactos"><ArrowLeft className="h-4 w-4 mr-1.5" />Contactos</Link>
          </Button>
          <span className="text-muted-foreground/40 text-sm">/</span>
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{contact.full_name}</span>
        </div>
        <div className="flex gap-2">
          <NoteDialog contactId={contactId!} userId={user?.id} onSaved={invalidateAll} />
          <TaskDialog contactId={contactId!} owners={owners ?? []} userId={user?.id} onSaved={invalidateAll} />
          <CitaDialog contactId={contactId!} owners={owners ?? []} userId={user?.id} onSaved={invalidateAll} />
        </div>
      </div>

      {/* 3-column body — llena el alto restante; cada columna scrollea por su cuenta (estilo HubSpot) */}
      <div className="grid grid-cols-12 flex-1 min-h-0 overflow-hidden">
        {/* Left: profile + info */}
        <aside className="col-span-3 border-r border-border p-5 space-y-5 bg-white h-full min-h-0 overflow-y-auto">
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
          <div className="grid grid-cols-3 gap-1">
            <NoteDialog contactId={contactId!} userId={user?.id} onSaved={invalidateAll}
              trigger={
                <button className="flex flex-col items-center gap-1 p-1.5 rounded-md hover:bg-primary/5 transition-colors w-full">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <StickyNote className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[9px] text-muted-foreground leading-none">Nota</span>
                </button>
              } />
            <TaskDialog contactId={contactId!} owners={owners ?? []} userId={user?.id} onSaved={invalidateAll}
              trigger={
                <button className="flex flex-col items-center gap-1 p-1.5 rounded-md hover:bg-primary/5 transition-colors w-full">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <ClipboardList className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[9px] text-muted-foreground leading-none">Tarea</span>
                </button>
              } />
            <CitaDialog contactId={contactId!} owners={owners ?? []} userId={user?.id} onSaved={invalidateAll}
              trigger={
                <button className="flex flex-col items-center gap-1 p-1.5 rounded-md hover:bg-primary/5 transition-colors w-full">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CalendarClock className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[9px] text-muted-foreground leading-none">Cita</span>
                </button>
              } />
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
        <section className="col-span-6 border-r border-border h-full min-h-0 overflow-hidden">
          <Tabs defaultValue="descripcion" className="flex flex-col h-full min-h-0">
            <div className="border-b border-border shrink-0">
              <TabsList className="justify-start rounded-none bg-transparent h-auto px-4 gap-0">
                <TabsTrigger value="descripcion" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Descripción</TabsTrigger>
                <TabsTrigger value="actividades" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Actividades</TabsTrigger>
                <TabsTrigger value="avanzado" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Información avanzada</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="descripcion" className="p-4 mt-0 flex-1 min-h-0 overflow-y-auto">
              <DescriptionPanel
                contact={contact} notes={notes ?? []} tasks={tasks ?? []} citas={citas ?? []} onSaved={invalidateAll}
                onCompleteTask={completeTask} onDeleteTask={deleteTask} onDeleteNote={deleteNote}
                onUpdateCita={updateCitaStatus} onDeleteCita={deleteCita}
              />
            </TabsContent>
            <TabsContent value="actividades" className="p-4 mt-0 flex-1 min-h-0 overflow-y-auto">
              <ActivityPanel
                contactId={contactId!} userId={user?.id} owners={owners ?? []} contact={contact}
                notes={notes ?? []} tasks={tasks ?? []} citas={citas ?? []} onSaved={invalidateAll}
                onCompleteTask={completeTask} onDeleteTask={deleteTask} onDeleteNote={deleteNote}
                onUpdateCita={updateCitaStatus} onDeleteCita={deleteCita}
              />
            </TabsContent>
            <TabsContent value="avanzado" className="p-4 mt-0 flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-2 text-sm">
                {!contact.meta_platform && !contact.meta_campaign_id && !contact.meta_ad_id && !contact.meta_form_name ? (
                  <p className="text-muted-foreground">Sin datos de atribución de Meta para este contacto.</p>
                ) : (
                  <>
                    <ARow label="Plataforma" v={contact.meta_platform} />
                    <ARow label="Formulario" v={contact.meta_form_name} />
                    <ARow label="Campaña (Meta)" v={contact.meta_campaign_id} mono />
                    <ARow label="Anuncio (Meta)" v={contact.meta_ad_id} mono />
                    <ARow label="Fecha lead (Meta)" v={contact.meta_created_time ? fmtDate(contact.meta_created_time) : null} />
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* Right: related entities */}
        <aside className="col-span-3 p-4 bg-slate-50/40 h-full min-h-0 overflow-y-auto">
          <Accordion type="multiple" defaultValue={["empresas", "deals", "tickets"]}>
            <AccordionItem value="empresas">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Empresas <span className="text-xs text-muted-foreground font-normal">0</span></span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground py-2">Sin empresas asociadas</p>
              </AccordionContent>
            </AccordionItem>

            <DealsCard contactId={contactId!} deals={contactDeals ?? []} onSaved={invalidateAll} />

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
    lead_status: contact.lead_status ?? "nuevo", lifecycle_stage: contact.lifecycle_stage ?? "lead",
    development_id: contact.development_id ?? "", contact_owner: contact.contact_owner ?? "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const { data: leadStates = META_LEAD_STATUSES } = useLeadStates();

  // Auto-guardado: cada campo persiste al cambiar (selects) o al salir del campo (texto).
  const run = async (fn: () => Promise<{ error: any }>) => {
    setStatus("saving");
    try {
      const { error } = await fn();
      if (error) throw error;
      setStatus("saved");
      onSaved();
    } catch (e: any) {
      setStatus("error");
      toast.error(mensajeErrorContacto(e));
    }
  };

  const persistPersona = () => {
    if (!contact.id_persona) return;
    const email = (form.email || "").trim();
    const phone = (form.phone || "").trim();
    if (email && !PERSONA_EMAIL_RE.test(email)) { setStatus("error"); toast.error(MSG_EMAIL_INVALIDO); return; }
    if (phone && !PERSONA_PHONE_RE.test(phone)) { setStatus("error"); toast.error(MSG_TELEFONO_INVALIDO); return; }
    run(() => (supabase as any).from("personas").update({
      email: email || null,
      telefono: phone || null,
      fecha_actualizacion: new Date().toISOString(),
    }).eq("id", contact.id_persona));
  };

  const persistProyecto = (value: string) =>
    run(() => (supabase as any).from("entidades_relacionadas").update({
      id_proyecto: value ? Number(value) : null,
      fecha_actualizacion: new Date().toISOString(),
    }).eq("id", Number(contact.id)));

  const persistAtribucion = (override: { lead_status?: string; lifecycle_stage?: string; contact_owner?: string }) =>
    run(() => (supabase as any).from("crm_leads_atribucion").upsert({
      id_entidad_relacionada: Number(contact.id),
      estatus_lead: override.lead_status ?? form.lead_status,
      etapa_ciclo_vida: override.lifecycle_stage ?? form.lifecycle_stage,
      id_propietario: (override.contact_owner ?? form.contact_owner) || null,
    }, { onConflict: "id_entidad_relacionada" }));

  return (
    <div className="space-y-3 text-sm">
      {contact.id ? <ContactCategories contactId={Number(contact.id)} /> : null}
      <CField label="Correo electrónico">
        <Input className="h-8 text-sm" type="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          onBlur={persistPersona} placeholder="correo@ejemplo.com" />
      </CField>
      <CField label="Número de móvil">
        <Input className="h-8 text-sm" type="tel" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          onBlur={persistPersona} placeholder="+52 55 0000 0000" />
      </CField>
      <CField label="Proyecto">
        <Select value={form.development_id} onValueChange={(v) => { setForm({ ...form, development_id: v }); persistProyecto(v); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
          <SelectContent>{(developments as any[]).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      </CField>
      <CField label="Estado del lead">
        <Select value={form.lead_status} onValueChange={(v) => { setForm({ ...form, lead_status: v }); persistAtribucion({ lead_status: v }); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {leadStates.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </CField>
      <CField label="Etapa del ciclo de vida">
        <Select value={form.lifecycle_stage} onValueChange={(v) => { setForm({ ...form, lifecycle_stage: v }); persistAtribucion({ lifecycle_stage: v }); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(lifecycleLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </CField>
      <CField label="Propietario del contacto">
        <Select value={form.contact_owner} onValueChange={(v) => { setForm({ ...form, contact_owner: v }); persistAtribucion({ contact_owner: v }); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
          <SelectContent>{(owners as any[]).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
        </Select>
      </CField>
      <div className="h-5 flex items-center justify-end text-xs pt-0.5">
        {status === "saving" && <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Guardando…</span>}
        {status === "saved" && <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-3 w-3" />Guardado</span>}
        {status === "error" && <span className="inline-flex items-center gap-1 text-destructive"><TriangleAlert className="h-3 w-3" />No se guardó</span>}
      </div>
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



function HL({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function AssocCard({ title }: { title: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">Próximamente</span>
      </div>
      <p className="text-xs text-muted-foreground">No hay {title.toLowerCase()} asociados.</p>
    </div>
  );
}

function DescriptionPanel({ contact, notes, tasks, citas = [], onSaved, onCompleteTask, onDeleteTask, onDeleteNote, onUpdateCita, onDeleteCita }: any) {
  const lastActivity = (() => {
    const dates: string[] = [
      ...(notes ?? []).map((n: any) => n.created_at),
      ...(tasks ?? []).map((t: any) => t.created_at),
      ...(citas ?? []).map((c: any) => c.created_at),
    ].filter(Boolean);
    if (contact.last_activity_at) dates.push(contact.last_activity_at);
    if (!dates.length) return null;
    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  })();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = (tasks ?? [])
    .filter((t: any) => t.status !== "completada" && t.due_date && new Date(t.due_date) >= today)
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const upcomingCitas = (citas ?? [])
    .filter((c: any) => (c.status === "programada" || c.status === "reprogramada") && c.start_at && new Date(c.start_at) >= today)
    .sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return (
    <div className="space-y-4">
      {/* Aspectos destacados de los datos */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Aspectos destacados de los datos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <HL label="Fecha de creación" value={contact.created_at ? fmtDateTime(contact.created_at) : "—"} />
          <HL label="Etapa del ciclo de vida" value={lifecycleLabel[contact.lifecycle_stage] ?? contact.lifecycle_stage ?? "—"} />
          <HL label="Última actividad" value={lastActivity ? fmtDate(lastActivity) : "—"} />
        </div>
      </div>

      {/* Actividades recientes */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Actividades recientes</h3>
        <Timeline
          notes={notes ?? []} tasks={tasks ?? []} citas={citas ?? []} deals={[]} pipelineEvents={[]} conversionEvents={[]}
          contact={contact}
          onCompleteTask={onCompleteTask} onDeleteTask={onDeleteTask} onDeleteNote={onDeleteNote}
          onUpdateCita={onUpdateCita} onDeleteCita={onDeleteCita} onEdited={onSaved}
        />
      </div>

      {/* Próximas actividades (tareas y citas pendientes con fecha futura) */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Próximas actividades</h3>
        {!upcoming.length && !upcomingCitas.length ? (
          <p className="text-xs text-muted-foreground">Sin próximas actividades.</p>
        ) : (
          <div className="space-y-2">
            {upcomingCitas.map((c: any) => {
              const TipoIcon = CITA_TYPE_META[c.tipo]?.icon ?? CalendarClock;
              return (
                <div key={`cita-${c.id}`} className="flex items-center gap-3 group/up">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-400 flex items-center justify-center">
                    <TipoIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtCitaWhen(c.start_at, c.end_at)}</div>
                  </div>
                  <button onClick={() => onUpdateCita?.(c.id, "realizada")} className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 opacity-0 group-hover/up:opacity-100 transition-opacity shrink-0">
                    <Check className="h-3 w-3" />Realizada
                  </button>
                </div>
              );
            })}
            {upcoming.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 group/up">
                <div className="h-7 w-7 shrink-0 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                  <ClipboardList className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">Pendiente: {fmtDate(t.due_date)}</div>
                </div>
                <button onClick={() => onCompleteTask?.(t.id)} className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 opacity-0 group-hover/up:opacity-100 transition-opacity shrink-0">
                  <Check className="h-3 w-3" />Completar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Objetos asociados — fase posterior */}
      <AssocCard title="Suscripciones" />
      <AssocCard title="Pagos" />
      <AssocCard title="Pedidos" />
    </div>
  );
}






// ─── Negocios en la ficha del contacto (estilo HubSpot) ───────────────────────

// Formatea un monto con su moneda; cae a fmtMXN si la moneda no es válida.

// Tarjeta lateral "Negocios (N)" con lista de negocios asociados + botón Agregar.
function DealsCard({ contactId, deals, onSaved }: { contactId: string; deals: any[]; onSaved: () => void }) {
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
function CreateDealDialog({ contactId, onSaved, trigger }: { contactId: string; onSaved: () => void; trigger?: React.ReactNode }) {
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
function NewDealForm({ contactId, userId, onDone, onCancel }: { contactId: string; userId?: string; onDone: (close: boolean) => void; onCancel: () => void }) {
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
function ExistingDealForm({ contactId, onDone, onCancel }: { contactId: string; onDone: () => void; onCancel: () => void }) {
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
function NewDealDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
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

// ─── Negocios (vista general, estilo HubSpot) ─────────────────────────────────

function DealMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-1">{value}</p>
    </div>
  );
}

// Colores de columna del tablero (etapas dinámicas): ganado=verde, perdido=rojo,
// el resto cicla una paleta por índice.

export function CrmDeals() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "board">("board");
  const [pipelineFilter, setPipelineFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [boardPipeline, setBoardPipeline] = useState<string>("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());
  const [manualCols, setManualCols] = useState<Set<number>>(new Set());
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data: pipelines } = useQuery({
    queryKey: ["deals-pipelines"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipelines").select("id, nombre").eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });

  const { data: owners } = useQuery({ queryKey: ["crm-owners"], queryFn: fetchCrmOwners });

  // Se traen TODOS los negocios (filtrando por propietario/búsqueda en servidor); el
  // filtro de pipeline se aplica en cliente para que la Lista y el Tablero compartan datos.
  const dealsKey = ["deals-list", ownerFilter, search.trim()];
  const { data, isLoading } = useQuery({
    queryKey: dealsKey,
    queryFn: async () => {
      let q = (supabase as any).from("crm_negocios")
        .select("id, nombre, valor, moneda, id_pipeline, id_etapa, id_usuario_propietario, fecha_cierre_estimada, id_entidad_relacionada, tipo_negocio, prioridad, fecha_creacion")
        .eq("activo", true).order("fecha_creacion", { ascending: false }).limit(1000);
      if (ownerFilter !== "all") q = q.eq("id_usuario_propietario", ownerFilter);
      if (search.trim()) q = q.ilike("nombre", `%${search.trim()}%`);
      const { data: negocios, error } = await q;
      if (error) throw error;
      const list = negocios ?? [];
      if (!list.length) return { rows: [], truncated: false };

      const etapaIds = Array.from(new Set(list.map((n: any) => n.id_etapa).filter(Boolean)));
      const pipeIds = Array.from(new Set(list.map((n: any) => n.id_pipeline).filter(Boolean)));
      const ownerIds = Array.from(new Set(list.map((n: any) => n.id_usuario_propietario).filter(Boolean)));
      const erIds = Array.from(new Set(list.map((n: any) => n.id_entidad_relacionada).filter(Boolean)));

      const [etRes, pRes, oRes, erRes] = await Promise.all([
        etapaIds.length ? (supabase as any).from("crm_pipeline_etapas").select("id, nombre, probabilidad, es_ganado, es_perdido").in("id", etapaIds) : Promise.resolve({ data: [] }),
        pipeIds.length ? (supabase as any).from("crm_pipelines").select("id, nombre").in("id", pipeIds) : Promise.resolve({ data: [] }),
        ownerIds.length ? (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", ownerIds) : Promise.resolve({ data: [] }),
        erIds.length ? (supabase as any).from("entidades_relacionadas").select("id, id_persona").in("id", erIds) : Promise.resolve({ data: [] }),
      ]);
      const etapaMap = new Map((etRes.data ?? []).map((e: any) => [e.id, e]));
      const pipeMap = new Map((pRes.data ?? []).map((p: any) => [p.id, p.nombre]));
      const ownerMap = new Map((oRes.data ?? []).map((o: any) => [o.auth_user_id, o.nombre]));

      const personaIds = Array.from(new Set((erRes.data ?? []).map((e: any) => e.id_persona).filter(Boolean)));
      let personaMap = new Map<number, string>();
      if (personaIds.length) {
        const { data: ps } = await (supabase as any).from("personas").select("id, nombre_legal, nombre_comercial").in("id", personaIds);
        personaMap = new Map((ps ?? []).map((p: any) => [p.id, (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim()]));
      }
      const erMap = new Map((erRes.data ?? []).map((e: any) => [e.id, personaMap.get(e.id_persona) ?? null]));

      const rows = list.map((n: any) => {
        const et: any = etapaMap.get(n.id_etapa);
        return {
          ...n,
          etapa_nombre: et?.nombre ?? "—",
          probabilidad: et ? Number(et.probabilidad) : 0,
          es_ganado: !!et?.es_ganado,
          es_perdido: !!et?.es_perdido,
          pipeline_nombre: pipeMap.get(n.id_pipeline) ?? "—",
          propietario_nombre: n.id_usuario_propietario ? (ownerMap.get(n.id_usuario_propietario) ?? "—") : "—",
          contacto_nombre: n.id_entidad_relacionada ? (erMap.get(n.id_entidad_relacionada) ?? null) : null,
        };
      });
      return { rows, truncated: list.length === 1000 };
    },
  });

  const rows: any[] = data?.rows ?? [];

  // Pipeline efectivo del tablero: el elegido o, por defecto, el primero.
  const effectiveBoardPipeline = boardPipeline || (pipelines?.[0] ? String(pipelines[0].id) : "");

  const { data: boardEtapas } = useQuery({
    queryKey: ["deals-board-etapas", effectiveBoardPipeline],
    enabled: view === "board" && !!effectiveBoardPipeline,
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipeline_etapas")
        .select("id, nombre, orden, probabilidad, es_ganado, es_perdido")
        .eq("id_pipeline", Number(effectiveBoardPipeline)).eq("activo", true).order("orden");
      return (data ?? []) as any[];
    },
  });

  const listRows = useMemo(
    () => (pipelineFilter === "all" ? rows : rows.filter((r) => String(r.id_pipeline) === pipelineFilter)),
    [rows, pipelineFilter],
  );
  const boardRows = useMemo(
    () => rows.filter((r) => String(r.id_pipeline) === effectiveBoardPipeline),
    [rows, effectiveBoardPipeline],
  );
  const activeRows = view === "board" ? boardRows : listRows;

  // Auto-colapsa columnas vacías (salvo alternadas a mano). Si el pipeline no tiene
  // ningún negocio, deja todo expandido para ver el embudo completo.
  useEffect(() => {
    if (view !== "board" || !boardEtapas) return;
    const anyDeals = boardRows.length > 0;
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      let changed = false;
      boardEtapas.forEach((et: any) => {
        if (manualCols.has(et.id)) return;
        const shouldCollapse = anyDeals && !boardRows.some((r) => r.id_etapa === et.id);
        if (shouldCollapse && !next.has(et.id)) { next.add(et.id); changed = true; }
        if (!shouldCollapse && next.has(et.id)) { next.delete(et.id); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [boardEtapas, boardRows, manualCols, view]);

  const toggleCol = (id: number) => {
    setManualCols((prev) => new Set(prev).add(id));
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const metrics = useMemo(() => {
    let total = 0, ponderada = 0, abierto = 0, ganado = 0;
    for (const r of activeRows) {
      const v = Number(r.valor ?? 0);
      total += v;
      ponderada += v * (Number(r.probabilidad ?? 0) / 100);
      if (!r.es_ganado && !r.es_perdido) abierto += v;
      if (r.es_ganado) ganado += v;
    }
    return { total, ponderada, abierto, ganado };
  }, [activeRows]);

  const activeDeal = rows.find((r) => r.id === activeId) ?? null;

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const dealId = Number(e.active.id);
    const targetEtapa = e.over ? Number(e.over.id) : null;
    if (!targetEtapa) return;
    const deal = rows.find((r) => r.id === dealId);
    if (!deal || deal.id_etapa === targetEtapa) return;
    const targetEt: any = (boardEtapas ?? []).find((et: any) => et.id === targetEtapa);

    // Optimista: mueve la tarjeta ya en la UI.
    qc.setQueryData(dealsKey, (old: any) => old ? {
      ...old,
      rows: old.rows.map((r: any) => r.id === dealId ? {
        ...r, id_etapa: targetEtapa,
        etapa_nombre: targetEt?.nombre ?? r.etapa_nombre,
        probabilidad: targetEt ? Number(targetEt.probabilidad) : r.probabilidad,
        es_ganado: !!targetEt?.es_ganado, es_perdido: !!targetEt?.es_perdido,
      } : r),
    } : old);

    const { error } = await (supabase as any).from("crm_negocios").update({ id_etapa: targetEtapa }).eq("id", dealId);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["deals-list"] }); return; }
    toast.success(`Movido a "${targetEt?.nombre ?? "etapa"}"`);
    qc.invalidateQueries({ queryKey: ["deals-list"] });
    if (deal.id_entidad_relacionada) qc.invalidateQueries({ queryKey: ["contact-deals", String(deal.id_entidad_relacionada)] });
  };

  const openDeal = (id: number) => navigate(`/admin/portal-crm/ventas/negocios/${id}`);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await (supabase as any).from("crm_negocios").update({ activo: false }).eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Negocio eliminado");
    const er = deleteTarget.id_entidad_relacionada;
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ["deals-list"] });
    if (er) qc.invalidateQueries({ queryKey: ["contact-deals", String(er)] });
  };

  const viewToggle = (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      <button onClick={() => setView("list")} title="Vista de lista"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
        <List className="h-4 w-4" />Lista
      </button>
      <button onClick={() => setView("board")} title="Vista de tablero"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border-l border-border transition-colors ${view === "board" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
        <LayoutGrid className="h-4 w-4" />Tablero
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Negocios" description={`${activeRows.length} negocio(s)`} actions={
        <div className="flex items-center gap-2">
          {viewToggle}
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" />Crear negocio
          </Button>
        </div>
      } />

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DealMetric label="Cantidad total" value={fmtMXN(metrics.total)} />
        <DealMetric label="Cantidad ponderada" value={fmtMXN(metrics.ponderada)} />
        <DealMetric label="Negocio abierto" value={fmtMXN(metrics.abierto)} />
        <DealMetric label="Cerrado ganado" value={fmtMXN(metrics.ganado)} />
      </div>

      {/* Barra: buscador · pipeline · propietario */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar negocio" className="pl-8 h-9" />
        </div>
        {view === "list" ? (
          <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Todos los pipelines" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pipelines</SelectItem>
              {(pipelines ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Select value={effectiveBoardPipeline} onValueChange={setBoardPipeline}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Selecciona un pipeline" /></SelectTrigger>
            <SelectContent>
              {(pipelines ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Todos los propietarios" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los propietarios</SelectItem>
            {(owners ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : view === "board" ? (
        !effectiveBoardPipeline ? (
          <EmptyState title="Sin pipelines" description="Crea un pipeline en Configuración para ver el tablero." />
        ) : (
          <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(Number(e.active.id))} onDragEnd={handleDragEnd}>
            <div className="flex gap-2 overflow-x-auto pb-4 items-start">
              {(boardEtapas ?? []).map((et: any, i: number) => (
                <BoardColumn key={et.id} etapa={et}
                  deals={boardRows.filter((r) => r.id_etapa === et.id)}
                  colorClass={etapaColorClasses(et, i)}
                  collapsed={collapsedCols.has(et.id)}
                  onToggle={() => toggleCol(et.id)}
                  onOpen={openDeal} onEdit={setEditTarget} onDelete={setDeleteTarget} />
              ))}
              {(boardEtapas ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground py-8">Este pipeline no tiene etapas. Agrégalas en Configuración → Pipelines.</p>
              )}
            </div>
            <DragOverlay>{activeDeal && <DealBoardCard deal={activeDeal} dragging />}</DragOverlay>
          </DndContext>
        )
      ) : listRows.length === 0 ? (
        <EmptyState title="Sin negocios" description="No hay negocios que coincidan con los filtros." />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre del negocio</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Fecha de cierre</TableHead>
                <TableHead>Propietario</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listRows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link to={`/admin/portal-crm/ventas/negocios/${r.id}`} className="hover:underline hover:text-primary">{r.nombre}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.pipeline_nombre}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[11px]">{r.etapa_nombre}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.contacto_nombre ? (
                      <Link to={`/admin/portal-crm/ventas/contactos/${r.id_entidad_relacionada}`} className="hover:underline hover:text-primary">
                        {r.contacto_nombre}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{r.fecha_cierre_estimada ? fmtDate(r.fecha_cierre_estimada) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.propietario_nombre}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{r.valor != null ? fmtMoneda(Number(r.valor), r.moneda) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <DealActionsMenu deal={r} onOpen={openDeal} onEdit={setEditTarget} onDelete={setDeleteTarget} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {view === "list" && data?.truncated && <p className="text-xs text-muted-foreground">Mostrando los primeros 1000 negocios. Usa los filtros o el buscador para acotar.</p>}

      {/* Crear negocio (desde el módulo, contacto opcional) */}
      <NewDealDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["deals-list"] })} />

      {/* Editar negocio */}
      <EditDealDialog deal={editTarget} pipelines={pipelines ?? []} owners={owners ?? []}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["deals-list"] }); if (editTarget?.id_entidad_relacionada) qc.invalidateQueries({ queryKey: ["contact-deals", String(editTarget.id_entidad_relacionada)] }); setEditTarget(null); }} />

      {/* Eliminar negocio */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este negocio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <span className="font-medium text-foreground">{deleteTarget?.nombre}</span>. Podrás recuperarlo desde la base de datos si es necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={deleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {deleting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Eliminando…</> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Menú de acciones (Ver · Editar · Eliminar) de un negocio.
function DealActionsMenu({ deal, onOpen, onEdit, onDelete, onBoard }: { deal: any; onOpen: (id: number) => void; onEdit: (d: any) => void; onDelete: (d: any) => void; onBoard?: boolean }) {
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(deal)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Diálogo para editar un negocio (mismos campos que "Acerca de este negocio").
function EditDealDialog({ deal, pipelines, owners, onOpenChange, onSaved }: { deal: any | null; pipelines: any[]; owners: any[]; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
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
function BoardColumn({ etapa, deals, colorClass, collapsed, onToggle, onOpen, onEdit, onDelete }: { etapa: any; deals: any[]; colorClass: string; collapsed: boolean; onToggle: () => void; onOpen: (id: number) => void; onEdit: (d: any) => void; onDelete: (d: any) => void }) {
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

// Iniciales para el avatar del contacto en la tarjeta.
// Fondo/tono del pill de prioridad.
const PRIORIDAD_PILL: Record<string, string> = {
  baja: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  media: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  alta: "bg-red-500/10 text-red-700 dark:text-red-400",
};

// Tarjeta arrastrable del tablero.
function DealBoardCard({ deal, dragging, onOpen, onEdit, onDelete }: { deal: any; dragging?: boolean; onOpen?: (id: number) => void; onEdit?: (d: any) => void; onDelete?: (d: any) => void }) {
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

// ─── CrmDealDetail — vista de un negocio ──────────────────────────────────────

export function CrmDealDetail() {
  const { dealId } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<any | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [centerTab, setCenterTab] = useState("descripcion");
  const [actSearch, setActSearch] = useState("");
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandNonce, setExpandNonce] = useState(0);
  const loadedRef = useRef<string | undefined>(undefined);
  const skipAutoSave = useRef(true);

  // Acota el <main> al alto visible para que cada columna scrollee sola (estilo HubSpot).
  useEffect(() => {
    const el = document.querySelector("main") as HTMLElement | null;
    const bodyPrev = document.body.style.overflow;
    const htmlPrev = document.documentElement.style.overflow;
    const prev = el ? { height: el.style.height, minHeight: el.style.minHeight, padding: el.style.padding, overflow: el.style.overflow } : null;
    const apply = () => {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      if (el) {
        window.scrollTo(0, 0);
        const top = el.getBoundingClientRect().top;
        el.style.height = `${window.innerHeight - top}px`;
        el.style.minHeight = "0";
        el.style.padding = "0";
        el.style.overflow = "hidden";
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      document.documentElement.style.overflow = htmlPrev;
      document.body.style.overflow = bodyPrev;
      if (el && prev) { el.style.height = prev.height; el.style.minHeight = prev.minHeight; el.style.padding = prev.padding; el.style.overflow = prev.overflow; }
    };
  }, []);

  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal-detail", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data: n } = await (supabase as any).from("crm_negocios")
        .select("id, nombre, valor, moneda, id_pipeline, id_etapa, id_usuario_propietario, fecha_cierre_estimada, id_entidad_relacionada, tipo_negocio, prioridad, fecha_creacion")
        .eq("id", Number(dealId)).eq("activo", true).maybeSingle();
      if (!n) return null;
      const [pRes, eRes, oRes] = await Promise.all([
        n.id_pipeline ? (supabase as any).from("crm_pipelines").select("nombre").eq("id", n.id_pipeline).maybeSingle() : Promise.resolve({ data: null }),
        n.id_etapa ? (supabase as any).from("crm_pipeline_etapas").select("nombre").eq("id", n.id_etapa).maybeSingle() : Promise.resolve({ data: null }),
        n.id_usuario_propietario ? (supabase as any).from("usuarios").select("nombre").eq("auth_user_id", n.id_usuario_propietario).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      let contacto: any = null;
      if (n.id_entidad_relacionada) {
        const { data: er } = await (supabase as any).from("entidades_relacionadas").select("id, id_persona").eq("id", n.id_entidad_relacionada).maybeSingle();
        if (er?.id_persona) {
          const { data: p } = await (supabase as any).from("personas").select("nombre_legal, nombre_comercial, email, telefono").eq("id", er.id_persona).maybeSingle();
          contacto = { id: n.id_entidad_relacionada, nombre: (p?.nombre_legal || p?.nombre_comercial || "Sin nombre").trim(), email: p?.email ?? null, telefono: p?.telefono ?? null };
        }
      }
      return { ...n, pipeline_nombre: pRes.data?.nombre ?? "—", etapa_nombre: eRes.data?.nombre ?? "—", propietario_nombre: oRes.data?.nombre ?? "—", contacto };
    },
  });

  const { data: pipelines } = useQuery({
    queryKey: ["deals-pipelines"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipelines").select("id, nombre").eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  const { data: owners } = useQuery({ queryKey: ["crm-owners"], queryFn: fetchCrmOwners });
  const { data: etapas } = useQuery({
    queryKey: ["deal-detail-etapas", form?.id_pipeline],
    enabled: !!form?.id_pipeline,
    queryFn: async () => {
      const { data } = await (supabase as any).from("crm_pipeline_etapas")
        .select("id, nombre, orden").eq("id_pipeline", Number(form.id_pipeline)).eq("activo", true).order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });

  // Hidrata el formulario una sola vez por negocio (no en cada refetch, para no
  // pisar lo que el usuario está escribiendo mientras se autoguarda).
  useEffect(() => {
    if (deal && loadedRef.current !== dealId) {
      loadedRef.current = dealId;
      skipAutoSave.current = true;
      setForm({
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
    }
  }, [deal, dealId]);

  // Autoguardado con debounce: cada cambio en el panel se persiste solo.
  useEffect(() => {
    if (!form) return;
    if (skipAutoSave.current) { skipAutoSave.current = false; return; }
    if (!form.nombre.trim()) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const patch = {
        nombre: form.nombre.trim(),
        id_pipeline: form.id_pipeline ? Number(form.id_pipeline) : null,
        id_etapa: form.id_etapa ? Number(form.id_etapa) : null,
        valor: form.valor ? Number(form.valor) : null,
        moneda: form.moneda,
        fecha_cierre_estimada: form.fecha_cierre || null,
        id_usuario_propietario: form.id_propietario || null,
        tipo_negocio: form.tipo_negocio || null,
        prioridad: form.prioridad || null,
      };
      const { error } = await (supabase as any).from("crm_negocios").update(patch).eq("id", Number(dealId));
      if (error) { toast.error(error.message); setSaveState("idle"); return; }
      setSaveState("saved");
      // Actualiza el encabezado/resumen local sin refetch (evita pisar el formulario).
      qc.setQueryData(["deal-detail", dealId], (old: any) => old ? {
        ...old, ...patch,
        pipeline_nombre: (pipelines ?? []).find((p) => String(p.id) === form.id_pipeline)?.nombre ?? old.pipeline_nombre,
        etapa_nombre: (etapas ?? []).find((e: any) => String(e.id) === form.id_etapa)?.nombre ?? "—",
        propietario_nombre: (owners ?? []).find((o: any) => o.id === form.id_propietario)?.full_name
          ?? (owners ?? []).find((o: any) => o.id === form.id_propietario)?.email ?? old.propietario_nombre,
      } : old);
      qc.invalidateQueries({ queryKey: ["deals-list"] });
      if (deal?.id_entidad_relacionada) qc.invalidateQueries({ queryKey: ["contact-deals", String(deal.id_entidad_relacionada)] });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const doDelete = async () => {
    setDeleting(true);
    const { error } = await (supabase as any).from("crm_negocios").update({ activo: false }).eq("id", Number(dealId));
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Negocio eliminado");
    qc.invalidateQueries({ queryKey: ["deals-list"] });
    if (deal?.id_entidad_relacionada) qc.invalidateQueries({ queryKey: ["contact-deals", String(deal.id_entidad_relacionada)] });
    navigate("/admin/portal-crm/ventas/negocios");
  };

  // Actividad del negocio = notas/tareas de su contacto asociado (reutiliza el Timeline).
  const erId: number | null = deal?.id_entidad_relacionada ?? null;
  const { data: activity } = useQuery({
    queryKey: ["deal-activity", erId],
    enabled: !!erId,
    queryFn: async () => {
      const [notasRes, tareasRes, citasRes] = await Promise.all([
        (supabase as any).from("crm_notas").select("id, contenido, fecha_creacion, id_usuario, anclado").eq("id_entidad_relacionada", Number(erId)).eq("activo", true).order("anclado", { ascending: false }).order("fecha_creacion", { ascending: false }),
        (supabase as any).from("crm_tareas").select("id, titulo, tipo, estatus, prioridad, descripcion, fecha_vencimiento, fecha_recordatorio, recurrencia, id_usuario_asignado, fecha_creacion").eq("id_entidad_relacionada", Number(erId)).eq("activo", true).order("fecha_creacion", { ascending: false }),
        (supabase as any).from("crm_citas").select("id, titulo, tipo, estatus, fecha_inicio, fecha_fin, ubicacion, enlace_reunion, resultado, descripcion, fecha_creacion, id_usuario_asignado").eq("id_entidad_relacionada", Number(erId)).eq("activo", true).order("fecha_inicio", { ascending: false }),
      ]);
      const notasRows = notasRes.data ?? [];
      const tareasRows = tareasRes.data ?? [];
      const citasRows = citasRes.error ? [] : (citasRes.data ?? []); // fail-soft si crm_citas no existe aún
      // Resuelve nombres de usuario (autor de nota / asignado de tarea) en un solo lookup.
      const uids = Array.from(new Set([
        ...notasRows.map((n: any) => n.id_usuario),
        ...tareasRows.map((t: any) => t.id_usuario_asignado),
      ].filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (uids.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", uids);
        nameMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }
      const notes = notasRows.map((n: any) => ({ id: n.id, content: n.contenido, created_at: n.fecha_creacion, author: n.id_usuario ? (nameMap[n.id_usuario] ?? null) : null, anclado: n.anclado ?? false }));
      const tasks = tareasRows.map((t: any) => ({
        id: t.id, title: t.titulo, tipo: t.tipo, status: t.estatus, priority: t.prioridad,
        descripcion: t.descripcion, due_date: t.fecha_vencimiento, reminder: t.fecha_recordatorio,
        recurrencia: t.recurrencia, assignee: t.id_usuario_asignado ? (nameMap[t.id_usuario_asignado] ?? null) : null,
        created_at: t.fecha_creacion,
      }));
      const citas = citasRows.map((c: any) => ({
        id: c.id, title: c.titulo, tipo: c.tipo, status: c.estatus,
        start_at: c.fecha_inicio, end_at: c.fecha_fin,
        ubicacion: c.ubicacion ?? null, enlace: c.enlace_reunion ?? null,
        resultado: c.resultado ?? null, descripcion: c.descripcion ?? null,
        created_at: c.fecha_creacion,
      }));
      return { notes, tasks, citas };
    },
  });
  const invalidateActivity = () => qc.invalidateQueries({ queryKey: ["deal-activity", erId] });
  const completeTask = async (id: number) => { const { error } = await (supabase as any).from("crm_tareas").update({ estatus: "completada" }).eq("id", id); if (error) { toast.error(error.message); return; } toast.success("Tarea completada"); invalidateActivity(); };
  const deleteTask = async (id: number) => { const { error } = await (supabase as any).from("crm_tareas").update({ activo: false }).eq("id", id); if (error) { toast.error(error.message); return; } toast.success("Tarea eliminada"); invalidateActivity(); };
  const deleteNote = async (id: number) => { const { error } = await (supabase as any).from("crm_notas").update({ activo: false }).eq("id", id); if (error) { toast.error(error.message); return; } toast.success("Nota eliminada"); invalidateActivity(); };
  const updateCitaStatus = async (id: number, estatus: string) => { const { error } = await (supabase as any).from("crm_citas").update({ estatus }).eq("id", id); if (error) { toast.error(error.message); return; } toast.success("Cita actualizada"); invalidateActivity(); };
  const deleteCita = async (id: number) => { const { error } = await (supabase as any).from("crm_citas").update({ activo: false }).eq("id", id); if (error) { toast.error(error.message); return; } toast.success("Cita eliminada"); invalidateActivity(); };

  if (isLoading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-3 gap-4"><Skeleton className="h-96 md:col-span-2" /><Skeleton className="h-64" /></div>
      </div>
    );
  }
  if (!deal) {
    return (
      <div className="space-y-3">
        <Button variant="outline" size="sm" asChild><Link to="/admin/portal-crm/ventas/negocios"><ArrowLeft className="h-4 w-4 mr-1" />Negocios</Link></Button>
        <p className="text-sm text-muted-foreground">Este negocio no existe o fue eliminado.</p>
      </div>
    );
  }

  const valorFmt = deal.valor != null ? fmtMoneda(Number(deal.valor), deal.moneda) : "—";
  const tipoLabel = deal.tipo_negocio === "cliente_nuevo" ? "Cliente nuevo" : deal.tipo_negocio === "cliente_existente" ? "Cliente existente" : "—";
  const quickFacts: [string, string][] = [
    ["Pipeline", deal.pipeline_nombre],
    ["Etapa", deal.etapa_nombre],
    ["Fecha de cierre", deal.fecha_cierre_estimada ? fmtDate(deal.fecha_cierre_estimada) : "—"],
    ["Propietario", deal.propietario_nombre],
  ];
  const actNotes = activity?.notes ?? [];
  const actTasks = activity?.tasks ?? [];
  const actCitas = activity?.citas ?? [];
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const upcomingTasks = actTasks.filter((t: any) => t.status !== "completada" && t.due_date && new Date(t.due_date) >= todayStart)
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const pinnedNotes = actNotes.filter((n: any) => n.anclado);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-3 border-b border-border bg-card shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/5 -ml-2 transition-colors" asChild>
            <Link to="/admin/portal-crm/ventas/negocios"><ArrowLeft className="h-4 w-4 mr-1.5" />Negocios</Link>
          </Button>
          <span className="text-muted-foreground/40 text-sm">/</span>
          <span className="text-sm font-medium text-foreground truncate max-w-[220px]">{deal.nombre}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5"><MoreHorizontal className="h-4 w-4" />Acciones</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setConfirmDeleteOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Eliminar negocio</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 3-column body — estilo HubSpot; cada columna scrollea por su cuenta */}
      <div className="grid grid-cols-12 flex-1 min-h-0 overflow-hidden">
        {/* Left: resumen + "Acerca de este negocio" (editable) */}
        <aside className="col-span-3 border-r border-border p-5 space-y-5 bg-white h-full min-h-0 overflow-y-auto">
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary ring-4 ring-primary/5 shadow-sm">
              <Briefcase className="h-6 w-6" />
            </div>
            <h2 className="font-semibold text-sm leading-tight">{deal.nombre}</h2>
            <p className="text-lg font-semibold tabular-nums">{valorFmt}</p>
            {deal.prioridad && PRIORIDAD_META[deal.prioridad] && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORIDAD_PILL[deal.prioridad]}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${PRIORIDAD_META[deal.prioridad].dot}`} />{PRIORIDAD_META[deal.prioridad].label}
              </span>
            )}
          </div>

          {/* Datos rápidos */}
          <div className="space-y-2">
            {quickFacts.map(([l, v]) => (
              <div key={l} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{l}</span>
                <span className="font-medium text-right truncate">{v}</span>
              </div>
            ))}
          </div>

          {/* Acerca de este negocio (editable) */}
          <Accordion type="single" collapsible defaultValue="about">
            <AccordionItem value="about" className="border-0">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-widest text-slate-500 hover:no-underline py-2 hover:text-primary transition-colors">
                Acerca de este negocio
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0">
                <div className="grid gap-3">
                  <DField label="Nombre *"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></DField>
                  <DField label="Pipeline">
                    <Select value={form.id_pipeline} onValueChange={(v) => setForm({ ...form, id_pipeline: v, id_etapa: "" })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{(pipelines ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </DField>
                  <DField label="Etapa">
                    <Select value={form.id_etapa} onValueChange={(v) => setForm({ ...form, id_etapa: v })} disabled={!form.id_pipeline}>
                      <SelectTrigger><SelectValue placeholder={form.id_pipeline ? "Selecciona una etapa" : "Elige pipeline"} /></SelectTrigger>
                      <SelectContent>{(etapas ?? []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </DField>
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
                      <SelectContent>{(owners ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
                    </Select>
                  </DField>
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
                  <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    {saveState === "saving" ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />Guardando…</>
                    ) : saveState === "saved" ? (
                      <><Check className="h-3 w-3 text-emerald-600" />Cambios guardados</>
                    ) : (
                      <span>Los cambios se guardan automáticamente</span>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>

        {/* Center: pestañas */}
        <section className="col-span-6 border-r border-border h-full min-h-0 overflow-hidden">
          <Tabs value={centerTab} onValueChange={setCenterTab} className="flex flex-col h-full min-h-0">
            <div className="border-b border-border shrink-0">
              <TabsList className="justify-start rounded-none bg-transparent h-auto px-4 gap-0">
                <TabsTrigger value="descripcion" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Descripción</TabsTrigger>
                <TabsTrigger value="actividades" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Actividades</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="descripcion" className="p-4 mt-0 flex-1 min-h-0 overflow-y-auto space-y-4">
              {/* Aspectos destacados de los datos (real) */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Aspectos destacados de los datos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <HL label="Fecha de creación" value={deal.fecha_creacion ? fmtDateTime(deal.fecha_creacion) : "—"} />
                  <HL label="Etapa del negocio" value={`${deal.etapa_nombre} (${deal.pipeline_nombre})`} />
                  <HL label="Valor" value={valorFmt} />
                  <HL label="Fecha de cierre" value={deal.fecha_cierre_estimada ? fmtDate(deal.fecha_cierre_estimada) : "—"} />
                  <HL label="Tipo de negocio" value={tipoLabel} />
                  <HL label="Propietario" value={deal.propietario_nombre} />
                </div>
              </div>

              {/* Contactos asociados */}
              <DealContactsSection contacto={deal.contacto} />

              {/* Actividades recientes (colapsables, estilo HubSpot) */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold">Actividades recientes</h3>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => setCenterTab("actividades")} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      <Plus className="h-3.5 w-3.5" />Añadir actividad
                    </button>
                    <button onClick={() => { setAllExpanded((v) => !v); setExpandNonce((n) => n + 1); }} className="text-xs text-primary hover:underline">
                      {allExpanded ? "Contraer todo" : "Expandir todo"}
                    </button>
                  </div>
                </div>
                <div className="relative mb-3">
                  <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={actSearch} onChange={(e) => setActSearch(e.target.value)} placeholder="Buscar actividades" className="pl-8 h-8 text-sm" />
                </div>
                {!erId ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Sin contacto asociado.</p>
                ) : (
                  <DealActivityFeed
                    notes={actNotes} tasks={actTasks} search={actSearch}
                    defaultExpanded={allExpanded} expandNonce={expandNonce}
                    contactName={deal.contacto?.nombre ?? ""}
                    onCompleteTask={completeTask} onDeleteTask={deleteTask} onDeleteNote={deleteNote} onEdited={invalidateActivity}
                  />
                )}
              </div>
            </TabsContent>
            <TabsContent value="actividades" className="p-4 mt-0 flex-1 min-h-0 overflow-y-auto space-y-4">
              {!erId ? (
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Asocia un contacto a este negocio para registrar notas y tareas.</p>
                </div>
              ) : (
                <ActivityPanel
                  contactId={String(erId)} userId={user?.id} owners={owners ?? []}
                  contact={{ full_name: deal.contacto?.nombre }}
                  notes={actNotes} tasks={actTasks} citas={actCitas} includeSystem={false}
                  onSaved={invalidateActivity}
                  onCompleteTask={completeTask} onDeleteTask={deleteTask} onDeleteNote={deleteNote}
                  onUpdateCita={updateCitaStatus} onDeleteCita={deleteCita}
                />
              )}
            </TabsContent>
          </Tabs>
        </section>

        {/* Right: entidades relacionadas */}
        <aside className="col-span-3 p-4 bg-slate-50/40 h-full min-h-0 overflow-y-auto">
          <Accordion type="multiple" defaultValue={["contactos", "empresas", "cotizaciones"]}>
            <AccordionItem value="contactos">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Contactos <span className="text-xs text-muted-foreground font-normal">{deal.contacto ? 1 : 0}</span></span>
              </AccordionTrigger>
              <AccordionContent>
                {!deal.contacto ? (
                  <p className="text-xs text-muted-foreground py-2">Sin contacto asociado</p>
                ) : (
                  <div className="rounded-md border border-border p-3 bg-card space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">{dealInitials(deal.contacto.nombre)}</span>
                      <Link to={`/admin/portal-crm/ventas/contactos/${deal.contacto.id}`} className="text-sm font-medium hover:underline hover:text-primary truncate">{deal.contacto.nombre}</Link>
                    </div>
                    {deal.contacto.email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{deal.contacto.email}</span></div>}
                    {deal.contacto.telefono && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{deal.contacto.telefono}</span></div>}
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs" asChild><Link to={`/admin/portal-crm/ventas/contactos/${deal.contacto.id}`}>Ver ficha</Link></Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="empresas">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Empresas <span className="text-xs text-muted-foreground font-normal">0</span></span>
              </AccordionTrigger>
              <AccordionContent><p className="text-xs text-muted-foreground py-2">Sin empresas asociadas</p></AccordionContent>
            </AccordionItem>
            <AccordionItem value="cotizaciones" className="border-b-0">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Cotizaciones <span className="text-xs text-muted-foreground font-normal">0</span></span>
              </AccordionTrigger>
              <AccordionContent><p className="text-xs text-muted-foreground py-2">Sin cotizaciones asociadas</p></AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>
      </div>

      {/* Confirmar eliminación */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este negocio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <span className="font-medium text-foreground">{deal.nombre}</span> y volverás a la lista de negocios. Podrás recuperarlo desde la base de datos si es necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doDelete(); }} disabled={deleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {deleting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Eliminando…</> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Sección "Contactos" de la ficha del negocio (tabla estilo HubSpot).
function DealContactsSection({ contacto }: { contacto: any | null }) {
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

// Feed de actividades recientes: intercala notas y tareas, agrupa por mes y las
// pinta colapsables (la nota reusa NoteCard; la tarea usa TaskActivityCard).

// Tarjeta colapsable de una tarea (equivalente a NoteCard). Expandida muestra
// vencimiento, recordatorio, etapa, tipo, prioridad y asignado (estilo HubSpot).

// ─── CrmCitas (globales) ──────────────────────────────────────────────────────
// Todas las citas/reuniones de todos los contactos. Lee/escribe la tabla real
// `crm_citas` (español), resuelve nombre de contacto y asignado por waterfall,
// y ofrece una "Vista previa" en panel lateral (estilo HubSpot). Se conserva el
// nombre de export `CrmAppointments` porque App.tsx ya lo rutea en /ventas/citas.
// (El esquema ficticio `crm_appointments`/`contacts`/`organization_id` se descartó.)


export function CrmAppointments() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "today" | "past" | "all">("upcoming");
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fAssignee, setFAssignee] = useState("all");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<GlobalCita | null>(null);

  const { data: owners = [] } = useQuery({ queryKey: ["crm-owners"], queryFn: fetchCrmOwners });

  const { data: citas = [], isLoading } = useQuery<GlobalCita[]>({
    queryKey: ["crm-citas-global"],
    queryFn: async () => {
      const res = await (supabase as any).from("crm_citas")
        .select("id, titulo, tipo, estatus, fecha_inicio, fecha_fin, ubicacion, enlace_reunion, resultado, descripcion, id_entidad_relacionada, id_usuario_asignado")
        .eq("activo", true)
        .order("fecha_inicio", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (res.error) return []; // crm_citas aún no desplegada en este ambiente
      const rows: any[] = res.data ?? [];
      if (!rows.length) return [];

      // Nombre de contacto: entidades_relacionadas → personas.
      const entIds = Array.from(new Set(rows.map((r) => r.id_entidad_relacionada).filter(Boolean)));
      const contactMap: Record<number, string> = {};
      if (entIds.length) {
        const { data: ents } = await (supabase as any).from("entidades_relacionadas").select("id, id_persona").in("id", entIds);
        const personaByEnt: Record<number, number> = Object.fromEntries((ents ?? []).map((e: any) => [e.id, e.id_persona]));
        const personaIds = Array.from(new Set(Object.values(personaByEnt).filter(Boolean)));
        if (personaIds.length) {
          const { data: personas } = await (supabase as any).from("personas").select("id, nombre_legal, nombre_comercial").in("id", personaIds);
          const pName: Record<number, string> = Object.fromEntries((personas ?? []).map((p: any) => [p.id, (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim()]));
          for (const [entId, pId] of Object.entries(personaByEnt)) contactMap[Number(entId)] = pName[pId as number] ?? "Sin nombre";
        }
      }
      // Nombre del usuario asignado.
      const userIds = Array.from(new Set(rows.map((r) => r.id_usuario_asignado).filter(Boolean)));
      let userMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", userIds);
        userMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }
      return rows.map((r) => ({
        id: r.id, titulo: r.titulo, tipo: r.tipo, estatus: r.estatus,
        fecha_inicio: r.fecha_inicio, fecha_fin: r.fecha_fin,
        ubicacion: r.ubicacion ?? null, enlace_reunion: r.enlace_reunion ?? null,
        resultado: r.resultado ?? null, descripcion: r.descripcion ?? null,
        id_entidad_relacionada: r.id_entidad_relacionada, id_usuario_asignado: r.id_usuario_asignado,
        contact_name: contactMap[r.id_entidad_relacionada] ?? null,
        assigned_name: r.id_usuario_asignado ? (userMap[r.id_usuario_asignado] ?? null) : null,
      }));
    },
  });

  // Conteos por pestaña (por fecha_inicio).
  const counts = useMemo(() => {
    const c = { all: citas.length, today: 0, upcoming: 0, past: 0 };
    for (const cita of citas) {
      if (!cita.fecha_inicio) continue;
      const d = parseISO(cita.fecha_inicio);
      if (isNaN(d.getTime())) continue;
      if (isToday(d)) c.today++;
      else if (isFuture(d)) c.upcoming++;
      else if (isPast(d)) c.past++;
    }
    return c;
  }, [citas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return citas
      .filter((c) => {
        if (tab !== "all") {
          if (!c.fecha_inicio) return false;
          const d = parseISO(c.fecha_inicio);
          if (isNaN(d.getTime())) return false;
          if (tab === "today" && !isToday(d)) return false;
          if (tab === "upcoming" && !isFuture(d)) return false;
          if (tab === "past" && !(isPast(d) && !isToday(d))) return false;
        }
        if (fType !== "all" && c.tipo !== fType) return false;
        if (fStatus !== "all" && c.estatus !== fStatus) return false;
        if (fAssignee !== "all") {
          if (fAssignee === "none" && c.id_usuario_asignado) return false;
          if (fAssignee !== "none" && c.id_usuario_asignado !== fAssignee) return false;
        }
        if (q && !(c.titulo?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => {
        const da = a.fecha_inicio ?? "9999";
        const db = b.fecha_inicio ?? "9999";
        return tab === "past" ? db.localeCompare(da) : da.localeCompare(db);
      });
  }, [citas, tab, search, fType, fStatus, fAssignee]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, estatus }: { id: number; estatus: string }) => {
      const { error } = await (supabase as any).from("crm_citas").update({ estatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.refetchQueries({ queryKey: ["crm-citas-global"] });
      setPreview((p) => (p && p.id === v.id ? { ...p, estatus: v.estatus } : p));
      toast.success("Cita actualizada");
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo actualizar"),
  });
  const removeCita = useMutation({
    mutationFn: async (id: number) => { const { error } = await (supabase as any).from("crm_citas").update({ activo: false }).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.refetchQueries({ queryKey: ["crm-citas-global"] }); setPreview(null); toast.success("Cita eliminada"); },
    onError: (e: any) => toast.error(e.message ?? "No se pudo eliminar"),
  });

  const CITA_TABS = [
    { id: "upcoming" as const, label: "Próximas", count: counts.upcoming },
    { id: "today" as const, label: "Hoy", count: counts.today },
    { id: "past" as const, label: "Pasadas", count: counts.past },
    { id: "all" as const, label: "Todas", count: counts.all },
  ];
  const hasFilters = search || fType !== "all" || fStatus !== "all" || fAssignee !== "all";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Citas</h1>
          <p className="text-sm text-muted-foreground">{citas.length} cita{citas.length === 1 ? "" : "s"} · {counts.upcoming} próxima{counts.upcoming === 1 ? "" : "s"}</p>
        </div>
        <NewGlobalCitaDialog open={open} onOpenChange={setOpen} owners={owners} defaultAssignee={user?.id ?? ""} onCreated={() => qc.refetchQueries({ queryKey: ["crm-citas-global"] })} />
      </div>

      {/* Tabs con conteos */}
      <div className="border-b border-border flex gap-1 overflow-x-auto">
        {CITA_TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap flex items-center gap-2 ${tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}>
            {t.label}
            <span className={`text-[11px] rounded-full px-1.5 min-w-[20px] text-center ${tab === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título o contacto…" className="pl-8" />
        </div>
        <Select value={fAssignee} onValueChange={setFAssignee}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Asignado a" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            <SelectItem value="none">Sin asignar</SelectItem>
            {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fType} onValueChange={setFType}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(CITA_TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estatus" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo estatus</SelectItem>
            {CITA_STATUS_ORDER.map((k) => <SelectItem key={k} value={k}>{CITA_STATUS_META[k].label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFType("all"); setFStatus("all"); setFAssignee("all"); }}>
            <X className="h-4 w-4 mr-1" />Limpiar
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-left font-medium">Título</th>
                <th className="p-3 text-left font-medium">Cuándo</th>
                <th className="p-3 text-left font-medium">Estatus</th>
                <th className="p-3 text-left font-medium">Contacto asociado</th>
                <th className="p-3 text-left font-medium">Asignado a</th>
                <th className="p-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">
                  {hasFilters || tab !== "all" ? "Sin citas para este filtro." : "Aún no hay citas. Crea la primera con “Nueva cita”."}
                </td></tr>
              )}
              {filtered.map((c) => {
                const typeMeta = CITA_TYPE_META[c.tipo] ?? { label: c.tipo, icon: CalendarClock };
                const statusMeta = CITA_STATUS_META[c.estatus];
                const TypeIcon = typeMeta.icon;
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30 group align-top cursor-pointer" onClick={() => setPreview(c)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{c.titulo}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground ml-6">{typeMeta.label}</span>
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtCitaWhen(c.fecha_inicio, c.fecha_fin)}</span>
                    </td>
                    <td className="p-3">
                      {statusMeta ? <Badge variant="outline" className={statusMeta.cls}>{statusMeta.label}</Badge> : <span className="text-muted-foreground">{c.estatus}</span>}
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      {c.contact_name ? <Link to={`/admin/portal-crm/ventas/contactos/${c.id_entidad_relacionada}`} className="text-info hover:underline">{c.contact_name}</Link> : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{c.assigned_name ?? <span className="italic text-muted-foreground/60">Sin asignar</span>}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-primary" onClick={() => setPreview(c)}>
                          <ChevronRight className="h-3.5 w-3.5" />Vista previa
                        </Button>
                        <button type="button" title="Eliminar cita" onClick={() => removeCita.mutate(c.id)} className="text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <CitaPreviewSheet
        cita={preview}
        onOpenChange={(v) => { if (!v) setPreview(null); }}
        onUpdateStatus={(estatus) => preview && updateStatus.mutate({ id: preview.id, estatus })}
        onDelete={() => preview && removeCita.mutate(preview.id)}
      />
    </div>
  );
}


type GlobalTask = {
  id: number;
  titulo: string;
  tipo: string;
  prioridad: string;
  estatus: string;
  descripcion: string | null;
  fecha_vencimiento: string | null;
  fecha_recordatorio: string | null;
  recurrencia: string | null;
  fecha_creacion: string;
  id_entidad_relacionada: number;
  id_usuario_asignado: string | null;
  contact_name: string | null;
  assigned_name: string | null;
};

export function CrmTasks() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"all" | "today" | "overdue" | "upcoming">("today");
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("all");
  const [fPriority, setFPriority] = useState("all");
  const [fAssignee, setFAssignee] = useState("all");
  const [open, setOpen] = useState(false);

  const { data: owners = [] } = useQuery({ queryKey: ["crm-owners"], queryFn: fetchCrmOwners });

  const { data: tasks = [], isLoading } = useQuery<GlobalTask[]>({
    queryKey: ["crm-tasks-global"],
    queryFn: async () => {
      const res = await (supabase as any).from("crm_tareas")
        .select("id, titulo, tipo, prioridad, estatus, descripcion, fecha_vencimiento, fecha_recordatorio, recurrencia, fecha_creacion, id_entidad_relacionada, id_usuario_asignado")
        .eq("activo", true)
        .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
        .limit(1000);
      if (res.error) return [];
      const rows: any[] = res.data ?? [];
      if (!rows.length) return [];

      // Resolver nombre de contacto: entidades_relacionadas → personas.
      const entIds = Array.from(new Set(rows.map((r) => r.id_entidad_relacionada).filter(Boolean)));
      const contactMap: Record<number, string> = {};
      if (entIds.length) {
        const { data: ents } = await (supabase as any).from("entidades_relacionadas")
          .select("id, id_persona").in("id", entIds);
        const personaByEnt: Record<number, number> = Object.fromEntries((ents ?? []).map((e: any) => [e.id, e.id_persona]));
        const personaIds = Array.from(new Set(Object.values(personaByEnt).filter(Boolean)));
        if (personaIds.length) {
          const { data: personas } = await (supabase as any).from("personas")
            .select("id, nombre_legal, nombre_comercial").in("id", personaIds);
          const pName: Record<number, string> = Object.fromEntries((personas ?? []).map((p: any) => [p.id, (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim()]));
          for (const [entId, pId] of Object.entries(personaByEnt)) contactMap[Number(entId)] = pName[pId as number] ?? "Sin nombre";
        }
      }

      // Resolver nombre del usuario asignado.
      const userIds = Array.from(new Set(rows.map((r) => r.id_usuario_asignado).filter(Boolean)));
      let userMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", userIds);
        userMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }

      return rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        tipo: r.tipo,
        prioridad: r.prioridad,
        estatus: r.estatus,
        descripcion: r.descripcion ?? null,
        fecha_vencimiento: r.fecha_vencimiento,
        fecha_recordatorio: r.fecha_recordatorio ?? null,
        recurrencia: r.recurrencia ?? null,
        fecha_creacion: r.fecha_creacion,
        id_entidad_relacionada: r.id_entidad_relacionada,
        id_usuario_asignado: r.id_usuario_asignado,
        contact_name: contactMap[r.id_entidad_relacionada] ?? null,
        assigned_name: r.id_usuario_asignado ? (userMap[r.id_usuario_asignado] ?? null) : null,
      }));
    },
  });

  const isDone = (t: GlobalTask) => t.estatus === "completada";

  // Conteos por pestaña (siempre sobre tareas no completadas, salvo "Todo").
  const counts = useMemo(() => {
    const c = { all: tasks.length, today: 0, overdue: 0, upcoming: 0 };
    for (const t of tasks) {
      if (isDone(t) || !t.fecha_vencimiento) continue;
      const d = parseISO(t.fecha_vencimiento);
      if (isToday(d)) c.today++;
      else if (isPast(d)) c.overdue++;
      else if (isFuture(d)) c.upcoming++;
    }
    return c;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => {
        // Pestaña
        if (tab !== "all") {
          if (isDone(t)) return false;
          if (!t.fecha_vencimiento) return false;
          const d = parseISO(t.fecha_vencimiento);
          if (tab === "today" && !isToday(d)) return false;
          if (tab === "overdue" && !(isPast(d) && !isToday(d))) return false;
          if (tab === "upcoming" && !isFuture(d)) return false;
        }
        if (fType !== "all" && t.tipo !== fType) return false;
        if (fPriority !== "all" && t.prioridad !== fPriority) return false;
        if (fAssignee !== "all") {
          if (fAssignee === "none" && t.id_usuario_asignado) return false;
          if (fAssignee !== "none" && t.id_usuario_asignado !== fAssignee) return false;
        }
        if (q && !(t.titulo?.toLowerCase().includes(q) || t.contact_name?.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => {
        // Ordenar por prioridad y luego por vencimiento.
        const pa = TASK_PRIORITY_META[a.prioridad]?.order ?? 9;
        const pb = TASK_PRIORITY_META[b.prioridad]?.order ?? 9;
        if (pa !== pb) return pa - pb;
        const da = a.fecha_vencimiento ?? "9999";
        const db = b.fecha_vencimiento ?? "9999";
        return da.localeCompare(db);
      });
  }, [tasks, tab, search, fType, fPriority, fAssignee]);

  const toggleComplete = useMutation({
    mutationFn: async (t: GlobalTask) => {
      const completing = !isDone(t);
      const next = completing ? "completada" : "pendiente";
      const { error } = await (supabase as any).from("crm_tareas").update({ estatus: next }).eq("id", t.id);
      if (error) throw error;
      // Al completar una tarea recurrente, genera la siguiente ocurrencia.
      if (completing && t.recurrencia && t.fecha_vencimiento) await regenerateRecurringTask(t);
    },
    onSuccess: (_d, t) => {
      qc.invalidateQueries({ queryKey: ["crm-tasks-global"] });
      if (!isDone(t) && t.recurrencia) toast.success("Tarea completada · se generó la siguiente");
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo actualizar"),
  });

  const removeTask = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any).from("crm_tareas").update({ activo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-tasks-global"] }); toast.success("Tarea eliminada"); },
    onError: (e: any) => toast.error(e.message ?? "No se pudo eliminar"),
  });

  const TASK_TABS = [
    { id: "all" as const, label: "Todo", count: counts.all },
    { id: "today" as const, label: "Vencen hoy", count: counts.today },
    { id: "overdue" as const, label: "Atrasado", count: counts.overdue },
    { id: "upcoming" as const, label: "Próximamente", count: counts.upcoming },
  ];

  const hasFilters = search || fType !== "all" || fPriority !== "all" || fAssignee !== "all";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tareas</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} tarea{tasks.length === 1 ? "" : "s"} en total · {counts.overdue} atrasada{counts.overdue === 1 ? "" : "s"}</p>
        </div>
        <NewGlobalTaskDialog
          open={open}
          onOpenChange={setOpen}
          owners={owners}
          defaultAssignee={user?.id ?? ""}
          onCreated={() => qc.invalidateQueries({ queryKey: ["crm-tasks-global"] })}
        />
      </div>

      {/* Tabs con conteos */}
      <div className="border-b border-border flex gap-1 overflow-x-auto">
        {TASK_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap flex items-center gap-2 ${tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}
          >
            {t.label}
            <span className={`text-[11px] rounded-full px-1.5 min-w-[20px] text-center ${tab === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} ${t.id === "overdue" && t.count > 0 ? "!bg-red-500/10 !text-red-600 dark:!text-red-400" : ""}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título o contacto…" className="pl-8" />
        </div>
        <Select value={fAssignee} onValueChange={setFAssignee}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Asignado a" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            <SelectItem value="none">Sin asignar</SelectItem>
            {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fType} onValueChange={setFType}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(TASK_TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPriority} onValueChange={setFPriority}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda prioridad</SelectItem>
            {Object.entries(TASK_PRIORITY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFType("all"); setFPriority("all"); setFAssignee("all"); }}>
            <X className="h-4 w-4 mr-1" />Limpiar
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 w-10"></th>
                <th className="p-3 text-left font-medium">Título</th>
                <th className="p-3 text-left font-medium">Prioridad</th>
                <th className="p-3 text-left font-medium">Vencimiento</th>
                <th className="p-3 text-left font-medium">Contacto asociado</th>
                <th className="p-3 text-left font-medium">Asignado a</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
                    {hasFilters || tab !== "all" ? "Sin tareas para este filtro." : "Aún no hay tareas. Crea la primera con “Nueva tarea”."}
                  </td>
                </tr>
              )}
              {filtered.map((t) => {
                const done = isDone(t);
                const d = t.fecha_vencimiento ? parseISO(t.fecha_vencimiento) : null;
                const isOverdue = d && isPast(d) && !isToday(d) && !done;
                const dueLabel = t.fecha_vencimiento ? fmtDueDateTime(t.fecha_vencimiento) : "—";
                const typeMeta = TASK_TYPE_META[t.tipo] ?? { label: t.tipo, icon: ClipboardList };
                const prioMeta = TASK_PRIORITY_META[t.prioridad];
                const TypeIcon = typeMeta.icon;
                return (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30 group align-top">
                    <td className="p-3">
                      <button
                        type="button"
                        title={done ? "Marcar pendiente" : "Marcar completada"}
                        onClick={() => toggleComplete.mutate(t)}
                        className={`size-5 rounded-full border-2 flex items-center justify-center transition-colors ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-emerald-500"}`}
                      >
                        {done && <Check className="size-3" />}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className={done ? "line-through text-muted-foreground" : "font-medium"}>{t.titulo}</span>
                        {t.recurrencia && <RefreshCw className="h-3 w-3 text-muted-foreground shrink-0" aria-label={`Se repite: ${RECURRENCE_LABEL[t.recurrencia] ?? t.recurrencia}`} />}
                        {t.fecha_recordatorio && <Bell className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Tiene recordatorio" />}
                      </div>
                      <span className="text-[11px] text-muted-foreground ml-6">{typeMeta.label}</span>
                      {t.descripcion && <div className="text-xs text-muted-foreground/80 ml-6 mt-0.5 line-clamp-1 max-w-md">{t.descripcion}</div>}
                    </td>
                    <td className="p-3">
                      {prioMeta ? <Badge variant="outline" className={prioMeta.cls}>{prioMeta.label}</Badge> : <span className="text-muted-foreground">{t.prioridad}</span>}
                    </td>
                    <td className={`p-3 whitespace-nowrap ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      <span className="inline-flex items-center gap-1">{isOverdue && <TriangleAlert className="h-3.5 w-3.5" />}{dueLabel}</span>
                    </td>
                    <td className="p-3">
                      {t.contact_name ? (
                        <Link to={`/admin/portal-crm/ventas/contactos/${t.id_entidad_relacionada}`} className="text-info hover:underline">{t.contact_name}</Link>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{t.assigned_name ?? <span className="italic text-muted-foreground/60">Sin asignar</span>}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        title="Eliminar tarea"
                        onClick={() => removeTask.mutate(t.id)}
                        className="text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
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

