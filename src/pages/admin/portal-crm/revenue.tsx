import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Target, LineChart as LineChartIcon, Briefcase,
  Activity, Users2, AlertTriangle, FileText, Download, Filter,
  Plus, Edit2, Trash2, CheckCircle2, X as XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCrmOrgId } from "@/hooks/useCrmOrgId";
import { PageHeader, MockBadge, Panel, ComingSoon } from "@/components/admin/portal-crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtMXN, fmtNum, fmtPct } from "@/data/portal-crm/mockData";
import { enrichDeal, stalledDeals, RISK_TONE, type Scenario, SCENARIO_TONE } from "@/lib/crm-forecasting";
import { type DateRange, RANGE_LABEL, rangeToSince } from "@/lib/crm-marketing";

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

// ===================================================================
// CrmRevenueAttribution
// ===================================================================
const ATTRIBUTION_MOCK = [
  { source: "Meta Ads", platform: "meta_ads", deals: 14, revenue: 28_700_000, pct: 0.38, avg_deal: 2_050_000, first_touch: 0.41, last_touch: 0.35 },
  { source: "Google Ads", platform: "google_ads", deals: 9, revenue: 19_400_000, pct: 0.26, avg_deal: 2_155_000, first_touch: 0.28, last_touch: 0.31 },
  { source: "Referidos", platform: "referral", deals: 7, revenue: 16_100_000, pct: 0.21, avg_deal: 2_300_000, first_touch: 0.18, last_touch: 0.22 },
  { source: "Orgánico", platform: "organic", deals: 4, revenue: 7_800_000, pct: 0.10, avg_deal: 1_950_000, first_touch: 0.09, last_touch: 0.08 },
  { source: "Directo", platform: "direct", deals: 2, revenue: 3_600_000, pct: 0.05, avg_deal: 1_800_000, first_touch: 0.04, last_touch: 0.04 },
];

const PLATFORM_TONE: Record<string, string> = {
  meta_ads: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  google_ads: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  referral: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  organic: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  direct: "bg-muted text-muted-foreground",
};

export function CrmRevenueAttribution() {
  const [model, setModel] = useState<"first_touch" | "last_touch" | "linear">("last_touch");
  const totalRevenue = ATTRIBUTION_MOCK.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Atribución de ingresos" subtitle="Ingresos por canal de adquisición">
        <MockBadge />
        <Select value={model} onValueChange={v => setModel(v as typeof model)}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="last_touch">Last touch</SelectItem>
            <SelectItem value="first_touch">First touch</SelectItem>
            <SelectItem value="linear">Lineal</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Revenue total", value: fmtMXN(totalRevenue) },
          { label: "Deals cerrados", value: fmtNum(ATTRIBUTION_MOCK.reduce((s,r)=>s+r.deals,0)) },
          { label: "Ticket promedio", value: fmtMXN(totalRevenue / Math.max(1, ATTRIBUTION_MOCK.reduce((s,r)=>s+r.deals,0))) },
          { label: "Canales", value: fmtNum(ATTRIBUTION_MOCK.length) },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-xl font-bold mt-0.5">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {ATTRIBUTION_MOCK.map(row => {
          const weight = model === "first_touch" ? row.first_touch : model === "last_touch" ? row.last_touch : row.pct;
          const attributed = totalRevenue * weight;
          return (
            <div key={row.source} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${PLATFORM_TONE[row.platform]}`}>{row.source}</Badge>
                  <span className="text-xs text-muted-foreground">{row.deals} deals</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{fmtPct(weight)}</span>
                  <span className="font-semibold">{fmtMXN(attributed)}</span>
                </div>
              </div>
              <Progress value={weight * 100} className="h-2" />
            </div>
          );
        })}
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Canal</TableHead>
            <TableHead className="text-right">Deals</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Ticket prom.</TableHead>
            <TableHead className="text-right">First touch</TableHead>
            <TableHead className="text-right">Last touch</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {ATTRIBUTION_MOCK.map(r => (
              <TableRow key={r.source}>
                <TableCell><Badge className={`text-[10px] ${PLATFORM_TONE[r.platform]}`}>{r.source}</Badge></TableCell>
                <TableCell className="text-right">{r.deals}</TableCell>
                <TableCell className="text-right font-medium">{fmtMXN(r.revenue)}</TableCell>
                <TableCell className="text-right">{fmtMXN(r.avg_deal)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.first_touch)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.last_touch)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ===================================================================
// CrmRevenueVelocity
// ===================================================================
const VELOCITY_MOCK = [
  { stage: "new → qualified", days_avg: 1.2, deals: 48, bottleneck: false },
  { stage: "qualified → appointment_scheduled", days_avg: 3.8, deals: 31, bottleneck: false },
  { stage: "appointment_scheduled → appointment_attended", days_avg: 2.1, deals: 22, bottleneck: false },
  { stage: "appointment_attended → offer_sent", days_avg: 8.4, deals: 14, bottleneck: true },
  { stage: "offer_sent → reservation", days_avg: 12.2, deals: 9, bottleneck: true },
  { stage: "reservation → contract", days_avg: 5.6, deals: 7, bottleneck: false },
];

const ADVISOR_VEL_MOCK = [
  { name: "Ana García", avg_days_to_close: 22, deals: 8, stalled: 1 },
  { name: "Carlos López", avg_days_to_close: 19, deals: 11, stalled: 0 },
  { name: "María Torres", avg_days_to_close: 31, deals: 5, stalled: 3 },
];

export function CrmRevenueVelocity() {
  const orgId = useCrmOrgId();

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["crm-velocity-deals", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_deals")
        .select("id,deal_stage,value,close_date,created_at,deal_owner,contacts(full_name),probability,risk_level")
        .eq("organization_id", orgId).limit(200);
      return (data ?? []).map(enrichDeal);
    },
    enabled: !!orgId,
  });

  const stalled = useMemo(() => stalledDeals(deals), [deals]);

  return (
    <div className="space-y-6">
      <PageHeader title="Velocidad del pipeline" subtitle="Tiempo promedio por etapa y cuellos de botella">
        <MockBadge />
      </PageHeader>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Tiempo promedio entre etapas</p>
        {VELOCITY_MOCK.map(v => (
          <div key={v.stage} className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full shrink-0 ${v.bottleneck ? "bg-red-500" : "bg-emerald-500"}`} />
            <span className="text-sm flex-1 truncate">{v.stage.replace(/_/g," ")}</span>
            <span className="text-xs text-muted-foreground">{v.deals} deals</span>
            <div className="flex items-center gap-1 w-32">
              <Progress value={Math.min(100, (v.days_avg / 15) * 100)} className={`flex-1 h-1.5 ${v.bottleneck ? "[&>div]:bg-red-500" : ""}`} />
              <span className={`text-xs font-medium w-12 text-right ${v.bottleneck ? "text-red-500" : ""}`}>{v.days_avg}d</span>
            </div>
          </div>
        ))}
      </div>

      {stalled.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Deals estancados (BD)</p>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Contacto</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Riesgo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Días sin avance</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                : stalled.slice(0, 10).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{d.contacts?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{d.deal_stage?.replace(/_/g," ")}</TableCell>
                    <TableCell><Badge className={`text-xs ${RISK_TONE[d.risk_level ?? "medium"]}`}>{d.risk_level ?? "medium"}</Badge></TableCell>
                    <TableCell className="text-right text-sm">{fmtMXN(Number(d.value ?? 0))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.days_in_stage ? `${d.days_in_stage}d` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Velocidad por asesor</p>
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Asesor</TableHead>
              <TableHead className="text-right">Deals activos</TableHead>
              <TableHead className="text-right">Días prom. cierre</TableHead>
              <TableHead className="text-right">Estancados</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ADVISOR_VEL_MOCK.map(a => (
                <TableRow key={a.name}>
                  <TableCell className="font-medium text-sm">{a.name}</TableCell>
                  <TableCell className="text-right">{a.deals}</TableCell>
                  <TableCell className="text-right">{a.avg_days_to_close}d</TableCell>
                  <TableCell className="text-right">
                    <span className={a.stalled > 0 ? "text-red-500 font-medium" : ""}>{a.stalled}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// CrmRevenueGoals
// ===================================================================
type GoalRow = {
  id: string; name: string; metric: string; target: number; current: number;
  period: string; assignee: string; status: "on_track" | "at_risk" | "missed" | "achieved";
};

const GOALS_MOCK: GoalRow[] = [
  { id: "g1", name: "Reservas Q2", metric: "reservations", target: 18, current: 12, period: "Q2-2025", assignee: "Equipo completo", status: "on_track" },
  { id: "g2", name: "Revenue Junio", metric: "revenue", target: 15_000_000, current: 10_800_000, period: "Jun-2025", assignee: "Equipo completo", status: "at_risk" },
  { id: "g3", name: "Citas Ana", metric: "appointments", target: 20, current: 17, period: "Jun-2025", assignee: "Ana García", status: "on_track" },
  { id: "g4", name: "Deals Carlos", metric: "deals", target: 8, current: 6, period: "Jun-2025", assignee: "Carlos López", status: "on_track" },
  { id: "g5", name: "Revenue Mayo", metric: "revenue", target: 12_000_000, current: 12_400_000, period: "May-2025", assignee: "Equipo completo", status: "achieved" },
];

const GOAL_STATUS_TONE: Record<GoalRow["status"], string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  missed: "bg-red-500/15 text-red-700 dark:text-red-400",
  achieved: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

export function CrmRevenueGoals() {
  const orgId = useCrmOrgId();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<GoalRow | null>(null);
  const [form, setForm] = useState({ name: "", metric: "reservations", target: "", period: "", assignee: "" });

  const { data: dbGoals = [], isLoading } = useQuery({
    queryKey: ["crm-goals", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).from("crm_sales_goals").select("*").eq("organization_id", orgId).order("created_at");
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const goals: GoalRow[] = dbGoals.length > 0 ? dbGoals : GOALS_MOCK;

  const saveGoal = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const payload = { organization_id: orgId, name: form.name, metric: form.metric, target: Number(form.target), current: 0, period: form.period, assignee: form.assignee, status: "on_track" };
      if (editGoal && !editGoal.id.startsWith("g")) {
        await (supabase as any).from("crm_sales_goals").update(payload).eq("id", editGoal.id);
      } else {
        await (supabase as any).from("crm_sales_goals").insert(payload);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-goals", orgId] }); setOpen(false); toast.success("Meta guardada"); },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => { await (supabase as any).from("crm_sales_goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-goals", orgId] }),
  });

  const openCreate = () => { setEditGoal(null); setForm({ name: "", metric: "reservations", target: "", period: "", assignee: "" }); setOpen(true); };
  const openEdit = (g: GoalRow) => { setEditGoal(g); setForm({ name: g.name, metric: g.metric, target: String(g.target), period: g.period, assignee: g.assignee }); setOpen(true); };

  const METRICS = ["reservations","deals","revenue","appointments","leads","ql"];

  return (
    <div className="space-y-4">
      <PageHeader title="Metas y cuotas" subtitle="Objetivos de ventas por agente y equipo">
        <MockBadge />
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nueva meta</Button>
      </PageHeader>

      {dbGoals.length === 0 && (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />Mostrando metas de ejemplo. Crea metas reales con el botón de arriba.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {goals.map(g => {
          const pct = g.target > 0 ? Math.min(1, g.current / g.target) : 0;
          const metricFmt = g.metric === "revenue" ? fmtMXN(g.target) : fmtNum(g.target);
          const currentFmt = g.metric === "revenue" ? fmtMXN(g.current) : fmtNum(g.current);
          return (
            <Card key={g.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.assignee} · {g.period}</p>
                </div>
                <Badge className={`text-[10px] ${GOAL_STATUS_TONE[g.status]}`}>{g.status.replace("_"," ")}</Badge>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avance</span>
                  <span className="font-medium">{currentFmt} / {metricFmt}</span>
                </div>
                <Progress value={pct * 100} className="h-2" />
                <p className="text-xs text-right text-muted-foreground">{fmtPct(pct)}</p>
              </div>
              <div className="flex gap-1 mt-3">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(g)}>
                  <Edit2 className="w-3 h-3 mr-1" />Editar
                </Button>
                {!g.id.startsWith("g") && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => deleteGoal.mutate(g.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editGoal ? "Editar meta" : "Nueva meta"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Reservas Q3" /></div>
            <div><Label>Métrica</Label>
              <Select value={form.metric} onValueChange={v => setForm(f=>({...f,metric:v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METRICS.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Objetivo</Label><Input type="number" value={form.target} onChange={e => setForm(f=>({...f,target:e.target.value}))} placeholder="20" /></div>
            <div><Label>Período</Label><Input value={form.period} onChange={e => setForm(f=>({...f,period:e.target.value}))} placeholder="Jun-2025" /></div>
            <div><Label>Asignado a</Label><Input value={form.assignee} onChange={e => setForm(f=>({...f,assignee:e.target.value}))} placeholder="Equipo completo" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveGoal.mutate()} disabled={saveGoal.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}