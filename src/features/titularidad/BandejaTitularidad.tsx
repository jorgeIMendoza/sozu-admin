import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Eye, ChevronsUpDown, RotateCcw, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, KPICard, StatusBadge } from "@/pages/admin/portal-condominio/_helpers";
import { useTitularidadStore } from "./store";
import type { SolicitudTitularidad, Semaforo } from "./types";
import {
  SemaforoIndicator,
  ESTADO_SOLICITUD_LABEL,
  ESTADO_SOLICITUD_TONE,
  AREA_LABEL,
  TIPO_PERSONA_LABEL,
} from "./ui";

type SortKey = "prioridad" | "solicitante" | "semaforo" | "estado" | "dias" | "nivel";

const SEMAFORO_RANK: Record<Semaforo, number> = { rojo: 0, ambar: 1, verde: 2 };

export default function BandejaTitularidad() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const solicitudes = useTitularidadStore((s) => s.solicitudes);
  const setUsuario = useTitularidadStore((s) => s.setUsuario);
  const reset = useTitularidadStore((s) => s.reset);

  useEffect(() => {
    if (profile?.nombre) setUsuario(`${profile.nombre} (revisor)`);
  }, [profile?.nombre, setUsuario]);

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [areaFilter, setAreaFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [soloRojas, setSoloRojas] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("prioridad");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const kpis = useMemo(() => {
    return {
      nuevas: solicitudes.filter((s) => s.estado === "nueva").length,
      enRevision: solicitudes.filter((s) => s.estado === "en_revision").length,
      rojas: solicitudes.filter((s) => s.semaforoAgregado === "rojo").length,
      infoSolicitada: solicitudes.filter((s) => s.estado === "info_solicitada").length,
    };
  }, [solicitudes]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = solicitudes.filter((s) => {
      if (estadoFilter !== "todos" && s.estado !== estadoFilter) return false;
      if (areaFilter !== "todos" && s.areaAsignada !== areaFilter) return false;
      if (tipoFilter !== "todos" && s.tipoPersona !== tipoFilter) return false;
      if (soloRojas && s.semaforoAgregado !== "rojo") return false;
      if (!q) return true;
      return (
        s.nombreODireccionRazonSocial.toLowerCase().includes(q) ||
        s.unidad.toLowerCase().includes(q) ||
        (s.folioReal.valor ?? "").toLowerCase().includes(q) ||
        (s.rfc.valor ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });

    const cmp = (a: SolicitudTitularidad, b: SolicitudTitularidad): number => {
      switch (sortKey) {
        case "solicitante":
          return a.nombreODireccionRazonSocial.localeCompare(b.nombreODireccionRazonSocial, "es");
        case "semaforo":
          return SEMAFORO_RANK[a.semaforoAgregado] - SEMAFORO_RANK[b.semaforoAgregado];
        case "estado":
          return a.estado.localeCompare(b.estado, "es");
        case "dias":
          return a.diasEnCola - b.diasEnCola;
        case "nivel":
          return a.nivelSolicitado - b.nivelSolicitado;
        case "prioridad":
        default:
          // Bandera roja primero, luego mayor antigüedad en cola.
          if (SEMAFORO_RANK[a.semaforoAgregado] !== SEMAFORO_RANK[b.semaforoAgregado])
            return SEMAFORO_RANK[a.semaforoAgregado] - SEMAFORO_RANK[b.semaforoAgregado];
          return b.diasEnCola - a.diasEnCola;
      }
    };
    rows = [...rows].sort((a, b) => {
      const base = cmp(a, b);
      return sortDir === "asc" ? base : -base;
    });
    return rows;
  }, [solicitudes, search, estadoFilter, areaFilter, tipoFilter, soloRojas, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const Th = ({ label, sortable, k, align = "left" }: { label: string; sortable?: boolean; k?: SortKey; align?: "left" | "right" | "center" }) => (
    <th
      className={cn(
        "px-3 py-2 whitespace-nowrap",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        sortable && "cursor-pointer select-none hover:text-foreground",
      )}
      onClick={sortable && k ? () => toggleSort(k) : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortable && <ChevronsUpDown className={cn("h-3 w-3", sortKey === k ? "opacity-100" : "opacity-30")} />}
      </span>
    </th>
  );

  return (
    <div>
      <PageHeader
        title="Titularidad"
        subtitle="Solicitudes de validación de propiedad · Margot"
        actions={
          import.meta.env.DEV ? (
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 text-[13px]"
              onClick={reset}
              title="Repoblar datos mock (solo desarrollo)"
            >
              <RotateCcw className="h-4 w-4" /> Repoblar demo
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard title="Solicitudes nuevas" value={String(kpis.nuevas)} />
        <KPICard title="En revisión" value={String(kpis.enRevision)} />
        <KPICard title="Con bandera roja" value={String(kpis.rojas)} variant="danger" />
        <KPICard title="Info solicitada" value={String(kpis.infoSolicitada)} variant="warning" />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por solicitante, unidad o folio real…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm"
          />
        </div>
        <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-background text-sm">
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADO_SOLICITUD_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-background text-sm">
          <option value="todos">Todas las áreas</option>
          {Object.entries(AREA_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-background text-sm">
          <option value="todos">Física y moral</option>
          <option value="fisica">Persona física</option>
          <option value="moral">Persona moral</option>
        </select>
        <button
          type="button"
          onClick={() => setSoloRojas((v) => !v)}
          className={cn(
            "h-9 px-3 rounded-md border text-sm font-medium transition-colors inline-flex items-center gap-1.5",
            soloRojas
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
          Solo con bandera roja
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <Th label="Solicitante" sortable k="solicitante" />
              <Th label="Propiedad" />
              <Th label="Tipo" />
              <Th label="Antigüedad" />
              <Th label="Nivel sol." sortable k="nivel" align="center" />
              <Th label="Cruces" sortable k="semaforo" />
              <Th label="Estado" sortable k="estado" />
              <Th label="Área" />
              <Th label="Días en cola" sortable k="dias" align="right" />
              <Th label="Acción" align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtradas.map((s) => {
              const esRoja = s.semaforoAgregado === "rojo";
              return (
                <tr
                  key={s.id}
                  className={cn(
                    "hover:bg-muted/30",
                    esRoja && "border-l-2 border-l-destructive/50 bg-destructive/[0.02]",
                  )}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium truncate max-w-[220px]">{s.nombreODireccionRazonSocial}</p>
                    <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                      {s.id} · RFC {s.rfc.valor ?? "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p className="font-medium">Margot · {s.unidad}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">Folio {s.folioReal.valor ?? "—"} · {s.modelo}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">{TIPO_PERSONA_LABEL[s.tipoPersona]}</td>
                  <td className="px-3 py-2 text-xs">
                    {s.antiguedad === "reciente" ? (
                      <span className="text-warning">Reciente (&lt; 6 m)</span>
                    ) : (
                      <span className="text-muted-foreground">Normal</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{s.nivelSolicitado}</td>
                  <td className="px-3 py-2"><SemaforoIndicator s={s.semaforoAgregado} /></td>
                  <td className="px-3 py-2">
                    <StatusBadge label={ESTADO_SOLICITUD_LABEL[s.estado]} tone={ESTADO_SOLICITUD_TONE[s.estado]} />
                  </td>
                  <td className="px-3 py-2 text-xs">{s.areaAsignada ? AREA_LABEL[s.areaAsignada] : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={cn(s.diasEnCola >= 8 && "text-destructive font-semibold")}>{s.diasEnCola}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-[11px]"
                      onClick={() => navigate(`/admin/portal-condominio/titularidad/${s.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver detalle
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                  <FileCheck className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  Sin solicitudes para los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
