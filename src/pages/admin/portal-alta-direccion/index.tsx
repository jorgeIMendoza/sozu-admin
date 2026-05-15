import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, Percent, Receipt, Clock, FileText,
  CheckCircle, AlertTriangle, Banknote, Landmark, Users, History,
  CalendarCheck, Briefcase, FileSignature, BarChart3, Settings, UserSearch,
} from "lucide-react";
import { Kpi, Panel, PageHeader, Pill } from "@/components/admin/portal-alta-direccion/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAltaDireccionFilters } from "@/contexts/AltaDireccionFiltersContext";
import { AUDIT_EVENTS, fmtMxn } from "@/data/altaDireccion/mockData";

const DemoBadge = () => (
  <Pill className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Datos demo</Pill>
);
const LiveBadge = () => (
  <Pill className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Datos en vivo</Pill>
);

// ============================ Dashboard ============================
// Movido a archivo dedicado para alojar mocks de filtrado + estado local.
export { default as AltaDireccionDashboard } from "./AltaDireccionDashboardPage";

// ============================ Comercial ============================
type CitaAgente = {
  nombre_legal: string;
  usuarios: { rol_id: number | null; roles: { nombre: string } | null }[] | null;
};
type CitaRow = {
  id: number;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  fecha_creacion: string | null;
  id_estatus_cita: number | null;
  estatus: string | null;
  activo: boolean;
  proyectos: { nombre: string } | null;
  estatus_cita: { nombre: string } | null;
  tipos_cita: { nombre: string } | null;
  prospecto: { nombre_legal: string } | null;
  agente: CitaAgente | null;
};

const ESTATUS_TONE: Record<number, string> = {
  1: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  2: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  3: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const fmtFolio = (id: number) => `CITA-${String(id).padStart(4, "0")}`;
const fmtHora = (t: string | null) => (t ? t.slice(0, 5) : "—");

function fmtCreacion(ts: string | null): { fecha: string; hora: string } {
  if (!ts) return { fecha: "—", hora: "" };
  const d = new Date(ts);
  if (isNaN(d.getTime())) return { fecha: "—", hora: "" };
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { fecha: `${yyyy}-${mm}-${dd}`, hora: `${hh}:${mi}` };
}

const norm = (s: string | null | undefined) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CHANNEL_ROLES: Record<string, string[]> = {
  inmobiliaria: ["inmobiliaria", "agente inmobiliario"],
  broker: ["broker"],
  embajador: ["embajador"],
  referido: ["referido"],
  interno: ["agente interno", "vendedor", "super administrador", "administrador de proyecto"],
};

function getPeriodRange(period: string | null): [Date, Date] | null {
  if (!period) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const y = today.getFullYear();
  const m = today.getMonth();
  if (period === "this_month") return [new Date(y, m, 1), new Date(y, m + 1, 1)];
  if (period === "last_month") return [new Date(y, m - 1, 1), new Date(y, m, 1)];
  if (period === "this_quarter") {
    const qStart = Math.floor(m / 3) * 3;
    return [new Date(y, qStart, 1), new Date(y, qStart + 3, 1)];
  }
  if (period === "this_year") return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  return null;
}

function getAgenteRol(c: CitaRow): string | null {
  const u = c.agente?.usuarios?.[0];
  return u?.roles?.nombre || null;
}

type EstadoKey = "agendada" | "pendiente" | "confirmada" | "asistio" | "cancelada" | "otro";

function getEstadoKey(c: CitaRow): EstadoKey {
  if (!c.activo || c.estatus === "cancelada") return "cancelada";
  if (c.estatus === "asistio") return "asistio";
  if (c.id_estatus_cita === 1) return "agendada";
  if (c.id_estatus_cita === 2) return "pendiente";
  if (c.id_estatus_cita === 3) return "confirmada";
  return "otro";
}

const ESTADO_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "agendada", label: "Agendada" },
  { value: "pendiente", label: "Pendiente de confirmación" },
  { value: "confirmada", label: "Confirmada" },
  { value: "asistio", label: "Asistió" },
  { value: "cancelada", label: "Cancelada" },
];

export function AltaDireccionCitas() {
  const { filters } = useAltaDireccionFilters();
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: citas = [], isLoading, error } = useQuery<CitaRow[]>({
    queryKey: ["alta-direccion-citas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reservas_citas")
        .select(
          "id, fecha, hora_inicio, hora_fin, fecha_creacion, id_estatus_cita, estatus, activo, " +
          "proyectos(nombre), estatus_cita(nombre), tipos_cita(nombre), " +
          "prospecto:personas!reservas_citas_id_persona_prospecto_fkey(nombre_legal), " +
          "agente:personas!reservas_citas_id_agente_fkey(nombre_legal, usuarios(rol_id, roles(nombre)))"
        )
        .order("fecha", { ascending: false })
        .order("hora_inicio", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as CitaRow[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const channel = (supabase as any)
      .channel("alta-direccion-citas-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas_citas" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["alta-direccion-citas"] });
        }
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [queryClient]);

  const parseFecha = (f: string) => {
    const [y, m, d] = f.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const filtradas = useMemo(() => {
    const projectQ = filters.projectId ? norm(filters.projectId) : null;
    const channelRoles = filters.channel ? CHANNEL_ROLES[filters.channel] : null;
    const periodRange = getPeriodRange(filters.period);
    const searchQ = filters.search ? norm(filters.search) : null;

    return citas.filter((c) => {
      if (projectQ) {
        if (norm(c.proyectos?.nombre) !== projectQ) return false;
      }
      if (channelRoles) {
        const rol = norm(getAgenteRol(c));
        if (!rol || !channelRoles.includes(rol)) return false;
      }
      if (periodRange) {
        const d = parseFecha(c.fecha);
        if (d < periodRange[0] || d >= periodRange[1]) return false;
      }
      if (estadoFilter !== "all") {
        if (getEstadoKey(c) !== estadoFilter) return false;
      }
      if (searchQ) {
        const hay = [
          c.prospecto?.nombre_legal,
          c.agente?.nombre_legal,
          c.proyectos?.nombre,
          fmtFolio(c.id),
        ].map(norm).join(" ");
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    });
  }, [citas, filters, estadoFilter]);

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();
    const lunesOffset = day === 0 ? -6 : 1 - day;
    const lunes = new Date(today);
    lunes.setDate(lunes.getDate() + lunesOffset);
    const finSemana = new Date(lunes);
    finSemana.setDate(finSemana.getDate() + 7);

    let semana = 0, confirmadas = 0, pendientes = 0;
    for (const c of filtradas) {
      const d = parseFecha(c.fecha);
      if (d >= lunes && d < finSemana) semana++;
      if (!c.activo || c.estatus === "cancelada") continue;
      if (c.id_estatus_cita === 3) confirmadas++;
      else if (c.id_estatus_cita === 1 || c.id_estatus_cita === 2) pendientes++;
    }
    return { semana, confirmadas, pendientes };
  }, [filtradas]);

  const hayFiltros = !!(filters.projectId || filters.channel || filters.period || filters.search || estadoFilter !== "all");
  const totalDesc = hayFiltros
    ? `${filtradas.length} de ${citas.length} citas`
    : `${citas.length} citas en total`;

  const estadoSelect = (
    <Select value={estadoFilter} onValueChange={setEstadoFilter}>
      <SelectTrigger className="h-8 w-[200px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ESTADO_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <PageHeader title="Citas Comerciales" description="Visitas y showrooms agendados" action={<LiveBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Citas esta semana" value={`${kpis.semana} ${kpis.semana === 1 ? "cita" : "citas"}`} icon={CalendarCheck} tone="primary" />
        <Kpi label="Confirmadas" value={`${kpis.confirmadas} ${kpis.confirmadas === 1 ? "cita" : "citas"}`} icon={CheckCircle} tone="success" />
        <Kpi label="Pendientes" value={`${kpis.pendientes} ${kpis.pendientes === 1 ? "cita" : "citas"}`} icon={Clock} tone="warning" />
      </div>
      <Panel title="Historial de citas" description={totalDesc} action={estadoSelect}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando citas…</p>
        ) : error ? (
          <p className="text-sm text-red-600 py-6 text-center">Error al cargar citas: {(error as Error).message}</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {hayFiltros ? "No hay citas que coincidan con los filtros." : "No hay citas registradas."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead><TableHead>Tipo</TableHead><TableHead>Cliente</TableHead>
                <TableHead>Cita (fecha · hora)</TableHead>
                <TableHead>Creada (fecha · hora)</TableHead>
                <TableHead>Desarrollo</TableHead><TableHead>Agente</TableHead><TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((c) => {
                const key = getEstadoKey(c);
                const tone =
                  key === "cancelada" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : key === "asistio" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : c.id_estatus_cita ? ESTATUS_TONE[c.id_estatus_cita]
                  : undefined;
                const estadoLabel =
                  key === "cancelada" ? "Cancelada"
                  : key === "asistio" ? "Asistió"
                  : c.estatus_cita?.nombre || c.estatus || "—";
                const creada = fmtCreacion(c.fecha_creacion);
                return (
                  <TableRow key={c.id} className={key === "cancelada" ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{fmtFolio(c.id)}</TableCell>
                    <TableCell>
                      <Pill className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        {c.tipos_cita?.nombre || "—"}
                      </Pill>
                    </TableCell>
                    <TableCell>{c.prospecto?.nombre_legal || "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.fecha}</div>
                      <div className="text-xs text-muted-foreground">{fmtHora(c.hora_inicio)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{creada.fecha}</div>
                      <div className="text-xs text-muted-foreground">{creada.hora}</div>
                    </TableCell>
                    <TableCell>{c.proyectos?.nombre || "—"}</TableCell>
                    <TableCell>{c.agente?.nombre_legal || "—"}</TableCell>
                    <TableCell><Pill className={tone}>{estadoLabel}</Pill></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}

type ProspectoRow = {
  id: number;
  fecha_creacion: string | null;
  activo: boolean;
  id_estatus_persona: number | null;
  personas: {
    nombre_legal: string;
    email: string | null;
    telefono: string | null;
    clave_pais_telefono: string | null;
  } | null;
  proyectos: { nombre: string } | null;
  agente: {
    nombre_legal: string;
    usuarios: { rol_id: number | null; roles: { nombre: string } | null }[] | null;
  } | null;
  estatus_persona: { nombre: string } | null;
};

const fmtLeadFolio = (id: number) => `LEAD-${String(id).padStart(4, "0")}`;

function getProspectoRol(p: ProspectoRow): string | null {
  return p.agente?.usuarios?.[0]?.roles?.nombre || null;
}

function rolToCanal(rol: string | null): string {
  if (!rol) return "—";
  const n = norm(rol);
  if (n.includes("inmobiliaria") || n.includes("agente inmobiliario")) return "Inmobiliaria";
  if (n.includes("broker")) return "Broker";
  if (n.includes("embajador")) return "Embajador";
  if (n.includes("referido")) return "Referido";
  if (n.includes("agente interno") || n.includes("vendedor") || n.includes("super administrador") || n.includes("administrador de proyecto")) return "Canal Interno";
  return rol;
}

type ActivoFilter = "active" | "deleted" | "all";

export function AltaDireccionProspectos() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [activoFilter, setActivoFilter] = useState<ActivoFilter>("active");
  const [estatusFilter, setEstatusFilter] = useState<string>("all");
  const [desarrolloFilter, setDesarrolloFilter] = useState<string>("all");
  const [agenteFilter, setAgenteFilter] = useState<string>("all");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  const { data: prospectos = [], isLoading, error } = useQuery<ProspectoRow[]>({
    queryKey: ["alta-direccion-prospectos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entidades_relacionadas")
        .select(
          "id, fecha_creacion, activo, id_estatus_persona, " +
          "personas!entidades_relacionadas_id_persona_fkey(nombre_legal, email, telefono, clave_pais_telefono), " +
          "proyectos!entidades_relacionadas_id_proyecto_fkey(nombre), " +
          "agente:personas!entidades_relacionadas_id_persona_duena_lead_fkey(nombre_legal, usuarios(rol_id, roles(nombre))), " +
          "estatus_persona(nombre)"
        )
        .eq("id_tipo_entidad", 7)
        .order("fecha_creacion", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as ProspectoRow[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const channel = (supabase as any)
      .channel("alta-direccion-prospectos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entidades_relacionadas" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["alta-direccion-prospectos"] });
        }
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [queryClient]);

  const estatusOptions = useMemo(() => {
    const seen = new Map<string, string>();
    let hasNull = false;
    for (const p of prospectos) {
      const n = p.estatus_persona?.nombre;
      if (n) seen.set(norm(n), n);
      else hasNull = true;
    }
    const list = Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
    if (hasNull) list.push("__SIN_ESTATUS__");
    return list;
  }, [prospectos]);

  const desarrolloOptions = useMemo(() => {
    const seen = new Set<string>();
    let hasNull = false;
    for (const p of prospectos) {
      const n = p.proyectos?.nombre;
      if (n) seen.add(n);
      else hasNull = true;
    }
    const list = Array.from(seen).sort((a, b) => a.localeCompare(b));
    if (hasNull) list.push("__SIN_DESARROLLO__");
    return list;
  }, [prospectos]);

  const agenteOptions = useMemo(() => {
    const seen = new Set<string>();
    let hasNull = false;
    for (const p of prospectos) {
      const n = p.agente?.nombre_legal;
      if (n) seen.add(n);
      else hasNull = true;
    }
    const list = Array.from(seen).sort((a, b) => a.localeCompare(b));
    if (hasNull) list.push("__SIN_AGENTE__");
    return list;
  }, [prospectos]);

  const filtradas = useMemo(() => {
    const searchQ = search ? norm(search) : null;
    const desdeD = desde ? new Date(desde + "T00:00:00") : null;
    const hastaD = hasta ? new Date(hasta + "T23:59:59.999") : null;

    return prospectos.filter((p) => {
      if (activoFilter === "active" && !p.activo) return false;
      if (activoFilter === "deleted" && p.activo) return false;

      if (estatusFilter !== "all") {
        if (estatusFilter === "__SIN_ESTATUS__") {
          if (p.estatus_persona?.nombre) return false;
        } else {
          if (norm(p.estatus_persona?.nombre) !== estatusFilter) return false;
        }
      }
      if (desarrolloFilter !== "all") {
        if (desarrolloFilter === "__SIN_DESARROLLO__") {
          if (p.proyectos?.nombre) return false;
        } else {
          if (p.proyectos?.nombre !== desarrolloFilter) return false;
        }
      }
      if (agenteFilter !== "all") {
        if (agenteFilter === "__SIN_AGENTE__") {
          if (p.agente?.nombre_legal) return false;
        } else {
          if (p.agente?.nombre_legal !== agenteFilter) return false;
        }
      }
      if (desdeD || hastaD) {
        if (!p.fecha_creacion) return false;
        const d = new Date(p.fecha_creacion);
        if (desdeD && d < desdeD) return false;
        if (hastaD && d > hastaD) return false;
      }
      if (searchQ) {
        const tel = `${p.personas?.clave_pais_telefono || ""}${p.personas?.telefono || ""}`;
        const hay = [
          p.personas?.nombre_legal,
          p.personas?.email,
          tel,
          p.personas?.telefono,
        ].map(norm).join(" ");
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    });
  }, [prospectos, search, activoFilter, estatusFilter, desarrolloFilter, agenteFilter, desde, hasta]);

  const kpis = useMemo(() => {
    let nuevos = 0, enCurso = 0, sinEstatus = 0;
    for (const p of filtradas) {
      if (p.id_estatus_persona === 3) nuevos++;
      else if (p.id_estatus_persona === 1) enCurso++;
      else if (p.id_estatus_persona == null) sinEstatus++;
    }
    return { total: filtradas.length, nuevos, enCurso, sinEstatus };
  }, [filtradas]);

  const hayFiltros =
    !!search || activoFilter !== "active" || estatusFilter !== "all" ||
    desarrolloFilter !== "all" || agenteFilter !== "all" || !!desde || !!hasta;

  const totalDesc = hayFiltros
    ? `${filtradas.length} de ${prospectos.length} prospectos`
    : `${prospectos.length} prospectos`;

  const limpiar = () => {
    setSearch("");
    setActivoFilter("active");
    setEstatusFilter("all");
    setDesarrolloFilter("all");
    setAgenteFilter("all");
    setDesde("");
    setHasta("");
  };

  return (
    <>
      <PageHeader title="Prospectos" description="Leads activos por canal y desarrollo" action={<LiveBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Kpi label="Leads activos" value={kpis.total} icon={UserSearch} tone="primary" />
        <Kpi label="Nuevos" value={kpis.nuevos} icon={TrendingUp} tone="success" />
        <Kpi label="En curso" value={kpis.enCurso} icon={Briefcase} tone="info" />
        <Kpi label="Sin estatus" value={kpis.sinEstatus} icon={AlertTriangle} tone="warning" />
      </div>

      <div className="mb-4 space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o correo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={activoFilter} onValueChange={(v) => setActivoFilter(v as ActivoFilter)}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="deleted">Eliminados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={estatusFilter} onValueChange={setEstatusFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Estatus" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estatus</SelectItem>
              {estatusOptions.map((s) => (
                <SelectItem key={s} value={s === "__SIN_ESTATUS__" ? "__SIN_ESTATUS__" : norm(s)}>
                  {s === "__SIN_ESTATUS__" ? "Sin estatus" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={desarrolloFilter} onValueChange={setDesarrolloFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Desarrollo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los desarrollos</SelectItem>
              {desarrolloOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d === "__SIN_DESARROLLO__" ? "Sin desarrollo" : d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={agenteFilter} onValueChange={setAgenteFilter}>
            <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Agente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los agentes</SelectItem>
              {agenteOptions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a === "__SIN_AGENTE__" ? "Sin agente" : a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Creados del</span>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-8 w-[150px] text-xs" />
            <span className="text-xs text-muted-foreground">al</span>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-8 w-[150px] text-xs" />
          </div>

          {hayFiltros && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limpiar}>
              <X className="h-3 w-3 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      <Panel title="Listado" description={totalDesc}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando prospectos…</p>
        ) : error ? (
          <p className="text-sm text-red-600 py-6 text-center">Error al cargar prospectos: {(error as Error).message}</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {hayFiltros ? "No hay prospectos que coincidan con los filtros." : "No hay prospectos registrados."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>Contacto</TableHead><TableHead>Canal</TableHead>
                <TableHead>Desarrollo</TableHead><TableHead>Agente</TableHead>
                <TableHead>Estatus</TableHead><TableHead>Creado (fecha · hora)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((p) => {
                const canal = rolToCanal(getProspectoRol(p));
                const estatus = p.estatus_persona?.nombre || "Sin estatus";
                const creado = fmtCreacion(p.fecha_creacion);
                const eliminado = !p.activo;
                return (
                  <TableRow key={p.id} className={eliminado ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">
                      {fmtLeadFolio(p.id)}
                      {eliminado && (
                        <Pill className="ml-2 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Eliminado</Pill>
                      )}
                    </TableCell>
                    <TableCell>{p.personas?.nombre_legal || "—"}</TableCell>
                    <TableCell>
                      <div className="text-xs">{p.personas?.email || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.personas?.telefono || "—"}</div>
                    </TableCell>
                    <TableCell>{canal}</TableCell>
                    <TableCell>{p.proyectos?.nombre || "—"}</TableCell>
                    <TableCell>{p.agente?.nombre_legal || "—"}</TableCell>
                    <TableCell><Pill>{estatus}</Pill></TableCell>
                    <TableCell>
                      <div className="font-medium">{creado.fecha}</div>
                      <div className="text-xs text-muted-foreground">{creado.hora}</div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}

export { default as AltaDireccionPipeline } from "./AltaDireccionPipelinePage";

const OFERTAS = [
  { id: "OFR-3001", cliente: "María García",  unidad: "Daiku A-201",    monto: 4500000, estado: "aprobada"  },
  { id: "OFR-3002", cliente: "Juan Pérez",    unidad: "Bottura PH-3",   monto: 7200000, estado: "pendiente" },
  { id: "OFR-3003", cliente: "Sofía Rivera",  unidad: "Monócolo B-105", monto: 3100000, estado: "rechazada" },
  { id: "OFR-3004", cliente: "Lucía H.",      unidad: "Daiku C-402",    monto: 5800000, estado: "pendiente" },
];

export function AltaDireccionOfertas() {
  const total = OFERTAS.reduce((s, o) => s + o.monto, 0);
  const pend = OFERTAS.filter((o) => o.estado === "pendiente").length;
  return (
    <>
      <PageHeader title="Ofertas" description="Aprobaciones y revisión ejecutiva" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Ofertas activas" value={OFERTAS.length} icon={FileText} tone="primary" />
        <Kpi label="Por aprobar" value={pend} icon={Clock} tone="warning" />
        <Kpi label="Monto total" value={fmtMxn(total)} icon={Banknote} tone="success" />
      </div>
      <Panel title="Lista">
        <Table>
          <TableHeader>
            <TableRow><TableHead>ID</TableHead><TableHead>Cliente</TableHead><TableHead>Unidad</TableHead><TableHead>Monto</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {OFERTAS.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.id}</TableCell>
                <TableCell>{o.cliente}</TableCell>
                <TableCell>{o.unidad}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(o.monto)}</TableCell>
                <TableCell><Pill>{o.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Operación ============================
const COBRANZA = [
  { id: "COB-001", cliente: "María García",  unidad: "Daiku A-201",  saldo: 0,        total: 4500000, estado: "pagada"   },
  { id: "COB-002", cliente: "Juan Pérez",    unidad: "Bottura PH-3", saldo: 5400000,  total: 7200000, estado: "al_dia"   },
  { id: "COB-003", cliente: "Sofía Rivera",  unidad: "Monócolo B-1", saldo: 1800000,  total: 3100000, estado: "vencida"  },
];

export function AltaDireccionCobranza() {
  const cobrado = COBRANZA.reduce((s, c) => s + (c.total - c.saldo), 0);
  const por_cobrar = COBRANZA.reduce((s, c) => s + c.saldo, 0);
  return (
    <>
      <PageHeader title="Cobranza" description="Resumen ejecutivo de cuentas" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Kpi label="Cuentas activas" value={COBRANZA.length} icon={Landmark} tone="primary" />
        <Kpi label="Cobrado" value={fmtMxn(cobrado)} icon={CheckCircle} tone="success" />
        <Kpi label="Por cobrar" value={fmtMxn(por_cobrar)} icon={Clock} tone="warning" />
        <Kpi label="Vencidas" value={COBRANZA.filter((c) => c.estado === "vencida").length} icon={AlertTriangle} tone="destructive" />
      </div>
      <Panel title="Cuentas">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Unidad</TableHead><TableHead>Total</TableHead><TableHead>Saldo</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {COBRANZA.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.cliente}</TableCell>
                <TableCell>{c.unidad}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(c.total)}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(c.saldo)}</TableCell>
                <TableCell><Pill>{c.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

const CONTRATOS = [
  { id: "CTR-201", cliente: "María García", unidad: "Daiku A-201",  fecha: "2026-04-12", estado: "firmado"  },
  { id: "CTR-202", cliente: "Juan Pérez",   unidad: "Bottura PH-3", fecha: "2026-05-02", estado: "pendiente" },
  { id: "CTR-203", cliente: "Sofía Rivera", unidad: "Monócolo B-1", fecha: "2026-05-09", estado: "firmado"  },
];

export function AltaDireccionContratos() {
  return (
    <>
      <PageHeader title="Contratos" description="Estatus de contratos firmados y pendientes" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Total" value={CONTRATOS.length} icon={FileSignature} tone="primary" />
        <Kpi label="Firmados" value={CONTRATOS.filter((c) => c.estado === "firmado").length} icon={CheckCircle} tone="success" />
        <Kpi label="Pendientes" value={CONTRATOS.filter((c) => c.estado === "pendiente").length} icon={Clock} tone="warning" />
      </div>
      <Panel title="Listado">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Unidad</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {CONTRATOS.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.cliente}</TableCell>
                <TableCell>{c.unidad}</TableCell>
                <TableCell>{c.fecha}</TableCell>
                <TableCell><Pill>{c.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

const FACTURAS = [
  { id: "F-A4501", cliente: "María García", concepto: "Enganche Daiku A-201", monto: 450000,  fecha: "2026-04-15", estado: "timbrada" },
  { id: "F-A4502", cliente: "Juan Pérez",   concepto: "Apartado Bottura",     monto: 100000,  fecha: "2026-05-02", estado: "timbrada" },
  { id: "F-A4503", cliente: "Sofía Rivera", concepto: "Liquidación",          monto: 1800000, fecha: "2026-05-09", estado: "pendiente" },
];

export function AltaDireccionFacturas() {
  const total = FACTURAS.reduce((s, f) => s + f.monto, 0);
  return (
    <>
      <PageHeader title="Facturas" description="CFDIs emitidos y pendientes" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Facturas" value={FACTURAS.length} icon={Receipt} tone="primary" />
        <Kpi label="Monto facturado" value={fmtMxn(total)} icon={Banknote} tone="success" />
        <Kpi label="Pendientes" value={FACTURAS.filter((f) => f.estado === "pendiente").length} icon={Clock} tone="warning" />
      </div>
      <Panel title="CFDIs">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Concepto</TableHead><TableHead>Monto</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {FACTURAS.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.id}</TableCell>
                <TableCell>{f.cliente}</TableCell>
                <TableCell>{f.concepto}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(f.monto)}</TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell><Pill>{f.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

const COMISIONES = [
  { id: "COM-118", agente: "Carlos Mendoza", canal: "Inmobiliaria", monto: 90000,  estado: "pagada"   },
  { id: "COM-119", agente: "Ana Ruiz",       canal: "Broker",       monto: 144000, estado: "aprobada" },
  { id: "COM-120", agente: "Diego Soto",     canal: "Embajador",    monto: 62000,  estado: "devengada"},
];

export function AltaDireccionComisiones() {
  const dev = COMISIONES.filter((c) => c.estado === "devengada").reduce((s, c) => s + c.monto, 0);
  const apr = COMISIONES.filter((c) => c.estado === "aprobada").reduce((s, c) => s + c.monto, 0);
  const pag = COMISIONES.filter((c) => c.estado === "pagada").reduce((s, c) => s + c.monto, 0);
  return (
    <>
      <PageHeader title="Comisiones" description="Devengadas, aprobadas y pagadas" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Devengadas" value={fmtMxn(dev)} icon={Percent} tone="primary" />
        <Kpi label="Aprobadas" value={fmtMxn(apr)} icon={CheckCircle} tone="success" />
        <Kpi label="Pagadas" value={fmtMxn(pag)} icon={Banknote} />
      </div>
      <Panel title="Detalle">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Folio</TableHead><TableHead>Agente</TableHead><TableHead>Canal</TableHead><TableHead>Monto</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {COMISIONES.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.agente}</TableCell>
                <TableCell>{c.canal}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(c.monto)}</TableCell>
                <TableCell><Pill>{c.estado}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

// ============================ Administración ============================
const PERSONAS = [
  { id: "P-1", nombre: "Carlos Mendoza", rol: "Agente Sozu",        canal: "Interno",      ventas: 8, comision: 720000 },
  { id: "P-2", nombre: "Ana Ruiz",       rol: "Broker",             canal: "Broker",       ventas: 5, comision: 540000 },
  { id: "P-3", nombre: "Diego Soto",     rol: "Embajador",          canal: "Embajador",    ventas: 3, comision: 186000 },
  { id: "P-4", nombre: "Inmobiliaria X", rol: "Agencia",            canal: "Inmobiliaria", ventas: 12, comision: 1080000 },
];

export function AltaDireccionRedComercial() {
  return (
    <>
      <PageHeader title="Red Comercial" description="Agentes, brokers, embajadores e inmobiliarias" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi label="Personas activas" value={PERSONAS.length} icon={Users} tone="primary" />
        <Kpi label="Ventas totales" value={PERSONAS.reduce((s, p) => s + p.ventas, 0)} icon={Briefcase} tone="success" />
        <Kpi label="Comisión devengada" value={fmtMxn(PERSONAS.reduce((s, p) => s + p.comision, 0))} icon={Percent} />
      </div>
      <Panel title="Top performers">
        <Table>
          <TableHeader>
            <TableRow><TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>Rol</TableHead><TableHead>Canal</TableHead><TableHead>Ventas</TableHead><TableHead>Comisión</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {PERSONAS.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.id}</TableCell>
                <TableCell>{p.nombre}</TableCell>
                <TableCell><Pill>{p.rol}</Pill></TableCell>
                <TableCell>{p.canal}</TableCell>
                <TableCell className="tabular-nums">{p.ventas}</TableCell>
                <TableCell className="tabular-nums">{fmtMxn(p.comision)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

export function AltaDireccionReportes() {
  const reportes = [
    { id: "R-1", nombre: "Cierres del mes",     desc: "Ventas escrituradas y apartados" },
    { id: "R-2", nombre: "Pipeline por canal",  desc: "Distribución y conversión" },
    { id: "R-3", nombre: "Cobranza vencida",    desc: "Cuentas con > 30 días" },
    { id: "R-4", nombre: "Comisiones a pagar",  desc: "Devengadas y aprobadas" },
    { id: "R-5", nombre: "Inventario por desarrollo", desc: "Disponible / vendido / apartado" },
    { id: "R-6", nombre: "Facturación CFDI",    desc: "Resumen mensual" },
  ];
  return (
    <>
      <PageHeader title="Reportes" description="Indicadores y descargas ejecutivas" action={<DemoBadge />} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reportes.map((r) => (
          <Panel key={r.id} title={r.nombre} description={r.desc}>
            <p className="text-xs text-muted-foreground">Disponible próximamente — descarga ejecutiva en CSV/Excel.</p>
          </Panel>
        ))}
      </div>
    </>
  );
}

export function AltaDireccionAuditoria() {
  return (
    <>
      <PageHeader title="Auditoría" description="Bitácora ejecutiva de eventos del sistema" action={<DemoBadge />} />
      <Panel title="Eventos recientes">
        <ul className="space-y-3 text-sm">
          {AUDIT_EVENTS.map((e) => (
            <li key={e.id} className="flex items-start gap-2 border-b last:border-0 border-border pb-3 last:pb-0">
              <History className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground">{e.text}</p>
                <p className="text-xs text-muted-foreground">{e.at}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

export function AltaDireccionConfiguracion() {
  return (
    <>
      <PageHeader title="Configuración" description="Parámetros del Portal Alta Dirección" action={<DemoBadge />} />
      <Panel title="Preferencias" description="Configuración general del portal">
        <p className="text-sm text-muted-foreground">
          Aquí vivirán: umbrales de KPIs, alertas críticas, integraciones con BI y reglas de visibilidad por desarrollo.
          Estado actual: demo.
        </p>
      </Panel>
    </>
  );
}