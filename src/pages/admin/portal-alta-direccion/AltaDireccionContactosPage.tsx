/**
 * Contactos — Portal Alta Dirección (ESPEJO DE SOLO LECTURA del CRM).
 *
 * Reproduce la LISTA de "Contactos" del Portal CRM (`crm.tsx` → CrmContacts)
 * para auditar y visualizar todos los contactos y su estado en tiempo real,
 * SIN capacidad de crear/editar/eliminar. Reusa la misma fuente de datos (RPC
 * `get_crm_contactos_agrupados` + hidratación) y los mismos catálogos/columnas,
 * pero sin el contexto de impersonación ni las mutaciones del CRM.
 *
 * Espejo, no dependencia: la lista del CRM vive en un archivo monolítico
 * (crm.tsx, 3707 líneas) con su fetch/columnas inline no exportados; duplicarlo
 * aquí evita tocar ese componente crítico. Los helpers de presentación
 * (fmtDate/labels) y catálogos SÍ se reutilizan de módulos compartidos.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Settings2, Building2, ChevronRight, ArrowUp, ArrowDown, Eye, EyeOff, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { PageHeader, Pill } from "@/components/admin/portal-alta-direccion/ui";
import { fmtDate, leadStatusLabel, lifecycleLabel } from "@/lib/crm-lib";
import { META_LEAD_STATUSES, useLeadStates, fetchCrmCategorias } from "@/hooks/useCrmCatalogos";

/* ─── Columnas (espejo de DEFAULT_CONTACT_COLUMNS del CRM) ─── */
type ColumnId =
  | "name" | "categoria" | "proyecto" | "email" | "phone" | "lead_status"
  | "lifecycle" | "owner" | "created" | "updated" | "source"
  | "meta_form_name" | "meta_campaign_id" | "meta_ad_id" | "meta_platform"
  | "meta_created_time" | "meta_field_data";
type ColumnConfig = { id: ColumnId; label: string; visible: boolean };

const DEFAULT_CONTACT_COLUMNS: ColumnConfig[] = [
  { id: "name", label: "Nombre", visible: true },
  { id: "categoria", label: "Categoría", visible: true },
  { id: "proyecto", label: "Proyecto", visible: true },
  { id: "email", label: "Correo", visible: false },
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

// Clave propia (independiente de la del CRM) para no mezclar preferencias.
const COLUMNS_KEY = "sozu:altadir:contactos:columns:v1";
function loadColumns(): ColumnConfig[] {
  if (typeof window === "undefined") return DEFAULT_CONTACT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(COLUMNS_KEY);
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
  development_name: string | null;
  lead_status: string;
  lifecycle_stage: string;
  meta_platform: string | null;
  origen: string | null;
  contact_owner: string | null;
  owner_name: string | null;
  last_activity_at: string | null;
  created_at: string;
  meta_form_name: string | null;
  meta_campaign_id: string | null;
  meta_ad_id: string | null;
  meta_created_time: string | null;
  meta_field_data: any[] | null;
  categoria_ids: number[];
  otros_count?: number;
  id_persona?: number | null;
};

type StageTab = "all" | "mine" | "unassigned";

const CONTACT_TABS: { id: StageTab; label: string }[] = [
  { id: "all", label: "Todos contactos" },
  { id: "mine", label: "Mis contactos" },
  { id: "unassigned", label: "Contactos no asignados" },
];

const STATUS_COLOR: Record<string, string> = {
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
};

const ORIGEN_LABEL: Record<string, { txt: string; cls: string }> = {
  meta: { txt: "Meta", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  importacion: { txt: "Importación", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  crm: { txt: "CRM", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  manual: { txt: "Manual", cls: "bg-slate-50 text-slate-500 border-slate-200" },
  formulario_web: { txt: "Web", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  agente_externo: { txt: "Stephen Burr", cls: "bg-teal-50 text-teal-700 border-teal-200" },
};

const PAGE_SIZE = 25;

export function AltaDireccionContactos() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const uid = user?.id ?? "";
  const isSuperAdmin = profile?.rol_nombre === "Super Administrador";

  const [stageTab, setStageTab] = useState<StageTab>("all");
  const [search, setSearch] = useState("");
  const [filterDev, setFilterDev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLifecycle] = useState("all"); // sin UI (paridad con CRM); reservado
  const [filterSource, setFilterSource] = useState("all");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [page, setPage] = useState(0);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => loadColumns());
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);

  const persistColumns = (next: ColumnConfig[]) => {
    setColumns(next);
    try { window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
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
  // "Mostrar todas" activa todo; "Ocultar" deja solo Nombre (la tabla siempre
  // debe conservar al menos una columna identificable).
  const showAllColumns = () => persistColumns(columns.map((c) => ({ ...c, visible: true })));
  const hideAllColumns = () => persistColumns(columns.map((c) => ({ ...c, visible: c.id === "name" })));
  const visibleColumns = columns.filter((c) => c.visible);

  const { data: leadStates = META_LEAD_STATUSES } = useLeadStates();

  const { data: developments } = useQuery({
    queryKey: ["proyectos-list"],
    queryFn: async () => {
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

  // Resetear a la primera página cuando cambian filtros/búsqueda.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setPage(0);
  }, [stageTab, search, filterDev, filterStatus, filterSource, filterCategoria]);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["altadir-contactos", stageTab, search, filterDev, filterLifecycle, filterSource, filterCategoria, filterStatus, page, isSuperAdmin, uid],
    // Auditoría en tiempo casi-real: refresca en foco/reconexión y cada 60s.
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const tipoFilter = filterLifecycle !== "all"
        ? filterLifecycle === "customer" ? [2] : [7]
        : [2, 7];
      const proyectoId = filterDev !== "all" ? Number(filterDev) : null;
      const p_owner = stageTab === "mine" ? (uid || null) : null;
      const p_unassigned = stageTab === "unassigned";

      const hydrateRows = async (list: any[]): Promise<ContactRow[]> => {
        if (!list.length) return [];
        const { data: personas } = await (supabase as any).from("personas")
          .select("id, nombre_legal, nombre_comercial, email, telefono")
          .in("id", list.map((e: any) => e.id_persona)).eq("activo", true);
        const pMap: Record<number, any> = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p]));
        let atrMap: Record<number, any> = {};
        const atrRes = await (supabase as any).from("crm_leads_atribucion")
          .select("id_entidad_relacionada, estatus_lead, etapa_ciclo_vida, id_propietario, origen, meta_form_name, meta_campaign_id, meta_ad_id, meta_platform, meta_created_time, meta_field_data")
          .in("id_entidad_relacionada", list.map((e: any) => e.id)).eq("activo", true);
        if (!atrRes.error) atrMap = Object.fromEntries((atrRes.data ?? []).map((a: any) => [a.id_entidad_relacionada, a]));
        const ownerIds = Array.from(new Set(Object.values(atrMap).map((a: any) => a?.id_propietario).filter(Boolean)));
        let ownerNameMap: Record<string, string> = {};
        if (ownerIds.length) {
          const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", ownerIds);
          ownerNameMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
        }
        const catByEr: Record<number, number[]> = {};
        const catAllRes = await (supabase as any).from("entidades_relacionadas_categorias")
          .select("id_entidad_relacionada, id_categoria").in("id_entidad_relacionada", list.map((e: any) => e.id)).eq("activo", true);
        if (!catAllRes.error) for (const r of (catAllRes.data ?? [])) (catByEr[r.id_entidad_relacionada] ??= []).push(r.id_categoria);
        const proyIds = Array.from(new Set(list.map((e: any) => e.id_proyecto).filter(Boolean)));
        let proyMap: Record<number, string> = {};
        if (proyIds.length) {
          const { data: ps } = await (supabase as any).from("proyectos").select("id, nombre").in("id", proyIds);
          proyMap = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.nombre]));
        }
        return list.filter((e: any) => pMap[e.id_persona]).map((e: any) => {
          const p = pMap[e.id_persona]; const a = atrMap[e.id] ?? null;
          return {
            id: String(e.id),
            full_name: (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim(),
            email: p.email ?? null, phone: p.telefono ?? null,
            development_id: e.id_proyecto ? String(e.id_proyecto) : null,
            development_name: e.id_proyecto ? (proyMap[e.id_proyecto] ?? null) : null,
            lead_status: a?.estatus_lead ?? "nuevo",
            lifecycle_stage: a?.etapa_ciclo_vida ?? (e.id_tipo_entidad === 2 ? "customer" : "lead"),
            meta_platform: a?.meta_platform ?? null,
            origen: a?.origen ?? null,
            contact_owner: a?.id_propietario ?? null,
            owner_name: a?.id_propietario ? (ownerNameMap[a.id_propietario] ?? null) : null,
            last_activity_at: e.fecha_actualizacion ?? null,
            created_at: e.fecha_creacion ?? new Date().toISOString(),
            meta_form_name: a?.meta_form_name ?? null, meta_campaign_id: a?.meta_campaign_id ?? null,
            meta_ad_id: a?.meta_ad_id ?? null,
            meta_created_time: a?.meta_created_time ?? null, meta_field_data: a?.meta_field_data ?? null,
            categoria_ids: catByEr[e.id] ?? [],
          };
        });
      };

      // Camino agrupado (una fila por persona) vía RPC.
      const rpc = await (supabase as any).rpc("get_crm_contactos_agrupados", {
        p_tipos: tipoFilter,
        p_proyecto: proyectoId,
        p_search: search.trim() || null,
        p_fuente: (filterSource === "meta" || filterSource === "manual") ? filterSource : null,
        p_categoria: filterCategoria !== "all" ? Number(filterCategoria) : null,
        p_estatus: filterStatus !== "all" ? filterStatus : null,
        p_owner,
        p_unassigned,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_force_agente_externo: false, // Alta Dirección audita todo, nunca filtra por agente externo.
      });
      if (!rpc.error) {
        const grouped: any[] = rpc.data ?? [];
        const total = grouped[0]?.total_personas ?? 0;
        if (!grouped.length) return { rows: [] as ContactRow[], count: 0, grouped: true };
        const principalIds = grouped.map((g) => Number(g.id_entidad));
        const persMap = new Map(grouped.map((g) => [Number(g.id_entidad), Number(g.id_persona)]));
        const pagePersonaIds = Array.from(new Set(grouped.map((g) => Number(g.id_persona))));
        const totalPorPersona = new Map<number, number>();
        {
          const { data: allEnts } = await (supabase as any).from("entidades_relacionadas")
            .select("id_persona").in("id_persona", pagePersonaIds).in("id_tipo_entidad", [2, 7]).eq("activo", true);
          (allEnts ?? []).forEach((e: any) => totalPorPersona.set(e.id_persona, (totalPorPersona.get(e.id_persona) ?? 0) + 1));
        }
        const { data: ersData } = await (supabase as any).from("entidades_relacionadas")
          .select("id, id_persona, id_proyecto, id_tipo_entidad, fecha_creacion, fecha_actualizacion")
          .in("id", principalIds);
        const ers = (ersData ?? []).slice().sort((a: any, b: any) => principalIds.indexOf(a.id) - principalIds.indexOf(b.id));
        const rows = await hydrateRows(ers);
        rows.forEach((r) => {
          const pid = persMap.get(Number(r.id)) ?? null;
          r.id_persona = pid;
          r.otros_count = pid != null ? Math.max((totalPorPersona.get(pid) ?? 1) - 1, 0) : 0;
        });
        return { rows, count: total, grouped: true };
      }

      // Fallback por-entidad si el RPC no está disponible.
      let searchPersonaIds: number[] | null = null;
      if (search.trim()) {
        const { data: matchPers } = await (supabase as any).from("personas")
          .select("id").eq("activo", true)
          .or(`nombre_legal.ilike.%${search}%,nombre_comercial.ilike.%${search}%,email.ilike.%${search}%,telefono.ilike.%${search}%`);
        searchPersonaIds = (matchPers ?? []).map((p: any) => p.id);
        if (searchPersonaIds!.length === 0) return { rows: [] as ContactRow[], count: 0, grouped: false };
      }
      let sourceErIds: number[] | null = null;
      let excludeErIds: number[] = [];
      if (filterSource === "meta" || filterSource === "manual") {
        const { data: metaRows } = await (supabase as any).from("crm_leads_atribucion")
          .select("id_entidad_relacionada").eq("activo", true).not("meta_leadgen_id", "is", null);
        const metaIds = (metaRows ?? []).map((r: any) => Number(r.id_entidad_relacionada));
        if (filterSource === "meta") { sourceErIds = metaIds; if (!sourceErIds.length) return { rows: [] as ContactRow[], count: 0, grouped: false }; }
        else { excludeErIds = metaIds; }
      }
      let catErIds: number[] | null = null;
      if (filterCategoria !== "all") {
        const { data: catRows } = await (supabase as any).from("entidades_relacionadas_categorias")
          .select("id_entidad_relacionada").eq("activo", true).eq("id_categoria", Number(filterCategoria));
        catErIds = (catRows ?? []).map((r: any) => Number(r.id_entidad_relacionada));
        if (!catErIds.length) return { rows: [] as ContactRow[], count: 0, grouped: false };
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
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
      ]);
      if (pageRes.error) throw pageRes.error;
      const ers: any[] = pageRes.data ?? [];
      if (!ers.length) return { rows: [] as ContactRow[], count: countRes.count ?? 0, grouped: false };
      const rows = await hydrateRows(ers);
      return { rows, count: countRes.count ?? 0, grouped: false };
    },
  });

  const allRows = contacts?.rows ?? [];
  const rows = (contacts as any)?.grouped ? allRows : allRows.filter((c) => {
    if (filterStatus !== "all" && c.lead_status !== filterStatus) return false;
    if (stageTab === "mine" && c.contact_owner !== uid) return false;
    if (stageTab === "unassigned" && c.contact_owner !== null) return false;
    return true;
  });
  const totalCount = contacts?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE + PAGE_SIZE, totalCount);

  return (
    <>
      <PageHeader
        title="Contactos"
        description="Espejo de solo lectura del CRM — auditoría de todos los contactos y su estado en tiempo real."
        action={
          <Pill className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {totalCount.toLocaleString()} contactos
          </Pill>
        }
      />

      {/* Tabs */}
      <div className="mb-3 flex gap-1 border-b border-border">
        {CONTACT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setStageTab(t.id)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors duration-150 ${stageTab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CFilter value={filterDev} onChange={setFilterDev} placeholder="Proyecto"
          options={[{ v: "all", l: "Todos los proyectos" }, ...(developments ?? []).map((d: any) => ({ v: d.id, l: d.name }))]} />
        <CFilter value={filterSource} onChange={setFilterSource} placeholder="Fuente"
          options={[{ v: "all", l: "Todas las fuentes" }, { v: "meta", l: "Solo Meta" }, { v: "manual", l: "Manual" }]} />
        <CFilter value={filterStatus} onChange={setFilterStatus} placeholder="Estado del lead"
          options={[{ v: "all", l: "Todos estados" }, ...leadStates.map((s) => ({ v: s.value, l: s.label }))]} />
        {(categoriasCatalog as any[]).length > 0 && (
          <CFilter value={filterCategoria} onChange={setFilterCategoria} placeholder="Categoría"
            options={[{ v: "all", l: "Todas las categorías" }, ...(categoriasCatalog as any[]).map((c: any) => ({ v: String(c.id), l: c.nombre }))]} />
        )}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="p-3 flex items-center gap-2 border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre, email o teléfono" className="pl-8 h-8 text-sm" />
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setEditColumnsOpen(true)}>
            <Settings2 className="size-3 mr-1" /> Editar columnas
          </Button>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !rows.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No hay contactos que coincidan con los filtros.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm border-b border-border">
                <tr>
                  {visibleColumns.map((col) => (
                    <th key={col.id} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{col.label}</th>
                  ))}
                  <th className="w-8" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <Fragment key={c.id}>
                    <tr
                      className="border-t border-border hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/portal-alta-direccion/prospectos/${c.id}`)}
                      title="Ver detalle del contacto"
                    >
                      {visibleColumns.map((col) => (
                        <ContactCell key={col.id} col={col.id} c={c} catNameMap={catNameMap} leadStates={leadStates} />
                      ))}
                      <td className="pr-3 text-right text-muted-foreground">
                        <ChevronRight className="inline h-4 w-4" />
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Paginación */}
      <div className="mt-3 flex items-center justify-between px-0.5 text-xs text-muted-foreground">
        <span>
          {totalCount === 0 ? "Sin resultados" : <>{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} de {totalCount.toLocaleString()} contactos</>}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      </div>

      {/* Editor de columnas (solo preferencia local, no muta datos).
          Layout en columna: header + acciones fijas arriba, lista con scroll
          propio y footer fijo abajo — así se ven las 17 columnas sin cortar. */}
      <Sheet open={editColumnsOpen} onOpenChange={setEditColumnsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
          <SheetHeader className="p-6 pb-4 border-b border-border text-left space-y-1">
            <SheetTitle>Editar columnas</SheetTitle>
            <SheetDescription>
              Activa, desactiva y reordena las columnas de la tabla. Tu preferencia se guarda en este navegador.
            </SheetDescription>
          </SheetHeader>

          {/* Acciones rápidas */}
          <div className="flex items-center justify-between gap-2 px-6 py-3 border-b border-border bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {visibleColumns.length} de {columns.length} visibles
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={showAllColumns}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Mostrar todas
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={hideAllColumns}>
                <EyeOff className="h-3.5 w-3.5 mr-1" /> Solo Nombre
              </Button>
            </div>
          </div>

          {/* Lista con scroll independiente */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3 space-y-1.5">
            {columns.map((col, idx) => (
              <div
                key={col.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md border transition-colors",
                  col.visible ? "border-border bg-card" : "border-dashed border-border bg-muted/30",
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                <Checkbox checked={col.visible} onCheckedChange={() => toggleColumn(col.id)} id={`col-${col.id}`} />
                <label
                  htmlFor={`col-${col.id}`}
                  className={cn("flex-1 min-w-0 truncate text-sm cursor-pointer", !col.visible && "text-muted-foreground")}
                >
                  {col.label}
                </label>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveColumn(col.id, -1)} aria-label={`Subir ${col.label}`}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === columns.length - 1} onClick={() => moveColumn(col.id, 1)} aria-label={`Bajar ${col.label}`}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer fijo */}
          <div className="flex items-center justify-between gap-2 p-6 pt-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => persistColumns(DEFAULT_CONTACT_COLUMNS)}>Restablecer</Button>
            <Button size="sm" onClick={() => setEditColumnsOpen(false)}>Listo</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
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

/** Celda de la tabla (espejo del render del CRM). Solo lectura. */
function ContactCell({
  col, c, catNameMap, leadStates,
}: {
  col: ColumnId;
  c: ContactRow;
  catNameMap: Record<number, string>;
  leadStates: { value: string; label: string; color?: string }[];
}) {
  switch (col) {
    case "name":
      return (
        <td className="p-3 font-medium">
          <span className="flex items-center gap-2 max-w-[340px]">
            <span className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0 ring-1 ring-primary/15">
              {c.full_name.charAt(0).toUpperCase()}
            </span>
            <span className="flex flex-col min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-foreground">{c.full_name}</span>
                {c.otros_count ? <span className="text-[10px] font-medium text-muted-foreground shrink-0">+{c.otros_count}</span> : null}
              </span>
              {c.email ? <span className="truncate text-[11px] leading-tight text-muted-foreground mt-0.5">{c.email}</span> : null}
            </span>
          </span>
        </td>
      );
    case "categoria":
      return (
        <td className="p-3">
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
    case "proyecto":
      return (
        <td className="p-3">
          {c.development_name ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground whitespace-nowrap">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="max-w-[180px] truncate">{c.development_name}</span>
            </span>
          ) : <span className="text-xs text-muted-foreground">Sin proyecto</span>}
        </td>
      );
    case "email":
      return <td className="p-3 text-muted-foreground whitespace-nowrap">{c.email || "—"}</td>;
    case "phone":
      return <td className="p-3 text-muted-foreground whitespace-nowrap tabular-nums">{c.phone || "—"}</td>;
    case "lead_status": {
      const st = leadStates.find((s) => s.value === c.lead_status);
      const metaLabel = st?.label ?? leadStatusLabel[c.lead_status] ?? c.lead_status;
      const badgeStyle = st?.color
        ? { backgroundColor: `${st.color}1a`, color: st.color, borderColor: `${st.color}55` }
        : undefined;
      const cls = st?.color ? "" : (STATUS_COLOR[c.lead_status] ?? "bg-slate-50 text-slate-500 border-slate-200");
      return (
        <td className="p-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`} style={badgeStyle}>
            <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
            {metaLabel}
          </span>
        </td>
      );
    }
    case "lifecycle":
      return (
        <td className="p-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-muted/70 text-muted-foreground">
            {lifecycleLabel[c.lifecycle_stage] ?? c.lifecycle_stage}
          </span>
        </td>
      );
    case "owner":
      return <td className="p-3 text-muted-foreground whitespace-nowrap">{c.owner_name ?? "Sin asignar"}</td>;
    case "created":
      return <td className="p-3 text-muted-foreground whitespace-nowrap tabular-nums">{c.created_at ? fmtDate(c.created_at) : "—"}</td>;
    case "updated":
      return <td className="p-3 text-muted-foreground whitespace-nowrap tabular-nums">{c.last_activity_at ? fmtDate(c.last_activity_at) : "—"}</td>;
    case "source": {
      const o = (c.origen ?? "").trim();
      const fuente = ORIGEN_LABEL[o]
        ? ORIGEN_LABEL[o]
        : o
          ? { txt: `Web · ${o}`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
          : c.meta_platform
            ? ORIGEN_LABEL.meta
            : ORIGEN_LABEL.manual;
      return (
        <td className="p-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${fuente.cls}`}>{fuente.txt}</span>
        </td>
      );
    }
    case "meta_form_name":
      return (
        <td className="p-3 text-muted-foreground whitespace-nowrap">
          {c.meta_form_name ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">{c.meta_form_name}</span>
          ) : "—"}
        </td>
      );
    case "meta_campaign_id":
      return <td className="p-3 text-muted-foreground whitespace-nowrap font-mono text-xs">{c.meta_campaign_id || "—"}</td>;
    case "meta_ad_id":
      return <td className="p-3 text-muted-foreground whitespace-nowrap font-mono text-xs">{c.meta_ad_id || "—"}</td>;
    case "meta_platform":
      return (
        <td className="p-3 whitespace-nowrap">
          {c.meta_platform ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/5 text-primary border border-primary/20 uppercase">{c.meta_platform}</span>
          ) : "—"}
        </td>
      );
    case "meta_created_time":
      return <td className="p-3 text-muted-foreground whitespace-nowrap">{c.meta_created_time ? fmtDate(c.meta_created_time) : "—"}</td>;
    case "meta_field_data": {
      const count = Array.isArray(c.meta_field_data) ? c.meta_field_data.length : 0;
      return (
        <td className="p-3 whitespace-nowrap">
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
}

export default AltaDireccionContactos;
