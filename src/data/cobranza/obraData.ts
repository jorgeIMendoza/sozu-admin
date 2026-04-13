// ── Obra & Flujo Integrado — Mock Data ──────────────────────────

export interface ObraProject {
  id: string;
  project: string;
  presupuesto: number;
  erogado: number;
  porErogar: number;
  avanceFisico: number;   // %
  avanceFinanciero: number; // %
  provisionSemanal: number;
  fechaCorte: string;
  observaciones: string;
  cobradoAcumulado: number;
  porCobrar: number;
  vencido: number;
  flujoRequeridoProximo: number;
}

export type ObraStatus = 'alineado' | 'atencion' | 'desfasado' | 'critico';

export function getObraStatus(fisico: number, financiero: number): ObraStatus {
  const gap = Math.abs(fisico - financiero);
  if (gap <= 3) return 'alineado';
  if (gap <= 8) return 'atencion';
  if (gap <= 15) return 'desfasado';
  return 'critico';
}

export const obraStatusConfig: Record<ObraStatus, { label: string; bg: string; text: string }> = {
  alineado: { label: 'Alineado', bg: 'bg-success-bg', text: 'text-success' },
  atencion: { label: 'Atención', bg: 'bg-warning-bg', text: 'text-warning' },
  desfasado: { label: 'Desfasado', bg: 'bg-danger-bg', text: 'text-danger' },
  critico: { label: 'Crítico', bg: 'bg-priority-purple/10', text: 'text-priority-purple' },
};

export const mockObraProjects: ObraProject[] = [
  {
    id: 'obra-1', project: 'Margot',
    presupuesto: 78_500_000, erogado: 42_300_000, porErogar: 36_200_000,
    avanceFisico: 58, avanceFinanciero: 54,
    provisionSemanal: 1_450_000, fechaCorte: '2026-03-28',
    observaciones: 'Avance según programa. Estructura completada pisos 1-4.',
    cobradoAcumulado: 28_400_000, porCobrar: 9_800_000, vencido: 3_200_000,
    flujoRequeridoProximo: 2_900_000,
  },
  {
    id: 'obra-2', project: 'Bottura',
    presupuesto: 112_000_000, erogado: 71_800_000, porErogar: 40_200_000,
    avanceFisico: 68, avanceFinanciero: 64,
    provisionSemanal: 1_850_000, fechaCorte: '2026-03-28',
    observaciones: 'Fase acabados iniciando. Retraso menor en fachada norte.',
    cobradoAcumulado: 38_500_000, porCobrar: 11_350_000, vencido: 3_800_000,
    flujoRequeridoProximo: 3_700_000,
  },
  {
    id: 'obra-3', project: 'Daiku',
    presupuesto: 145_000_000, erogado: 58_000_000, porErogar: 87_000_000,
    avanceFisico: 42, avanceFinanciero: 40,
    provisionSemanal: 2_200_000, fechaCorte: '2026-03-28',
    observaciones: 'Cimentación concluida. Estructura en curso pisos 1-3.',
    cobradoAcumulado: 42_000_000, porCobrar: 12_050_000, vencido: 3_550_000,
    flujoRequeridoProximo: 4_400_000,
  },
  {
    id: 'obra-4', project: 'Monócolo',
    presupuesto: 52_000_000, erogado: 14_300_000, porErogar: 37_700_000,
    avanceFisico: 24, avanceFinanciero: 27.5,
    provisionSemanal: 950_000, fechaCorte: '2026-03-28',
    observaciones: 'Sobre-ejecución financiera menor. Revisión de contratista pendiente.',
    cobradoAcumulado: 15_200_000, porCobrar: 5_000_000, vencido: 2_200_000,
    flujoRequeridoProximo: 1_900_000,
  },
];

// ── Weekly projection (12 weeks) ────────────────────────────────
export interface ObraWeeklyRow {
  week: number;
  range: string;
  cobranzaProyectada: number;
  cobranzaReal: number;
  diferencia: number;
  provisionObra: number;
  montoRequerido: number;
  deficit: number;
  deficitAcumulado: number;
  status: 'ok' | 'atencion' | 'alto' | 'critico';
}

export const mockObraWeekly: ObraWeeklyRow[] = (() => {
  const rows: ObraWeeklyRow[] = [];
  const base = [
    { w: 9, r: '24 Feb – 28 Feb', proy: 1_200_000, real: 1_350_000, prov: 980_000, req: 1_050_000 },
    { w: 10, r: '03 Mar – 07 Mar', proy: 1_100_000, real: 980_000, prov: 1_050_000, req: 1_120_000 },
    { w: 11, r: '10 Mar – 14 Mar', proy: 1_350_000, real: 1_100_000, prov: 1_200_000, req: 1_300_000 },
    { w: 12, r: '17 Mar – 21 Mar', proy: 1_250_000, real: 850_000, prov: 1_150_000, req: 1_250_000 },
    { w: 13, r: '24 Mar – 28 Mar', proy: 1_400_000, real: 1_250_000, prov: 1_100_000, req: 1_200_000 },
    { w: 14, r: '31 Mar – 04 Abr', proy: 1_300_000, real: 0, prov: 1_050_000, req: 1_150_000 },
    { w: 15, r: '07 Abr – 11 Abr', proy: 1_350_000, real: 0, prov: 1_100_000, req: 1_200_000 },
    { w: 16, r: '14 Abr – 18 Abr', proy: 1_200_000, real: 0, prov: 1_250_000, req: 1_350_000 },
    { w: 17, r: '21 Abr – 25 Abr', proy: 1_450_000, real: 0, prov: 1_100_000, req: 1_200_000 },
    { w: 18, r: '28 Abr – 02 May', proy: 1_300_000, real: 0, prov: 1_050_000, req: 1_150_000 },
    { w: 19, r: '05 May – 09 May', proy: 1_250_000, real: 0, prov: 1_200_000, req: 1_300_000 },
    { w: 20, r: '12 May – 16 May', proy: 1_400_000, real: 0, prov: 1_150_000, req: 1_250_000 },
  ];
  let defAcc = 0;
  base.forEach(b => {
    const cobro = b.real > 0 ? b.real : b.proy;
    const dif = cobro - b.req;
    const def = dif < 0 ? Math.abs(dif) : 0;
    defAcc += dif < 0 ? Math.abs(dif) : -Math.min(defAcc, dif);
    if (defAcc < 0) defAcc = 0;
    const st = def === 0 ? 'ok' : def < 100_000 ? 'atencion' : def < 300_000 ? 'alto' : 'critico';
    rows.push({
      week: b.w, range: b.r,
      cobranzaProyectada: b.proy, cobranzaReal: b.real,
      diferencia: dif, provisionObra: b.prov, montoRequerido: b.req,
      deficit: def, deficitAcumulado: Math.max(0, defAcc),
      status: st,
    });
  });
  return rows;
})();

// ── Cash Flow Projection (monthly) ─────────────────────────────
export interface CashFlowPoint {
  period: string;
  entradas: number;
  salidas: number;
  saldoNeto: number;
}

export const mockCashFlowProjection: CashFlowPoint[] = [
  { period: 'Ene 26', entradas: 6_500_000, salidas: 5_800_000, saldoNeto: 700_000 },
  { period: 'Feb 26', entradas: 6_100_000, salidas: 6_200_000, saldoNeto: -100_000 },
  { period: 'Mar 26', entradas: 6_480_000, salidas: 6_450_000, saldoNeto: 30_000 },
  { period: 'Abr 26', entradas: 5_800_000, salidas: 6_300_000, saldoNeto: -500_000 },
  { period: 'May 26', entradas: 6_200_000, salidas: 6_100_000, saldoNeto: 100_000 },
  { period: 'Jun 26', entradas: 7_000_000, salidas: 6_800_000, saldoNeto: 200_000 },
  { period: 'Jul 26', entradas: 5_500_000, salidas: 6_500_000, saldoNeto: -1_000_000 },
  { period: 'Ago 26', entradas: 6_800_000, salidas: 6_400_000, saldoNeto: 400_000 },
];
