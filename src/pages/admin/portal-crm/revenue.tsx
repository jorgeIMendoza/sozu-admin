import { useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Target, LineChart as LineChartIcon, Briefcase,
  Activity, Users2, AlertTriangle, FileText, Download, Filter,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, MockBadge, Panel } from "@/components/admin/portal-crm/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtMXN, fmtNum, fmtPct } from "@/data/portal-crm/mockData";

// ===================================================================
// Mock data — Fase 4 (Dirección · Inteligencia de ingresos)
// ===================================================================

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const EXEC_KPIS = [
  { label: "Pipeline activo",          value: 78_400_000, delta: 0.124, hint: "vs mes previo" },
  { label: "Reservas (MTD)",           value: 12_300_000, delta: 0.082, hint: "12 reservas" },
  { label: "Contratos firmados (MTD)", value:  9_150_000, delta: -0.031, hint: "8 contratos" },
  { label: "Win rate Lead→Contrato",   value: 0.184,      delta: 0.018, hint: "ventana 90d", pct: true },
];

const REVENUE_MONTHLY = [
  { m: "Ene", real: 14_200_000, plan: 13_000_000 },
  { m: "Feb", real: 12_800_000, plan: 13_500_000 },
  { m: "Mar", real: 16_400_000, plan: 14_000_000 },
  { m: "Abr", real: 15_100_000, plan: 14_500_000 },
  { m: "May", real: 17_900_000, plan: 15_000_000 },
  { m: "Jun", real: 18_650_000, plan: 16_000_000 },
];

const FORECAST_ROWS = [
  { period: "Jul 2026", commit: 14_500_000, best: 18_200_000, pipeline: 26_400_000, quota: 16_000_000 },
  { period: "Ago 2026", commit: 15_200_000, best: 19_800_000, pipeline: 28_100_000, quota: 17_000_000 },
  { period: "Sep 2026", commit: 13_400_000, best: 17_900_000, pipeline: 24_700_000, quota: 17_500_000 },
  { period: "Q3 2026",  commit: 43_100_000, best: 55_900_000, pipeline: 79_200_000, quota: 50_500_000 },
];

const PIPELINE_HEALTH = [
  { stage: "Lead",        count: 412, value: 412_000_000, aging: 4,  conv: 0.45 },
  { stage: "Calificado",  count: 184, value: 220_000_000, aging: 7,  conv: 0.52 },
  { stage: "Propuesta",   count:  96, value: 145_000_000, aging: 12, conv: 0.49 },
  { stage: "Negociación", count:  47, value:  78_000_000, aging: 18, conv: 0.47 },
  { stage: "Ganado",      count:  22, value:  38_000_000, aging: 0,  conv: 1.00 },
];

const PIPELINE_REVIEW = [
  { id: "d2",  contact: "Bruno Sánchez",  dev: "Reserva 360 · GDL",  stage: "Propuesta",   value: 3_150_000, owner: "Miguel Castro", risk: "medio", next: "Enviar comparativo" },
  { id: "d3",  contact: "Carla Méndez",   dev: "Vivenza · CDMX",     stage: "Negociación", value: 1_980_000, owner: "Karla Ríos",    risk: "alto",  next: "Llamada cierre" },
  { id: "d9",  contact: "Luis Romero",    dev: "Altea · QRO",        stage: "Negociación", value: 2_540_000, owner: "Paola Téllez",  risk: "bajo",  next: "Visita en obra" },
  { id: "d11", contact: "Sofía Valdés",   dev: "Vivenza · CDMX",     stage: "Propuesta",   value: 4_300_000, owner: "Karla Ríos",    risk: "alto",  next: "Revisar objeción precio" },
  { id: "d14", contact: "Mariana Iturbe", dev: "Reserva 360 · GDL",  stage: "Negociación", value: 3_780_000, owner: "Miguel Castro", risk: "medio", next: "Confirmar enganche" },
];

const REVENUE_OPS = {
  kpis: [
    { label: "Velocidad del deal",      value: "38 d", hint: "Lead → Contrato" },
    { label: "Ciclo Lead → Cita",       value: "5.2 d", hint: "promedio 30d" },
    { label: "Tasa de no-show citas",   value: "11.4%", hint: "vs 9.6% mes previo" },
    { label: "SLA primer contacto",     value: "92%",   hint: "< 30 min" },
    { label: "Coverage de cuota",       value: "1.7x",  hint: "Pipeline / Quota" },
    { label: "ACV (Average Contract)",  value: "$2.87M", hint: "últimos 90d" },
  ],
  leaks: [
    { stage: "Lead → Calificado",   pct: 0.45, loss: 226 },
    { stage: "Calificado → Cita",   pct: 0.52, loss:  88 },
    { stage: "Cita → Propuesta",    pct: 0.49, loss:  49 },
    { stage: "Propuesta → Contrato",pct: 0.47, loss:  25 },
  ],
};

const COHORTS = [
  { cohort: "2026-01", leads: 412, m1: 0.18, m2: 0.11, m3: 0.07, m4: 0.04, m5: 0.03, m6: 0.02 },
  { cohort: "2026-02", leads: 388, m1: 0.21, m2: 0.13, m3: 0.08, m4: 0.05, m5: 0.03, m6: null },
  { cohort: "2026-03", leads: 451, m1: 0.19, m2: 0.12, m3: 0.07, m4: 0.04, m5: null, m6: null },
  { cohort: "2026-04", leads: 502, m1: 0.22, m2: 0.14, m3: 0.09, m4: null, m5: null, m6: null },
  { cohort: "2026-05", leads: 478, m1: 0.24, m2: 0.15, m3: null, m4: null, m5: null, m6: null },
  { cohort: "2026-06", leads: 521, m1: 0.26, m2: null, m3: null, m4: null, m5: null, m6: null },
];

const CHURN = {
  totals: { lostDeals30d: 38, lostValue30d: 64_200_000, churnRate: 0.082 },
  reasons: [
    { reason: "Precio",                 count: 14, value: 22_000_000 },
    { reason: "Tiempos de entrega",     count:  8, value: 12_400_000 },
    { reason: "Financiamiento",         count:  6, value:  9_800_000 },
    { reason: "Competencia",            count:  5, value:  8_900_000 },
    { reason: "Sin presupuesto",        count:  3, value:  6_300_000 },
    { reason: "Otros",                  count:  2, value:  4_800_000 },
  ],
  byDev: [
    { dev: "Vivenza · CDMX",    rate: 0.071 },
    { dev: "Reserva 360 · GDL", rate: 0.092 },
    { dev: "Altea · QRO",       rate: 0.108 },
  ],
};

const REPORTS = [
  { id: "r1", name: "Pipeline ejecutivo (PDF)",  freq: "Semanal",   owner: "Dirección",   format: "PDF", last: "2026-06-08" },
  { id: "r2", name: "Forecast trimestral",       freq: "Mensual",   owner: "Revenue Ops", format: "XLSX", last: "2026-06-01" },
  { id: "r3", name: "Cohortes de leads",         freq: "Mensual",   owner: "Marketing",   format: "CSV", last: "2026-06-01" },
  { id: "r4", name: "Churn por desarrollo",      freq: "Mensual",   owner: "Comercial",   format: "PDF", last: "2026-06-01" },
  { id: "r5", name: "KPIs por asesor",           freq: "Semanal",   owner: "Comercial",   format: "XLSX", last: "2026-06-08" },
  { id: "r6", name: "Auditoría de atribución",   freq: "Quincenal", owner: "Marketing",   format: "PDF", last: "2026-06-05" },
];

// ===================================================================
// Helpers UI
// ===================================================================

const Delta = ({ v, pct = true }: { v: number; pct?: boolean }) => {
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {pct ? `${(v * 100).toFixed(1)}%` : fmtNum(v)}
    </span>
  );
};

const Kpi = ({ label, value, delta, hint, pct }: { label: string; value: number; delta: number; hint?: string; pct?: boolean }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{pct ? fmtPct(value) : fmtMXN(value)}</p>
      <div className="mt-1 flex items-center justify-between">
        <Delta v={delta} />
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </CardContent>
  </Card>
);

const RiskBadge = ({ r }: { r: "bajo" | "medio" | "alto" }) => {
  const tone =
    r === "alto"  ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
    : r === "medio" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return <Badge variant="outline" className={`border-transparent ${tone} capitalize`}>{r}</Badge>;
};

// ===================================================================
// Vistas
// ===================================================================

export function CrmExecutiveKpis() {
  const max = Math.max(...REVENUE_MONTHLY.map((m) => Math.max(m.real, m.plan)));
  return (
    <div className="space-y-4">
      <PageHeader
        title="KPIs ejecutivos"
        description="Resumen ejecutivo de ingresos, pipeline y conversión."
        actions={<MockBadge />}
      />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {EXEC_KPIS.map((k) => <Kpi key={k.label} {...k} />)}
      </div>

      <Panel title="Ingresos vs Plan · últimos 6 meses" description="Comparativo mensual (mock)">
        <div className="grid grid-cols-6 gap-3">
          {REVENUE_MONTHLY.map((m) => (
            <div key={m.m} className="flex flex-col items-center gap-1">
              <div className="flex items-end gap-1 h-32 w-full">
                <div className="flex-1 rounded-t bg-primary/80" style={{ height: `${(m.real / max) * 100}%` }} />
                <div className="flex-1 rounded-t bg-muted-foreground/30" style={{ height: `${(m.plan / max) * 100}%` }} />
              </div>
              <p className="text-[11px] font-medium">{m.m}</p>
              <p className="text-[10px] text-muted-foreground">{fmtMXN(m.real)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/80" /> Real</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-muted-foreground/30" /> Plan</span>
        </div>
      </Panel>
    </div>
  );
}

export function CrmForecast() {
  const [horizon, setHorizon] = useState("trimestre");
  return (
    <div className="space-y-4">
      <PageHeader
        title="Forecast"
        description="Proyección de ingresos por commit, best-case y pipeline."
        actions={
          <div className="flex items-center gap-2">
            <Select value={horizon} onValueChange={setHorizon}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Por mes</SelectItem>
                <SelectItem value="trimestre">Por trimestre</SelectItem>
                <SelectItem value="anio">Anual</SelectItem>
              </SelectContent>
            </Select>
            <MockBadge />
          </div>
        }
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periodo</TableHead>
              <TableHead className="text-right">Commit</TableHead>
              <TableHead className="text-right">Best case</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
              <TableHead className="text-right">Cuota</TableHead>
              <TableHead className="text-right">Coverage</TableHead>
              <TableHead>Progreso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FORECAST_ROWS.map((r) => {
              const cov = r.pipeline / r.quota;
              const prog = Math.min(100, (r.commit / r.quota) * 100);
              return (
                <TableRow key={r.period}>
                  <TableCell className="font-medium">{r.period}</TableCell>
                  <TableCell className="text-right">{fmtMXN(r.commit)}</TableCell>
                  <TableCell className="text-right">{fmtMXN(r.best)}</TableCell>
                  <TableCell className="text-right">{fmtMXN(r.pipeline)}</TableCell>
                  <TableCell className="text-right">{fmtMXN(r.quota)}</TableCell>
                  <TableCell className="text-right">{cov.toFixed(2)}x</TableCell>
                  <TableCell className="w-[180px]"><Progress value={prog} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

export function CrmPipelineReview() {
  const [risk, setRisk] = useState<string>("todos");
  const filtered = useMemo(
    () => risk === "todos" ? PIPELINE_REVIEW : PIPELINE_REVIEW.filter((d) => d.risk === risk),
    [risk],
  );
  const totalValue = filtered.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline review"
        description="Revisión semanal de deals en negociación / propuesta con riesgo."
        actions={
          <div className="flex items-center gap-2">
            <Select value={risk} onValueChange={setRisk}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Riesgo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los riesgos</SelectItem>
                <SelectItem value="alto">Riesgo alto</SelectItem>
                <SelectItem value="medio">Riesgo medio</SelectItem>
                <SelectItem value="bajo">Riesgo bajo</SelectItem>
              </SelectContent>
            </Select>
            <MockBadge />
          </div>
        }
      />

      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Deals en revisión</p>
          <p className="mt-1 text-2xl font-semibold">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Valor total</p>
          <p className="mt-1 text-2xl font-semibold">{fmtMXN(totalValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Riesgo alto</p>
          <p className="mt-1 text-2xl font-semibold">{PIPELINE_REVIEW.filter((d) => d.risk === "alto").length}</p>
        </CardContent></Card>
      </div>

      <Panel title="Salud del pipeline por etapa">
        <div className="grid gap-2 grid-cols-1 md:grid-cols-5">
          {PIPELINE_HEALTH.map((s) => (
            <div key={s.stage} className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">{s.stage}</p>
              <p className="text-lg font-semibold">{s.count}</p>
              <p className="text-[11px] text-muted-foreground">{fmtMXN(s.value)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Aging {s.aging}d · Conv {fmtPct(s.conv, 0)}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contacto</TableHead>
              <TableHead>Desarrollo</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Riesgo</TableHead>
              <TableHead>Próxima acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.contact}</TableCell>
                <TableCell className="text-muted-foreground">{d.dev}</TableCell>
                <TableCell>{d.stage}</TableCell>
                <TableCell className="text-right">{fmtMXN(d.value)}</TableCell>
                <TableCell className="text-muted-foreground">{d.owner}</TableCell>
                <TableCell><RiskBadge r={d.risk as "bajo" | "medio" | "alto"} /></TableCell>
                <TableCell className="text-muted-foreground">{d.next}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

export function CrmRevenueOps() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Revenue ops"
        description="Eficiencia operativa, SLAs y coverage de la operación comercial."
        actions={<MockBadge />}
      />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {REVENUE_OPS.kpis.map((k) => (
          <Card key={k.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-xl font-semibold">{k.value}</p>
            {k.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{k.hint}</p>}
          </CardContent></Card>
        ))}
      </div>

      <Panel title="Leaks del funnel" description="Tasa de conversión y pérdida acumulada por paso.">
        <div className="space-y-3">
          {REVENUE_OPS.leaks.map((l) => (
            <div key={l.stage}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{l.stage}</span>
                <span className="text-muted-foreground">{fmtPct(l.pct, 0)} · perdidos {l.loss}</span>
              </div>
              <Progress value={l.pct * 100} className="mt-1" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function CrmCohorts() {
  const cellTone = (v: number | null) => {
    if (v === null) return "bg-muted/40 text-muted-foreground";
    if (v >= 0.20) return "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200";
    if (v >= 0.10) return "bg-amber-500/20 text-amber-800 dark:text-amber-200";
    return "bg-rose-500/15 text-rose-800 dark:text-rose-200";
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cohorts"
        description="Conversión de cohortes de leads por mes (Lead → activo en cada mes posterior)."
        actions={<MockBadge />}
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Cohorte</th>
                <th className="py-2 pr-3 text-right">Leads</th>
                {["M+1","M+2","M+3","M+4","M+5","M+6"].map((h) => (
                  <th key={h} className="py-2 px-1 text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COHORTS.map((c) => (
                <tr key={c.cohort} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{c.cohort}</td>
                  <td className="py-2 pr-3 text-right">{fmtNum(c.leads)}</td>
                  {[c.m1, c.m2, c.m3, c.m4, c.m5, c.m6].map((v, i) => (
                    <td key={i} className="py-1 px-1 text-center">
                      <span className={`inline-block w-full rounded px-2 py-1 text-[11px] font-medium ${cellTone(v)}`}>
                        {v === null ? "—" : `${(v * 100).toFixed(0)}%`}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function CrmChurn() {
  const maxR = Math.max(...CHURN.reasons.map((r) => r.count));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Churn"
        description="Pérdida de deals, razones y churn por desarrollo."
        actions={<MockBadge />}
      />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Deals perdidos (30d)</p>
          <p className="mt-1 text-2xl font-semibold">{CHURN.totals.lostDeals30d}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Valor perdido (30d)</p>
          <p className="mt-1 text-2xl font-semibold">{fmtMXN(CHURN.totals.lostValue30d)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Churn rate</p>
          <p className="mt-1 text-2xl font-semibold">{fmtPct(CHURN.totals.churnRate)}</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
        <Panel title="Razones de pérdida">
          <div className="space-y-2">
            {CHURN.reasons.map((r) => (
              <div key={r.reason}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.reason}</span>
                  <span className="text-muted-foreground">{r.count} · {fmtMXN(r.value)}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-rose-500/70" style={{ width: `${(r.count / maxR) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Churn por desarrollo">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desarrollo</TableHead>
                <TableHead className="text-right">Churn</TableHead>
                <TableHead>Tendencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CHURN.byDev.map((d) => (
                <TableRow key={d.dev}>
                  <TableCell className="font-medium">{d.dev}</TableCell>
                  <TableCell className="text-right">{fmtPct(d.rate)}</TableCell>
                  <TableCell className="w-[140px]"><Progress value={d.rate * 800} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}

export function CrmReporting() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Reportería"
        description="Catálogo de reportes ejecutivos y operativos programados."
        actions={<MockBadge />}
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reporte</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead>Última corrida</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {REPORTS.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.freq}</TableCell>
                <TableCell className="text-muted-foreground">{r.owner}</TableCell>
                <TableCell><Badge variant="outline">{r.format}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{r.last}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => toast.info(`Descarga simulada · ${r.name}`)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}