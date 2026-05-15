import { useMemo, useState } from "react";
import { X } from "lucide-react";
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
import { PageHeader, Pill } from "@/components/admin/portal-alta-direccion/ui";
import {
  SaludFinancieraWidgets,
  type SaludFinancieraData,
} from "@/components/admin/portal-alta-direccion/SaludFinancieraWidgets";

/* ══════════════════════════════════════════════════════════
   Ancla temporal del demo
   ══════════════════════════════════════════════════════════ */

const TODAY = new Date("2026-05-14T00:00:00");

/* ══════════════════════════════════════════════════════════
   Tipos de los mocks de filtrado
   ══════════════════════════════════════════════════════════ */

type Desarrollo = "Daiku" | "Bottura" | "Monócolo";
type Canal =
  | "inmobiliaria"
  | "broker"
  | "aliado_comercial"
  | "agente_externo"
  | "interno";

type FacturaCobrarMock = {
  id: string;
  desarrollo: Desarrollo;
  monto_total: number;
  monto_cobrado: number;
  fecha_emision: string;
  estado:
    | "timbrada_pendiente"
    | "cobro_parcial"
    | "cobrada"
    | "vencida"
    | "cancelada";
  dias_desde_emision: number;
};

type FacturaPagarMock = {
  id: string;
  desarrollo: Desarrollo;
  canal: Exclude<Canal, "interno">;
  monto_total: number;
  fecha_emision: string;
  estado:
    | "en_revision"
    | "aprobada_para_pago"
    | "pagada"
    | "bloqueada"
    | "rechazada";
  ya_se_cobro_al_desarrollador: boolean;
};

type ComisionInternaMock = {
  id: string;
  desarrollo: Desarrollo;
  comisionista_nombre: string;
  monto: number;
  estado: "devengada" | "aprobada" | "autorizada" | "dispersada" | "cancelada";
  fecha_devengo: string;
  dias_esperando_director?: number;
};

/* ══════════════════════════════════════════════════════════
   Mock arrays — paralelos a las páginas detalladas
   ══════════════════════════════════════════════════════════ */

const mockFacturasPorCobrar: FacturaCobrarMock[] = [
  { id: "F-S2026-0041", desarrollo: "Daiku",    monto_total: 94500,  monto_cobrado: 0,      fecha_emision: "2026-05-06", estado: "timbrada_pendiente", dias_desde_emision: 8  },
  { id: "F-S2026-0042", desarrollo: "Bottura",  monto_total: 120000, monto_cobrado: 0,      fecha_emision: "2026-05-10", estado: "timbrada_pendiente", dias_desde_emision: 4  },
  { id: "F-S2026-0038", desarrollo: "Daiku",    monto_total: 76500,  monto_cobrado: 76500,  fecha_emision: "2026-04-30", estado: "cobrada",            dias_desde_emision: 14 },
  { id: "F-S2026-0033", desarrollo: "Monócolo", monto_total: 58000,  monto_cobrado: 0,      fecha_emision: "2026-03-28", estado: "vencida",            dias_desde_emision: 47 },
  { id: "F-S2026-0040", desarrollo: "Bottura",  monto_total: 135000, monto_cobrado: 80000,  fecha_emision: "2026-04-26", estado: "cobro_parcial",      dias_desde_emision: 18 },
  { id: "F-S2026-0039", desarrollo: "Monócolo", monto_total: 42000,  monto_cobrado: 42000,  fecha_emision: "2026-04-20", estado: "cobrada",            dias_desde_emision: 24 },
  { id: "F-S2026-0044", desarrollo: "Daiku",    monto_total: 88000,  monto_cobrado: 0,      fecha_emision: "2026-04-08", estado: "vencida",            dias_desde_emision: 36 },
];

const mockFacturasPorPagar: FacturaPagarMock[] = [
  { id: "F-V-1184",    desarrollo: "Daiku",    canal: "inmobiliaria",     monto_total: 37800, fecha_emision: "2026-05-08", estado: "bloqueada",          ya_se_cobro_al_desarrollador: false },
  { id: "F-MX-3382",   desarrollo: "Bottura",  canal: "broker",           monto_total: 54000, fecha_emision: "2026-05-09", estado: "bloqueada",          ya_se_cobro_al_desarrollador: false },
  { id: "F-PM-2218",   desarrollo: "Daiku",    canal: "broker",           monto_total: 37380, fecha_emision: "2026-05-02", estado: "pagada",             ya_se_cobro_al_desarrollador: true  },
  { id: "F-CM-7711",   desarrollo: "Daiku",    canal: "agente_externo",   monto_total: 30600, fecha_emision: "2026-04-26", estado: "aprobada_para_pago", ya_se_cobro_al_desarrollador: true  },
  { id: "F-PR-2204",   desarrollo: "Bottura",  canal: "broker",           monto_total: 48000, fecha_emision: "2026-04-12", estado: "pagada",             ya_se_cobro_al_desarrollador: true  },
  { id: "F-VX-4421",   desarrollo: "Daiku",    canal: "inmobiliaria",     monto_total: 42000, fecha_emision: "2026-04-19", estado: "pagada",             ya_se_cobro_al_desarrollador: true  },
  { id: "F-RT-8810",   desarrollo: "Monócolo", canal: "aliado_comercial", monto_total: 19000, fecha_emision: "2026-04-22", estado: "en_revision",        ya_se_cobro_al_desarrollador: true  },
  { id: "F-OM-1130",   desarrollo: "Bottura",  canal: "inmobiliaria",     monto_total: 33000, fecha_emision: "2026-03-30", estado: "rechazada",          ya_se_cobro_al_desarrollador: true  },
];

const mockComisionesInternas: ComisionInternaMock[] = [
  { id: "COM-871", desarrollo: "Daiku",    comisionista_nombre: "Roberto Hernández Solís",  monto: 28350, estado: "aprobada",   fecha_devengo: "2026-05-06", dias_esperando_director: 7 },
  { id: "COM-872", desarrollo: "Daiku",    comisionista_nombre: "Ana Patricia Ruiz",         monto: 22680, estado: "aprobada",   fecha_devengo: "2026-05-06", dias_esperando_director: 7 },
  { id: "COM-873", desarrollo: "Bottura",  comisionista_nombre: "Roberto Hernández Solís",  monto: 36000, estado: "aprobada",   fecha_devengo: "2026-05-08", dias_esperando_director: 5 },
  { id: "COM-874", desarrollo: "Bottura",  comisionista_nombre: "Diego Soto Vargas",         monto: 19200, estado: "aprobada",   fecha_devengo: "2026-05-08", dias_esperando_director: 5 },
  { id: "COM-875", desarrollo: "Bottura",  comisionista_nombre: "Patricia Luna Olvera",      monto: 12000, estado: "aprobada",   fecha_devengo: "2026-05-08", dias_esperando_director: 5 },
  { id: "COM-862", desarrollo: "Bottura",  comisionista_nombre: "Roberto Hernández Solís",  monto: 57000, estado: "dispersada", fecha_devengo: "2026-02-26" },
  { id: "COM-863", desarrollo: "Bottura",  comisionista_nombre: "Patricia Luna Olvera",      monto: 19000, estado: "dispersada", fecha_devengo: "2026-02-26" },
  { id: "COM-854", desarrollo: "Bottura",  comisionista_nombre: "Roberto Hernández Solís",  monto: 40500, estado: "dispersada", fecha_devengo: "2026-03-15" },
  { id: "COM-855", desarrollo: "Bottura",  comisionista_nombre: "Ana Patricia Ruiz",         monto: 32400, estado: "dispersada", fecha_devengo: "2026-03-15" },
  { id: "COM-848", desarrollo: "Daiku",    comisionista_nombre: "Diego Soto Vargas",         monto: 14400, estado: "autorizada", fecha_devengo: "2026-05-08" },
  { id: "COM-847", desarrollo: "Daiku",    comisionista_nombre: "Lucía Hernández Ramírez",   monto:  9000, estado: "autorizada", fecha_devengo: "2026-05-08" },
];

/* ══════════════════════════════════════════════════════════
   Filtros + cómputo de SaludFinancieraData
   ══════════════════════════════════════════════════════════ */

type DesarrolloFilter = "all" | Desarrollo;
type CanalFilter = "all" | Canal;
type PeriodoFilter = "all" | "7" | "30" | "90";

function inPeriod(fechaStr: string, periodo: PeriodoFilter): boolean {
  if (periodo === "all") return true;
  const fecha = new Date(fechaStr + "T00:00:00");
  const days = periodo === "7" ? 7 : periodo === "30" ? 30 : 90;
  const cutoff = new Date(TODAY);
  cutoff.setDate(cutoff.getDate() - days);
  return fecha >= cutoff;
}

function computeSaludData(
  desarrollo: DesarrolloFilter,
  canal: CanalFilter,
  periodo: PeriodoFilter
): SaludFinancieraData {
  /* ── Widget A: Facturas Por Cobrar — canal NO aplica ── */
  const cobrarFiltradas = mockFacturasPorCobrar.filter(
    (f) =>
      (desarrollo === "all" || f.desarrollo === desarrollo) &&
      inPeriod(f.fecha_emision, periodo)
  );
  const cobrarPending = cobrarFiltradas.filter(
    (f) => f.estado !== "cobrada" && f.estado !== "cancelada"
  );
  const cobrarMonto = cobrarPending.reduce(
    (s, f) => s + (f.monto_total - f.monto_cobrado),
    0
  );
  const cobrarVencidas = cobrarPending.filter((f) => f.estado === "vencida");
  const cobrarVencidasMonto = cobrarVencidas.reduce(
    (s, f) => s + (f.monto_total - f.monto_cobrado),
    0
  );
  const cobrarAvgAge =
    cobrarPending.length > 0
      ? Math.round(
          cobrarPending.reduce((s, f) => s + f.dias_desde_emision, 0) /
            cobrarPending.length
        )
      : 0;

  /* ── Widget B: Facturas Por Pagar — desarrollo + canal + período ── */
  const pagarFiltradas = mockFacturasPorPagar.filter(
    (f) =>
      (desarrollo === "all" || f.desarrollo === desarrollo) &&
      (canal === "all" || canal === f.canal) &&
      inPeriod(f.fecha_emision, periodo)
  );
  const pendienteEstados = ["en_revision", "aprobada_para_pago", "bloqueada"] as const;
  const pagarPendientes = pagarFiltradas.filter((f) =>
    pendienteEstados.includes(f.estado as (typeof pendienteEstados)[number])
  );
  const listasParaPagar = pagarPendientes.filter(
    (f) => f.ya_se_cobro_al_desarrollador
  );
  const bloqueadas = pagarPendientes.filter(
    (f) => !f.ya_se_cobro_al_desarrollador
  );
  const pagarTotal = pagarPendientes.reduce((s, f) => s + f.monto_total, 0);
  const listasMonto = listasParaPagar.reduce((s, f) => s + f.monto_total, 0);
  const bloqueadasMonto = bloqueadas.reduce((s, f) => s + f.monto_total, 0);

  /* ── Widget C: Comisiones Internas — desarrollo + período ── */
  // Si canal está activo y NO es 'interno' o 'all', no aplican.
  const canalAplicaInternas = canal === "all" || canal === "interno";
  const internasFiltradas = canalAplicaInternas
    ? mockComisionesInternas.filter(
        (c) =>
          (desarrollo === "all" || c.desarrollo === desarrollo) &&
          inPeriod(c.fecha_devengo, periodo) &&
          c.estado === "aprobada"
      )
    : [];

  const internasMonto = internasFiltradas.reduce((s, c) => s + c.monto, 0);
  const internasAvgAge =
    internasFiltradas.length > 0
      ? Math.round(
          internasFiltradas.reduce(
            (s, c) => s + (c.dias_esperando_director ?? 0),
            0
          ) / internasFiltradas.length
        )
      : 0;
  const internasMax =
    internasFiltradas.length > 0
      ? internasFiltradas.reduce((max, c) =>
          (c.dias_esperando_director ?? 0) > (max.dias_esperando_director ?? 0)
            ? c
            : max
        )
      : null;

  /* ── Widget D: Financiamiento involuntario ── */
  // Cuenta items en pagar (filtrados) en estado 'pagada' que NO tenían
  // ya_se_cobro_al_desarrollador. En este demo siempre 0.
  const finCasos = pagarFiltradas.filter(
    (f) => f.estado === "pagada" && !f.ya_se_cobro_al_desarrollador
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
    deuda_colaboradores: {
      empty: pagarPendientes.length === 0,
      monto_total: pagarTotal,
      listas_para_pagar: { count: listasParaPagar.length, monto: listasMonto },
      bloqueadas: { count: bloqueadas.length, monto: bloqueadasMonto },
    },
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
      mas_antigua_venta: internasMax ? internasMax.id : "",
    },
    financiamiento_involuntario: {
      empty: pagarFiltradas.length === 0 && desarrollo !== "all", // sólo "empty" si el filtro vacía completamente
      casos: finCasos.length,
      monto: finMonto,
    },
  };
}

/* ══════════════════════════════════════════════════════════
   Helpers UI
   ══════════════════════════════════════════════════════════ */

const DemoBadge = () => (
  <Pill className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
    Datos demo
  </Pill>
);

const DESARROLLO_LABEL: Record<DesarrolloFilter, string> = {
  all: "Todos los desarrollos",
  Daiku: "Daiku",
  Bottura: "Bottura",
  Monócolo: "Monócolo",
};

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
   Página Dashboard
   ══════════════════════════════════════════════════════════ */

export default function AltaDireccionDashboardPage() {
  const [desarrollo, setDesarrollo] = useState<DesarrolloFilter>("all");
  const [canal, setCanal] = useState<CanalFilter>("all");
  const [periodo, setPeriodo] = useState<PeriodoFilter>("all");

  const saludData = useMemo(
    () => computeSaludData(desarrollo, canal, periodo),
    [desarrollo, canal, periodo]
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
        action={<DemoBadge />}
      />

      {/* ─── Filtros locales (reemplazan al GlobalFilterBar en esta ruta) ─── */}
      <Card className="mb-4 bg-card">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={desarrollo}
              onValueChange={(v) => setDesarrollo(v as DesarrolloFilter)}
            >
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DESARROLLO_LABEL) as DesarrolloFilter[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {DESARROLLO_LABEL[k]}
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

            <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFilter)}>
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

          {/* Chips de filtros activos */}
          {hayFiltros && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {desarrollo !== "all" && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted"
                  onClick={() => setDesarrollo("all")}
                >
                  Desarrollo: {DESARROLLO_LABEL[desarrollo]}
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

      {/* ─── Bloque hero: Salud Financiera (responde a filtros) ─── */}
      <SaludFinancieraWidgets data={saludData} />
    </>
  );
}
