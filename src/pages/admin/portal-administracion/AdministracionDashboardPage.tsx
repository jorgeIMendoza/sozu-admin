import { useMemo, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/admin/portal-administracion/ui";
import {
  SaludFinancieraWidgets,
  type SaludFinancieraData,
} from "@/components/admin/portal-administracion/SaludFinancieraWidgets";
import {
  useFacturasPorCobrar,
  type FacturaPorCobrar,
} from "@/hooks/useFacturasPorCobrar";
import {
  useFacturasPorPagar,
  type FacturaPorPagar,
  type TipoBeneficiario,
} from "@/hooks/useFacturasPorPagar";
import {
  useComisionesInternas,
  type ComisionInterna,
} from "@/hooks/useComisionesInternas";

/* ══════════════════════════════════════════════════════════
   Tipos de filtro
   ══════════════════════════════════════════════════════════ */

type DesarrolloFilter = string; // "all" | nombre real del proyecto
type Canal = TipoBeneficiario | "interno";
type CanalFilter = "all" | Canal;
type PeriodoFilter = "all" | "7" | "30" | "90";

const CANAL_LABEL: Record<CanalFilter, string> = {
  all: "Todos los canales",
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
  interno: "Interno (equipo SOZU)",
};

const PERIODO_LABEL: Record<PeriodoFilter, string> = {
  all: "Todo el período",
  "7": "Últimos 7 días",
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
};

/* ══════════════════════════════════════════════════════════
   Cómputo de SaludFinancieraData a partir de los hooks reales
   ══════════════════════════════════════════════════════════ */

function inPeriod(fechaStr: string | null | undefined, periodo: PeriodoFilter): boolean {
  if (periodo === "all") return true;
  if (!fechaStr) return false;
  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return false;
  const days = periodo === "7" ? 7 : periodo === "30" ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return fecha >= cutoff;
}

function computeSaludData({
  facturasCobrar,
  facturasPagar,
  comisionesInternas,
  desarrollo,
  canal,
  periodo,
}: {
  facturasCobrar: FacturaPorCobrar[];
  facturasPagar: FacturaPorPagar[];
  comisionesInternas: ComisionInterna[];
  desarrollo: DesarrolloFilter;
  canal: CanalFilter;
  periodo: PeriodoFilter;
}): SaludFinancieraData {
  /* ── Widget A: Facturas Por Cobrar — canal NO aplica ── */
  const cobrarFiltradas = facturasCobrar.filter(
    (f) =>
      (desarrollo === "all" || f.proyecto_nombre === desarrollo) &&
      inPeriod(f.fecha_emision, periodo),
  );
  const cobrarPending = cobrarFiltradas.filter(
    (f) => f.estado !== "cobrada" && f.estado !== "cancelada",
  );
  const cobrarMonto = cobrarPending.reduce(
    (s, f) => s + (f.monto_total - f.monto_cobrado),
    0,
  );
  const cobrarVencidas = cobrarPending.filter((f) => f.estado === "vencida");
  const cobrarVencidasMonto = cobrarVencidas.reduce(
    (s, f) => s + (f.monto_total - f.monto_cobrado),
    0,
  );
  const cobrarAvgAge =
    cobrarPending.length > 0
      ? Math.round(
          cobrarPending.reduce((s, f) => s + f.dias_desde_emision, 0) /
            cobrarPending.length,
        )
      : 0;

  /* ── Widget B: Facturas Por Pagar — desarrollo + canal + período ── */
  const canalAplicaExternos =
    canal === "all" ||
    canal === "inmobiliaria" ||
    canal === "broker" ||
    canal === "aliado_comercial" ||
    canal === "agente_externo";

  const pagarFiltradas = canalAplicaExternos
    ? facturasPagar.filter(
        (f) =>
          (desarrollo === "all" || f.proyecto_nombre === desarrollo) &&
          (canal === "all" || canal === f.beneficiario_tipo) &&
          inPeriod(f.fecha_emision, periodo),
      )
    : [];
  const pendienteEstados = ["en_revision", "aprobada_para_pago", "bloqueada"] as const;
  const pagarPendientes = pagarFiltradas.filter((f) =>
    pendienteEstados.includes(f.estado as (typeof pendienteEstados)[number]),
  );
  const listasParaPagar = pagarPendientes.filter(
    (f) => f.ya_se_cobro_al_desarrollador,
  );
  const bloqueadas = pagarPendientes.filter(
    (f) => !f.ya_se_cobro_al_desarrollador,
  );
  const pagarTotal = pagarPendientes.reduce((s, f) => s + f.monto_total, 0);
  const listasMonto = listasParaPagar.reduce((s, f) => s + f.monto_total, 0);
  const bloqueadasMonto = bloqueadas.reduce((s, f) => s + f.monto_total, 0);

  /* ── Widget C: Comisiones Internas — desarrollo + período ── */
  const canalAplicaInternas = canal === "all" || canal === "interno";
  const internasFiltradas = canalAplicaInternas
    ? comisionesInternas.filter(
        (c) =>
          (desarrollo === "all" || c.proyecto_nombre === desarrollo) &&
          inPeriod(c.fecha_devengo, periodo) &&
          c.estado === "aprobada",
      )
    : [];

  const internasMonto = internasFiltradas.reduce((s, c) => s + c.monto_comision, 0);
  const internasAvgAge =
    internasFiltradas.length > 0
      ? Math.round(
          internasFiltradas.reduce(
            (s, c) => s + (c.dias_esperando_director ?? 0),
            0,
          ) / internasFiltradas.length,
        )
      : 0;
  const internasMax =
    internasFiltradas.length > 0
      ? internasFiltradas.reduce((max, c) =>
          (c.dias_esperando_director ?? 0) > (max.dias_esperando_director ?? 0)
            ? c
            : max,
        )
      : null;

  /* ── Widget D: Financiamiento involuntario ── */
  const finCasos = pagarFiltradas.filter(
    (f) => f.estado === "pagada" && !f.ya_se_cobro_al_desarrollador,
  );
  const finMonto = finCasos.reduce((s, f) => s + f.monto_total, 0);

  return {
    dinero_por_cobrar: {
      empty: cobrarPending.length === 0,
      monto: cobrarMonto,
      facturas_count: cobrarPending.length,
      antiguedad_promedio_dias: cobrarAvgAge,
      facturas_vencidas: { count: cobrarVencidas.length, monto: cobrarVencidasMonto },
    },
    deuda_colaboradores: ({
      empty: pagarPendientes.length === 0,
      empty_reason: !canalAplicaExternos
        ? "El canal seleccionado no aplica a deuda con colaboradores externos"
        : undefined,
      monto_total: pagarTotal,
      listas_para_pagar: { count: listasParaPagar.length, monto: listasMonto },
      bloqueadas: { count: bloqueadas.length, monto: bloqueadasMonto },
    } as any),
    comisiones_internas_pendientes: {
      empty: internasFiltradas.length === 0,
      empty_reason: !canalAplicaInternas
        ? "Sin comisiones internas para este canal"
        : undefined,
      monto: internasMonto,
      comisionistas_count: internasFiltradas.length,
      antiguedad_promedio_dias: internasAvgAge,
      mas_antigua_dias: internasMax?.dias_esperando_director ?? 0,
      mas_antigua_persona: internasMax
        ? internasMax.comisionista_nombre.split(" ").slice(0, 2).join(" ")
        : "",
      mas_antigua_venta: internasMax ? internasMax.folio_comision : "",
    },
    financiamiento_involuntario: {
      empty: pagarFiltradas.length === 0,
      casos: finCasos.length,
      monto: finMonto,
    },
  };
}

/* ══════════════════════════════════════════════════════════
   Página Dashboard
   ══════════════════════════════════════════════════════════ */

export default function AdministracionDashboardPage() {
  const [desarrollo, setDesarrollo] = useState<DesarrolloFilter>("all");
  const [canal, setCanal] = useState<CanalFilter>("all");
  const [periodo, setPeriodo] = useState<PeriodoFilter>("all");

  const {
    data: facturasCobrar = [],
    isLoading: loadingCobrar,
    error: errorCobrar,
  } = useFacturasPorCobrar();
  const {
    data: facturasPagar = [],
    isLoading: loadingPagar,
    error: errorPagar,
  } = useFacturasPorPagar();
  const {
    data: comisionesInternas = [],
    isLoading: loadingInternas,
    error: errorInternas,
  } = useComisionesInternas();

  const isLoading = loadingCobrar || loadingPagar || loadingInternas;
  const error = errorCobrar || errorPagar || errorInternas;

  /* ─── Lista dinámica de desarrollos a partir de los datos reales ─── */
  const desarrolloOptions = useMemo(() => {
    const set = new Set<string>();
    facturasCobrar.forEach((f) => f.proyecto_nombre && set.add(f.proyecto_nombre));
    facturasPagar.forEach((f) => f.proyecto_nombre && set.add(f.proyecto_nombre));
    comisionesInternas.forEach((c) => c.proyecto_nombre && set.add(c.proyecto_nombre));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [facturasCobrar, facturasPagar, comisionesInternas]);

  const saludData = useMemo(
    () =>
      computeSaludData({
        facturasCobrar,
        facturasPagar,
        comisionesInternas,
        desarrollo,
        canal,
        periodo,
      }),
    [facturasCobrar, facturasPagar, comisionesInternas, desarrollo, canal, periodo],
  );

  const hayFiltros = desarrollo !== "all" || canal !== "all" || periodo !== "all";
  const limpiar = () => {
    setDesarrollo("all");
    setCanal("all");
    setPeriodo("all");
  };

  return (
    <>
      <PageHeader
        title="Dashboard Ejecutivo"
        description="Resumen financiero y comercial de SOZU"
      />

      {/* ─── Filtros ─── */}
      <Card className="mb-4 bg-card">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={desarrollo}
              onValueChange={(v) => setDesarrollo(v as DesarrolloFilter)}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los desarrollos</SelectItem>
                {desarrolloOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={canal} onValueChange={(v) => setCanal(v as CanalFilter)}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CANAL_LABEL) as CanalFilter[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CANAL_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={periodo}
              onValueChange={(v) => setPeriodo(v as PeriodoFilter)}
            >
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIODO_LABEL) as PeriodoFilter[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PERIODO_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hayFiltros && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs ml-auto"
                onClick={limpiar}
              >
                <X className="h-3 w-3 mr-1" /> Limpiar filtros
              </Button>
            )}
          </div>

          {hayFiltros && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {desarrollo !== "all" && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted"
                  onClick={() => setDesarrollo("all")}
                >
                  Desarrollo: {desarrollo}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {canal !== "all" && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted"
                  onClick={() => setCanal("all")}
                >
                  Canal: {CANAL_LABEL[canal]}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {periodo !== "all" && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted"
                  onClick={() => setPeriodo("all")}
                >
                  Período: {PERIODO_LABEL[periodo]}
                  <X className="h-3 w-3" />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Salud Financiera ─── */}
      {isLoading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
          Error al cargar el dashboard: {(error as Error).message}
        </div>
      ) : (
        <SaludFinancieraWidgets data={saludData} />
      )}
    </>
  );
}
