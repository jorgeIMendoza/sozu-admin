import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Search, Settings2, ChevronRight, ChevronDown,
  Globe, StickyNote, ClipboardList,
  Loader2, Check, TriangleAlert, Trash2, Star, Building2,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EmptyState } from "@/components/admin/portal-crm/ui";
import { lifecycleLabel, fmtDate, fmtDateTime } from "@/lib/crm-lib";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import { TextStyle as TextStyleExt } from "@tiptap/extension-text-style";

// ─── Constantes ────────────────────────────────────────────────────────────────

// Mismo catálogo de estatus de lead que Contactos (Meta Lead Ads).
const COMPANY_LEAD_STATUSES: { value: string; label: string }[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "en_curso", label: "En curso" },
  { value: "negocio_abierto", label: "Negocio abierto" },
  { value: "sin_calificar", label: "Sin calificar" },
  { value: "intento_contacto", label: "Intento de contacto" },
  { value: "conectado", label: "Conectado" },
  { value: "fuera_presupuesto", label: "Fuera de presupuesto" },
  { value: "compra_futura", label: "Compra futura" },
  { value: "sin_respuesta_7", label: "Sin respuesta 7+" },
  { value: "proveedor", label: "Proveedor" },
];

const LEAD_STATUS_COLOR: Record<string, string> = {
  nuevo: "bg-sky-50 text-sky-700 border-sky-200",
  en_curso: "bg-amber-50 text-amber-700 border-amber-200",
  negocio_abierto: "bg-emerald-50 text-emerald-700 border-emerald-200",
  conectado: "bg-primary/5 text-primary border-primary/20",
  sin_calificar: "bg-slate-50 text-slate-500 border-slate-200",
  intento_contacto: "bg-orange-50 text-orange-700 border-orange-200",
  fuera_presupuesto: "bg-red-50 text-red-600 border-red-200",
  compra_futura: "bg-violet-50 text-violet-700 border-violet-200",
  sin_respuesta_7: "bg-rose-50 text-rose-600 border-rose-200",
  proveedor: "bg-purple-50 text-purple-700 border-purple-200",
};

const LIFECYCLE_COLOR: Record<string, string> = {
  lead: "bg-sky-50 text-sky-700 border-sky-200",
  mql: "bg-amber-50 text-amber-700 border-amber-200",
  sql: "bg-orange-50 text-orange-700 border-orange-200",
  opportunity: "bg-violet-50 text-violet-700 border-violet-200",
  customer: "bg-primary/5 text-primary border-primary/20",
  evangelist: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SECTORES = [
  "Bienes raíces", "Construcción", "Retail", "Manufactura", "Servicios",
  "Tecnología", "Finanzas", "Salud", "Educación", "Hospitalidad",
  "Alimentos y bebidas", "Publicidad y marketing", "Consultoría", "Otro",
];

type ColumnId =
  | "nombre" | "dominio" | "telefono" | "sector" | "ciudad"
  | "owner" | "lifecycle" | "lead_status" | "created";

type ColumnConfig = { id: ColumnId; label: string; visible: boolean };

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "nombre", label: "Nombre de la empresa", visible: true },
  { id: "dominio", label: "Dominio", visible: true },
  { id: "telefono", label: "Teléfono", visible: true },
  { id: "sector", label: "Sector", visible: true },
  { id: "ciudad", label: "Ciudad", visible: true },
  { id: "owner", label: "Propietario", visible: true },
  { id: "lifecycle", label: "Etapa ciclo de vida", visible: true },
  { id: "lead_status", label: "Estado del lead", visible: false },
  { id: "created", label: "Fecha de creación", visible: true },
];

const COLUMNS_KEY = "sozu:companies:columns:v1";

function loadColumns(): ColumnConfig[] {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(COLUMNS_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as ColumnConfig[];
    const byId = new Map(parsed.map((c) => [c.id, c]));
    const merged = DEFAULT_COLUMNS.map((d) => byId.get(d.id) ?? d);
    return [
      ...parsed.filter((c) => merged.find((m) => m.id === c.id)).map((c) => merged.find((m) => m.id === c.id)!),
      ...merged.filter((m) => !parsed.find((c) => c.id === m.id)),
    ];
  } catch {
    return DEFAULT_COLUMNS;
  }
}

type CompanyRow = {
  id: string;
  nombre: string;
  dominio: string | null;
  telefono: string | null;
  sector: string | null;
  ciudad: string | null;
  id_propietario: string | null;
  owner_name: string | null;
  etapa_ciclo_vida: string;
  estatus_lead: string;
  created_at: string;
};

function useOwners() {
  return useQuery({
    queryKey: ["agentes-list"],
    queryFn: async () => {
      // rol_id 9 = "Agente Interno", rol_id 1 = "Super Administrador".
      const { data } = await (supabase as any).from("usuarios")
        .select("auth_user_id,nombre,email").eq("activo", true).in("rol_id", [1, 9]);
      return (data ?? []).map((u: any) => ({ id: u.auth_user_id, full_name: u.nombre, email: u.email })) as { id: string; full_name: string; email: string }[];
    },
  });
}

// ─── Lista de empresas ──────────────────────────────────────────────────────────

export function CrmCompanies() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("all");
  const [filterLifecycle, setFilterLifecycle] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;
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
  const visibleColumns = columns.filter((c) => c.visible);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-empresas", search, filterSector, filterLifecycle, page],
    queryFn: async () => {
      const build = (sel: string, opts?: Record<string, unknown>) => {
        let q = (supabase as any).from("crm_empresas").select(sel, opts ?? {}).eq("activo", true);
        if (search.trim()) q = q.or(`nombre.ilike.%${search}%,dominio.ilike.%${search}%,ciudad.ilike.%${search}%`);
        if (filterSector !== "all") q = q.eq("sector", filterSector);
        if (filterLifecycle !== "all") q = q.eq("etapa_ciclo_vida", filterLifecycle);
        return q;
      };

      const [countRes, pageRes] = await Promise.all([
        build("id", { count: "exact", head: true }),
        build("id, nombre, dominio, telefono, sector, ciudad, id_propietario, etapa_ciclo_vida, estatus_lead, fecha_creacion")
          .order("fecha_creacion", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1),
      ]);

      if (pageRes.error) throw pageRes.error;
      const empresas: any[] = pageRes.data ?? [];

      // Resolver nombres de propietarios.
      const ownerIds = Array.from(new Set(empresas.map((e) => e.id_propietario).filter(Boolean)));
      let ownerMap: Record<string, string> = {};
      if (ownerIds.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", ownerIds);
        ownerMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }

      const rows: CompanyRow[] = empresas.map((e) => ({
        id: String(e.id),
        nombre: e.nombre,
        dominio: e.dominio ?? null,
        telefono: e.telefono ?? null,
        sector: e.sector ?? null,
        ciudad: e.ciudad ?? null,
        id_propietario: e.id_propietario ?? null,
        owner_name: e.id_propietario ? (ownerMap[e.id_propietario] ?? null) : null,
        etapa_ciclo_vida: e.etapa_ciclo_vida ?? "lead",
        estatus_lead: e.estatus_lead ?? "nuevo",
        created_at: e.fecha_creacion ?? new Date().toISOString(),
      }));

      return { rows, count: countRes.count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize + pageSize, totalCount);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold">
          Empresas{" "}
          <span className="text-base text-muted-foreground font-normal">({totalCount.toLocaleString()})</span>
        </h1>
        <CreateCompanyDialog onCreated={() => qc.invalidateQueries({ queryKey: ["crm-empresas"] })} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <CFilter value={filterSector} onChange={(v) => { setFilterSector(v); setPage(0); }} placeholder="Sector"
          options={[{ v: "all", l: "Todos los sectores" }, ...SECTORES.map((s) => ({ v: s, l: s }))]} />
        <CFilter value={filterLifecycle} onChange={(v) => { setFilterLifecycle(v); setPage(0); }} placeholder="Etapa"
          options={[{ v: "all", l: "Todas las etapas" }, ...Object.entries(lifecycleLabel).map(([v, l]) => ({ v, l }))]} />
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="p-3 flex items-center gap-2 border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar nombre, dominio o ciudad" className="pl-8 h-8 text-sm focus-visible:ring-primary/50 focus-visible:border-primary/50" />
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
            <EmptyState title="No hay empresas" description="Crea tu primera empresa o ajusta los filtros de búsqueda." />
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
                    onClick={() => navigate(`/admin/portal-crm/ventas/empresas/${c.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/admin/portal-crm/ventas/empresas/${c.id}`); } }}
                    className="border-t border-border hover:bg-muted/50 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40 transition-colors duration-150 group"
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}><Checkbox /></td>
                    {visibleColumns.map((col) => {
                      switch (col.id) {
                        case "nombre":
                          return (
                            <td key={col.id} className="p-3 font-medium whitespace-nowrap">
                              <span className="inline-flex items-center gap-2.5 max-w-[280px]">
                                <span className="size-7 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/15">
                                  <Building2 className="size-3.5" />
                                </span>
                                <span className="truncate text-foreground group-hover:text-primary transition-colors">{c.nombre}</span>
                              </span>
                            </td>
                          );
                        case "dominio":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.dominio || "—"}</td>;
                        case "telefono":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap tabular-nums">{c.telefono || "—"}</td>;
                        case "sector":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.sector || "—"}</td>;
                        case "ciudad":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.ciudad || "—"}</td>;
                        case "owner":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap">{c.owner_name ?? "Sin propietario"}</td>;
                        case "lifecycle":
                          return (
                            <td key={col.id} className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${LIFECYCLE_COLOR[c.etapa_ciclo_vida] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                {lifecycleLabel[c.etapa_ciclo_vida] ?? c.etapa_ciclo_vida}
                              </span>
                            </td>
                          );
                        case "lead_status": {
                          const label = COMPANY_LEAD_STATUSES.find((s) => s.value === c.estatus_lead)?.label ?? c.estatus_lead;
                          return (
                            <td key={col.id} className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${LEAD_STATUS_COLOR[c.estatus_lead] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>{label}</span>
                            </td>
                          );
                        }
                        case "created":
                          return <td key={col.id} className="p-3 text-muted-foreground whitespace-nowrap tabular-nums">{fmtDate(c.created_at)}</td>;
                        default:
                          return null;
                      }
                    })}
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5 opacity-0 group-hover:opacity-100 transition-all duration-150" asChild>
                        <Link to={`/admin/portal-crm/ventas/empresas/${c.id}`} aria-label="Ver detalle">
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

      {/* Paginación */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span>
          {totalCount === 0 ? "Sin resultados" : <>{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} de {totalCount.toLocaleString()} empresas</>}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      </div>

      {/* Editar columnas */}
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
            <Button variant="ghost" size="sm" onClick={() => persistColumns(DEFAULT_COLUMNS)}>Restablecer</Button>
            <Button size="sm" onClick={() => setEditColumnsOpen(false)}>Listo</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CFilter({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string; options: { v: string; l: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function CField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

function CreateCompanyDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ nombre: "", dominio: "", telefono: "", sector: "", ciudad: "", etapa_ciclo_vida: "lead", estatus_lead: "nuevo" });

  const submit = async () => {
    if (!form.nombre.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).from("crm_empresas").insert({
        nombre: form.nombre.trim(),
        dominio: form.dominio.trim() || null,
        telefono: form.telefono.trim() || null,
        sector: form.sector || null,
        ciudad: form.ciudad.trim() || null,
        etapa_ciclo_vida: form.etapa_ciclo_vida,
        estatus_lead: form.estatus_lead,
        id_propietario: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      toast.success("Empresa creada");
      setOpen(false);
      setForm({ nombre: "", dominio: "", telefono: "", sector: "", ciudad: "", etapa_ciclo_vida: "lead", estatus_lead: "nuevo" });
      onCreated();
    } catch (e: any) {
      const msg = e?.message?.includes("uq_crm_empresas_dominio") ? "Ya existe una empresa con ese dominio." : (e?.message ?? "No se pudo crear la empresa");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="h-4 w-4 mr-1" />Crear empresa</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear empresa</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <CField label="Nombre de la empresa *"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></CField>
          <div className="grid grid-cols-2 gap-3">
            <CField label="Dominio"><Input placeholder="empresa.com" value={form.dominio} onChange={(e) => setForm({ ...form, dominio: e.target.value })} /></CField>
            <CField label="Teléfono"><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></CField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="Sector">
              <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>{SECTORES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </CField>
            <CField label="Ciudad"><Input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} /></CField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="Etapa del ciclo de vida">
              <Select value={form.etapa_ciclo_vida} onValueChange={(v) => setForm({ ...form, etapa_ciclo_vida: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(lifecycleLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </CField>
            <CField label="Estado del lead">
              <Select value={form.estatus_lead} onValueChange={(v) => setForm({ ...form, estatus_lead: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMPANY_LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </CField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !form.nombre.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {busy ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creando…</> : "Crear empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ficha de empresa ────────────────────────────────────────────────────────────

export function CrmCompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Acotar el <main> al alto visible para que cada panel scrollee por su cuenta (estilo HubSpot).
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

  const { data: company, isLoading, error } = useQuery({
    queryKey: ["crm-empresa", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("crm_empresas")
        .select("*").eq("id", Number(companyId)).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: owners } = useOwners();

  const { data: contacts } = useQuery({
    queryKey: ["crm-empresa-contactos", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_empresa_contactos")
        .select("id, id_entidad_relacionada, es_principal")
        .eq("id_empresa", Number(companyId)).eq("activo", true)
        .order("es_principal", { ascending: false });
      if (res.error) return [];
      const rows = res.data ?? [];
      if (!rows.length) return [];
      const erIds = rows.map((r: any) => r.id_entidad_relacionada);
      const { data: ers } = await (supabase as any).from("entidades_relacionadas")
        .select("id, id_persona").in("id", erIds);
      const personaIds = (ers ?? []).map((e: any) => e.id_persona).filter(Boolean);
      const { data: personas } = await (supabase as any).from("personas")
        .select("id, nombre_legal, nombre_comercial, email, telefono").in("id", personaIds);
      const pMap: Record<number, any> = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p]));
      const erMap: Record<number, any> = Object.fromEntries((ers ?? []).map((e: any) => [e.id, e]));
      return rows.map((r: any) => {
        const er = erMap[r.id_entidad_relacionada];
        const p = er ? pMap[er.id_persona] : null;
        return {
          assocId: r.id,
          contactId: String(r.id_entidad_relacionada),
          es_principal: r.es_principal,
          nombre: p ? (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim() : "Contacto",
          email: p?.email ?? null,
          telefono: p?.telefono ?? null,
        };
      });
    },
  });

  const { data: notes } = useQuery({
    queryKey: ["crm-empresa-notas", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_notas")
        .select("id, contenido, fecha_creacion, id_usuario, anclado")
        .eq("id_empresa", Number(companyId)).eq("activo", true)
        .order("anclado", { ascending: false })
        .order("fecha_creacion", { ascending: false });
      if (res.error) return [];
      const rows = res.data ?? [];
      const authorIds = Array.from(new Set(rows.map((n: any) => n.id_usuario).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (authorIds.length) {
        const { data: us } = await (supabase as any).from("usuarios").select("auth_user_id, nombre").in("auth_user_id", authorIds);
        nameMap = Object.fromEntries((us ?? []).map((u: any) => [u.auth_user_id, u.nombre]));
      }
      return rows.map((n: any) => ({ id: n.id, content: n.contenido, created_at: n.fecha_creacion, author: n.id_usuario ? (nameMap[n.id_usuario] ?? null) : null, anclado: n.anclado ?? false }));
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["crm-empresa-tareas", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_tareas")
        .select("id, titulo, tipo, prioridad, estatus, fecha_vencimiento, fecha_creacion")
        .eq("id_empresa", Number(companyId)).eq("activo", true)
        .order("fecha_vencimiento", { ascending: true });
      if (res.error) return [];
      return (res.data ?? []).map((t: any) => ({ id: t.id, title: t.titulo, status: t.estatus, priority: t.prioridad, due_date: t.fecha_vencimiento, created_at: t.fecha_creacion }));
    },
  });

  const invalidateAll = () => {
    ["crm-empresa", "crm-empresa-contactos", "crm-empresa-notas", "crm-empresa-tareas"].forEach(
      (k) => qc.invalidateQueries({ queryKey: [k, companyId] }),
    );
    qc.invalidateQueries({ queryKey: ["crm-empresas"] });
  };

  const completeTask = async (id: number) => {
    const { error } = await (supabase as any).from("crm_tareas").update({ estatus: "completada" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarea completada"); invalidateAll();
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

  if (isLoading) return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2"><Skeleton className="h-96 w-full" /></div>
        <div className="lg:col-span-3"><Skeleton className="h-64 w-full" /></div>
      </div>
    </div>
  );

  if (error || !company) {
    return (
      <Card className="m-4">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-destructive" />Empresa no encontrada</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Esta empresa no existe o no está disponible.</p>
          <Button variant="outline" size="sm" asChild><Link to="/admin/portal-crm/ventas/empresas"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const initials = (company.nombre ?? "?").split(" ").filter(Boolean).slice(0, 2).map((p: string) => p[0]).join("").toUpperCase() || "?";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-3 border-b border-border bg-card shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/5 -ml-2 transition-colors" asChild>
            <Link to="/admin/portal-crm/ventas/empresas"><ArrowLeft className="h-4 w-4 mr-1.5" />Empresas</Link>
          </Button>
          <span className="text-muted-foreground/40 text-sm">/</span>
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{company.nombre}</span>
        </div>
        <div className="flex gap-2">
          <NoteDialog companyId={companyId!} userId={user?.id} onSaved={invalidateAll} />
          <TaskDialog companyId={companyId!} owners={owners ?? []} onSaved={invalidateAll} />
        </div>
      </div>

      {/* 3 columnas */}
      <div className="grid grid-cols-12 flex-1 min-h-0 overflow-hidden">
        {/* Izquierda: perfil + info */}
        <aside className="col-span-3 border-r border-border p-5 space-y-5 bg-white h-full min-h-0 overflow-y-auto">
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xl font-bold select-none ring-4 ring-primary/5 shadow-sm">
              {company.url_logo ? <img src={company.url_logo} alt={company.nombre} className="h-full w-full object-contain rounded-xl" /> : initials}
            </div>
            <div className="text-center">
              <h2 className="font-semibold text-sm leading-tight">{company.nombre}</h2>
              {company.dominio && (
                <a href={`https://${company.dominio}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 mt-1 text-xs text-primary hover:underline">
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[150px]">{company.dominio}</span>
                </a>
              )}
              {company.telefono && <p className="text-xs text-muted-foreground mt-0.5">{company.telefono}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <NoteDialog companyId={companyId!} userId={user?.id} onSaved={invalidateAll}
              trigger={
                <button className="flex flex-col items-center gap-1 p-1.5 rounded-md hover:bg-primary/5 transition-colors w-full">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><StickyNote className="h-3.5 w-3.5" /></div>
                  <span className="text-[9px] text-muted-foreground leading-none">Nota</span>
                </button>
              } />
            <TaskDialog companyId={companyId!} owners={owners ?? []} onSaved={invalidateAll}
              trigger={
                <button className="flex flex-col items-center gap-1 p-1.5 rounded-md hover:bg-primary/5 transition-colors w-full">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ClipboardList className="h-3.5 w-3.5" /></div>
                  <span className="text-[9px] text-muted-foreground leading-none">Tarea</span>
                </button>
              } />
          </div>

          <Accordion type="single" collapsible defaultValue="info">
            <AccordionItem value="info" className="border-0">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-widest text-slate-500 hover:no-underline py-2 hover:text-primary transition-colors">
                Acerca de esta empresa
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0">
                <CompanyLeftPanel company={company} owners={owners ?? []} onSaved={invalidateAll} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>

        {/* Centro: actividad */}
        <section className="col-span-6 border-r border-border h-full min-h-0 overflow-hidden">
          <Tabs defaultValue="resumen" className="flex flex-col h-full min-h-0">
            <div className="border-b border-border shrink-0">
              <TabsList className="justify-start rounded-none bg-transparent h-auto px-4 gap-0">
                <TabsTrigger value="resumen" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Resumen</TabsTrigger>
                <TabsTrigger value="actividades" className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none">Actividades</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="resumen" className="p-4 mt-0 flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Aspectos destacados</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <HL label="Fecha de creación" value={company.fecha_creacion ? fmtDateTime(company.fecha_creacion) : "—"} />
                    <HL label="Etapa del ciclo de vida" value={lifecycleLabel[company.etapa_ciclo_vida] ?? company.etapa_ciclo_vida ?? "—"} />
                    <HL label="Sector" value={company.sector ?? "—"} />
                  </div>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Actividad reciente</h3>
                  <ActivityList notes={notes ?? []} tasks={tasks ?? []} onCompleteTask={completeTask} onDeleteTask={deleteTask} onDeleteNote={deleteNote} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="actividades" className="p-4 mt-0 flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-4">
                <InlineNoteForm companyId={companyId!} userId={user?.id} onSaved={invalidateAll} />
                <ActivityList notes={notes ?? []} tasks={tasks ?? []} onCompleteTask={completeTask} onDeleteTask={deleteTask} onDeleteNote={deleteNote} />
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* Derecha: entidades asociadas */}
        <aside className="col-span-3 p-4 bg-slate-50/40 h-full min-h-0 overflow-y-auto">
          <Accordion type="multiple" defaultValue={["contactos", "negocios", "tickets"]}>
            <AccordionItem value="contactos">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Contactos <span className="text-xs text-muted-foreground font-normal">{contacts?.length ?? 0}</span></span>
              </AccordionTrigger>
              <AccordionContent>
                <CompanyContactsPanel companyId={companyId!} contacts={contacts ?? []} onChanged={invalidateAll} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="negocios">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Negocios <span className="text-[10px] text-muted-foreground font-normal px-1.5 py-0.5 rounded bg-muted">Próximamente</span></span>
              </AccordionTrigger>
              <AccordionContent><p className="text-xs text-muted-foreground py-2">La gestión de negocios llegará en una fase posterior.</p></AccordionContent>
            </AccordionItem>

            <AccordionItem value="tickets" className="border-b-0">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-3">
                <span className="flex items-center gap-2">Tickets <span className="text-xs text-muted-foreground font-normal">0</span></span>
              </AccordionTrigger>
              <AccordionContent><p className="text-xs text-muted-foreground py-2">Sin tickets asociados.</p></AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>
      </div>
    </div>
  );
}

function HL({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value}</div>
    </div>
  );
}

function CompanyLeftPanel({ company, owners, onSaved }: any) {
  const [form, setForm] = useState({
    dominio: company.dominio ?? "", telefono: company.telefono ?? "", sector: company.sector ?? "",
    ciudad: company.ciudad ?? "", estado: company.estado ?? "", pais: company.pais ?? "",
    codigo_postal: company.codigo_postal ?? "", direccion: company.direccion ?? "",
    etapa_ciclo_vida: company.etapa_ciclo_vida ?? "lead", estatus_lead: company.estatus_lead ?? "nuevo",
    id_propietario: company.id_propietario ?? "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const run = async (patch: Record<string, unknown>) => {
    setStatus("saving");
    try {
      const { error } = await (supabase as any).from("crm_empresas").update(patch).eq("id", company.id);
      if (error) throw error;
      setStatus("saved");
      onSaved();
    } catch (e: any) {
      setStatus("error");
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <CField label="Dominio">
        <Input className="h-8 text-sm" value={form.dominio}
          onChange={(e) => setForm({ ...form, dominio: e.target.value })}
          onBlur={() => run({ dominio: form.dominio || null })} placeholder="empresa.com" />
      </CField>
      <CField label="Teléfono">
        <Input className="h-8 text-sm" value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          onBlur={() => run({ telefono: form.telefono || null })} placeholder="+52 55 0000 0000" />
      </CField>
      <CField label="Sector">
        <Select value={form.sector} onValueChange={(v) => { setForm({ ...form, sector: v }); run({ sector: v || null }); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin sector" /></SelectTrigger>
          <SelectContent>{SECTORES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </CField>
      <div className="grid grid-cols-2 gap-2">
        <CField label="Ciudad">
          <Input className="h-8 text-sm" value={form.ciudad}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
            onBlur={() => run({ ciudad: form.ciudad || null })} />
        </CField>
        <CField label="Estado">
          <Input className="h-8 text-sm" value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
            onBlur={() => run({ estado: form.estado || null })} />
        </CField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CField label="País">
          <Input className="h-8 text-sm" value={form.pais}
            onChange={(e) => setForm({ ...form, pais: e.target.value })}
            onBlur={() => run({ pais: form.pais || null })} />
        </CField>
        <CField label="Código postal">
          <Input className="h-8 text-sm" value={form.codigo_postal}
            onChange={(e) => setForm({ ...form, codigo_postal: e.target.value })}
            onBlur={() => run({ codigo_postal: form.codigo_postal || null })} />
        </CField>
      </div>
      <CField label="Dirección">
        <Input className="h-8 text-sm" value={form.direccion}
          onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          onBlur={() => run({ direccion: form.direccion || null })} />
      </CField>
      <CField label="Etapa del ciclo de vida">
        <Select value={form.etapa_ciclo_vida} onValueChange={(v) => { setForm({ ...form, etapa_ciclo_vida: v }); run({ etapa_ciclo_vida: v }); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(lifecycleLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </CField>
      <CField label="Estado del lead">
        <Select value={form.estatus_lead} onValueChange={(v) => { setForm({ ...form, estatus_lead: v }); run({ estatus_lead: v }); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{COMPANY_LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </CField>
      <CField label="Propietario">
        <Select value={form.id_propietario} onValueChange={(v) => { setForm({ ...form, id_propietario: v }); run({ id_propietario: v || null }); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin propietario" /></SelectTrigger>
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

// ─── Contactos asociados ──────────────────────────────────────────────────────

function CompanyContactsPanel({ companyId, contacts, onChanged }: { companyId: string; contacts: any[]; onChanged: () => void }) {
  const [addOpen, setAddOpen] = useState(false);

  const removeContact = async (assocId: number) => {
    const { error } = await (supabase as any).from("crm_empresa_contactos").update({ activo: false }).eq("id", assocId);
    if (error) { toast.error(error.message); return; }
    toast.success("Contacto desasociado"); onChanged();
  };

  const setPrincipal = async (assocId: number) => {
    // Solo una empresa principal por contacto no aplica aquí (es por empresa); marcamos el contacto principal de la empresa.
    await (supabase as any).from("crm_empresa_contactos").update({ es_principal: false }).eq("id_empresa", Number(companyId)).eq("activo", true);
    const { error } = await (supabase as any).from("crm_empresa_contactos").update({ es_principal: true }).eq("id", assocId);
    if (error) { toast.error(error.message); return; }
    toast.success("Contacto principal actualizado"); onChanged();
  };

  return (
    <div className="space-y-2 py-1">
      {!contacts.length ? (
        <p className="text-xs text-muted-foreground py-1">Sin contactos asociados.</p>
      ) : (
        contacts.map((c) => (
          <div key={c.assocId} className="group/c flex items-start gap-2 rounded-md border border-border bg-card p-2">
            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
              {c.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <Link to={`/admin/portal-crm/ventas/contactos/${c.contactId}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                {c.nombre}
              </Link>
              {c.email && <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>}
              {c.es_principal && <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium mt-0.5"><Star className="h-2.5 w-2.5 fill-current" />Principal</span>}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover/c:opacity-100 transition-opacity shrink-0"><ChevronDown className="h-4 w-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!c.es_principal && <DropdownMenuItem onClick={() => setPrincipal(c.assocId)}>Marcar como principal</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => removeContact(c.assocId)} className="text-destructive focus:text-destructive">Desasociar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))
      )}
      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setAddOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" />Asociar contacto
      </Button>
      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} companyId={companyId}
        existingIds={contacts.map((c) => c.contactId)} onAdded={onChanged} />
    </div>
  );
}

function AddContactDialog({ open, onOpenChange, companyId, existingIds, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; companyId: string; existingIds: string[]; onAdded: () => void }) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: results, isFetching } = useQuery({
    queryKey: ["crm-contact-search", search],
    enabled: open && search.trim().length >= 2,
    queryFn: async () => {
      const { data: matchPers } = await (supabase as any).from("personas")
        .select("id, nombre_legal, nombre_comercial, email, telefono").eq("activo", true)
        .or(`nombre_legal.ilike.%${search}%,nombre_comercial.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(20);
      const personaIds = (matchPers ?? []).map((p: any) => p.id);
      if (!personaIds.length) return [];
      const { data: ers } = await (supabase as any).from("entidades_relacionadas")
        .select("id, id_persona, id_tipo_entidad").in("id_persona", personaIds)
        .in("id_tipo_entidad", [2, 7]).eq("activo", true);
      const pMap: Record<number, any> = Object.fromEntries((matchPers ?? []).map((p: any) => [p.id, p]));
      return (ers ?? []).map((e: any) => {
        const p = pMap[e.id_persona];
        return {
          contactId: String(e.id),
          nombre: p ? (p.nombre_legal || p.nombre_comercial || "Sin nombre").trim() : "Contacto",
          email: p?.email ?? null,
        };
      });
    },
  });

  const add = async (contactId: string) => {
    setBusyId(contactId);
    try {
      const { error } = await (supabase as any).from("crm_empresa_contactos").insert({
        id_empresa: Number(companyId),
        id_entidad_relacionada: Number(contactId),
        es_principal: existingIds.length === 0,
      });
      if (error) throw error;
      toast.success("Contacto asociado");
      onAdded();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo asociar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Asociar contacto</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
            placeholder="Buscar contacto por nombre o email…" className="pl-8" />
        </div>
        <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
          {search.trim().length < 2 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Escribe al menos 2 caracteres para buscar.</p>
          ) : isFetching ? (
            <div className="space-y-2 py-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !results?.length ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin resultados.</p>
          ) : (
            results.map((r: any) => {
              const already = existingIds.includes(r.contactId);
              return (
                <div key={r.contactId} className="flex items-center gap-2 rounded-md border border-border p-2">
                  <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                    {r.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.nombre}</p>
                    {r.email && <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>}
                  </div>
                  <Button size="sm" variant={already ? "ghost" : "outline"} disabled={already || busyId === r.contactId}
                    onClick={() => add(r.contactId)} className="h-7 text-xs shrink-0">
                    {already ? "Asociado" : busyId === r.contactId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Asociar"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Panel de empresas para la ficha de Contacto (relación inversa) ────────────

export function ContactCompaniesPanel({ contactId }: { contactId: string }) {
  const { data: companies, isLoading } = useQuery({
    queryKey: ["crm-contacto-empresas", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const res = await (supabase as any).from("crm_empresa_contactos")
        .select("id_empresa, es_principal")
        .eq("id_entidad_relacionada", Number(contactId)).eq("activo", true)
        .order("es_principal", { ascending: false });
      if (res.error) return [];
      const rows = res.data ?? [];
      if (!rows.length) return [];
      const ids = rows.map((r: any) => r.id_empresa);
      const { data: emps } = await (supabase as any).from("crm_empresas")
        .select("id, nombre, dominio").in("id", ids).eq("activo", true);
      const eMap: Record<number, any> = Object.fromEntries((emps ?? []).map((e: any) => [e.id, e]));
      return rows
        .filter((r: any) => eMap[r.id_empresa])
        .map((r: any) => ({ id: String(r.id_empresa), es_principal: r.es_principal, ...eMap[r.id_empresa] }));
    },
  });

  if (isLoading) return <div className="py-2"><Skeleton className="h-10 w-full" /></div>;
  if (!companies?.length) return <p className="text-xs text-muted-foreground py-2">Sin empresas asociadas</p>;

  return (
    <div className="space-y-2 py-1">
      {companies.map((c: any) => (
        <Link key={c.id} to={`/admin/portal-crm/ventas/empresas/${c.id}`}
          className="group/e flex items-center gap-2 rounded-md border border-border bg-card p-2 hover:border-primary/40 transition-colors">
          <div className="size-7 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/15">
            <Building2 className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground group-hover/e:text-primary truncate">{c.nombre}</p>
            {c.dominio && <p className="text-[11px] text-muted-foreground truncate">{c.dominio}</p>}
          </div>
          {c.es_principal && <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium shrink-0"><Star className="h-2.5 w-2.5 fill-current" />Principal</span>}
        </Link>
      ))}
    </div>
  );
}

// ─── Notas y tareas ───────────────────────────────────────────────────────────

function RichNoteToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const setLink = () => {
    const url = window.prompt("URL del enlace:");
    if (!url) return;
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };
  const btnClass = (active?: boolean) =>
    `h-7 w-7 flex items-center justify-center rounded transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))} title="Negrita"><Bold className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))} title="Cursiva"><Italic className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive("underline"))} title="Subrayado"><UnderlineIcon className="h-3.5 w-3.5" /></button>
      <div className="w-px h-4 bg-border mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))} title="Lista"><List className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></button>
      <div className="w-px h-4 bg-border mx-1" />
      <button type="button" onClick={setLink} className={btnClass(editor.isActive("link"))} title="Enlace"><LinkIcon className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function InlineNoteForm({ companyId, userId, onSaved }: { companyId: string; userId?: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      ImageExt.configure({ inline: false, allowBase64: false }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      TextStyleExt,
    ],
    editorProps: { attributes: { class: "prose prose-sm max-w-none min-h-[80px] px-3 py-2 text-sm focus:outline-none" } },
    onUpdate: ({ editor }) => setIsEmpty(editor.isEmpty),
  });

  const save = async () => {
    if (!editor || editor.isEmpty) return;
    setSaving(true);
    const { error } = await (supabase as any).from("crm_notas").insert({
      id_empresa: Number(companyId),
      id_usuario: userId ?? null,
      contenido: editor.getHTML(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Nota guardada");
    editor.commands.clearContent();
    setIsEmpty(true);
    onSaved();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <RichNoteToolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex items-center justify-end px-3 py-2 border-t border-border bg-muted/20">
        <Button size="sm" onClick={save} disabled={saving || isEmpty} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</> : "Guardar nota"}
        </Button>
      </div>
    </div>
  );
}

function NoteDialog({ companyId, userId, onSaved, trigger }: { companyId: string; userId?: string; onSaved: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm"><StickyNote className="h-4 w-4 mr-1.5" />Nota</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Agregar nota</DialogTitle></DialogHeader>
        <InlineNoteForm companyId={companyId} userId={userId} onSaved={() => { onSaved(); setOpen(false); }} />
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ companyId, owners, onSaved, trigger }: { companyId: string; owners: { id: string; full_name: string; email: string }[]; onSaved: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ titulo: "", tipo: "seguimiento", prioridad: "normal", fecha_vencimiento: "", id_usuario_asignado: "" });

  const submit = async () => {
    if (!form.titulo.trim()) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("crm_tareas").insert({
        id_empresa: Number(companyId),
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        prioridad: form.prioridad,
        estatus: "pendiente",
        fecha_vencimiento: form.fecha_vencimiento || null,
        id_usuario_asignado: form.id_usuario_asignado || null,
      });
      if (error) throw error;
      toast.success("Tarea creada");
      setForm({ titulo: "", tipo: "seguimiento", prioridad: "normal", fecha_vencimiento: "", id_usuario_asignado: "" });
      onSaved();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la tarea");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm"><ClipboardList className="h-4 w-4 mr-1.5" />Tarea</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear tarea</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <CField label="Título *"><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></CField>
          <div className="grid grid-cols-2 gap-3">
            <CField label="Tipo">
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["seguimiento", "llamada", "email", "whatsapp", "visita"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </CField>
            <CField label="Prioridad">
              <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["baja", "normal", "alta", "urgente"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </CField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="Vencimiento"><Input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} /></CField>
            <CField label="Asignado a">
              <Select value={form.id_usuario_asignado} onValueChange={(v) => setForm({ ...form, id_usuario_asignado: v })}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? o.email}</SelectItem>)}</SelectContent>
              </Select>
            </CField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !form.titulo.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {busy ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creando…</> : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivityList({ notes, tasks, onCompleteTask, onDeleteTask, onDeleteNote }: any) {
  const items = [
    ...notes.map((n: any) => ({ kind: "note" as const, id: n.id, ts: n.created_at, ...n })),
    ...tasks.map((t: any) => ({ kind: "task" as const, id: t.id, ts: t.created_at, ...t })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  if (!items.length) {
    return (
      <div className="text-center py-8 border border-dashed border-primary/20 rounded-xl bg-primary/5">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <StickyNote className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Sin actividad todavía. Agrega una nota o una tarea.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((it) =>
        it.kind === "note" ? (
          <div key={`n-${it.id}`} className={`group/n border rounded-lg bg-card shadow-sm p-3 ${it.anclado ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">
                <span className="font-semibold">Nota</span>
                {it.author ? <span className="text-muted-foreground"> de {it.author}</span> : null}
                {it.anclado && <span className="ml-2 text-[10px] font-medium text-primary align-middle">📌 Anclada</span>}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => onDeleteNote(it.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover/n:opacity-100 transition-all" aria-label="Eliminar nota"><Trash2 className="h-3.5 w-3.5" /></button>
                <span className="text-xs text-muted-foreground/70 tabular-nums">{fmtDateTime(it.created_at)}</span>
              </div>
            </div>
            <div className="mt-1.5 prose prose-sm max-w-none text-foreground prose-p:my-0.5 prose-a:text-primary prose-img:rounded-md" dangerouslySetInnerHTML={{ __html: it.content }} />
          </div>
        ) : (
          <div key={`t-${it.id}`} className="group/t flex items-center gap-3 border border-border rounded-lg bg-card shadow-sm p-3">
            <div className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${it.status === "completada" ? "bg-emerald-500/15 text-emerald-700" : "bg-blue-500/15 text-blue-700"}`}>
              <ClipboardList className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium truncate ${it.status === "completada" ? "line-through text-muted-foreground" : ""}`}>{it.title}</div>
              <div className="text-xs text-muted-foreground">
                {it.status === "completada" ? "Completada" : it.due_date ? `Vence ${fmtDate(it.due_date)}` : "Sin fecha"}
                {it.priority && it.priority !== "normal" ? ` · ${it.priority}` : ""}
              </div>
            </div>
            {it.status !== "completada" && (
              <button onClick={() => onCompleteTask(it.id)} className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 opacity-0 group-hover/t:opacity-100 transition-opacity shrink-0">
                <Check className="h-3 w-3" />Completar
              </button>
            )}
            <button onClick={() => onDeleteTask(it.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover/t:opacity-100 transition-all shrink-0" aria-label="Eliminar tarea"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )
      )}
    </div>
  );
}
