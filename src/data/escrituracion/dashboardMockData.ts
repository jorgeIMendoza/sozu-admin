export type Proyecto = 'Margot' | 'Bottura' | 'Vive Daiku';

export const KPI_DATA: Record<Proyecto, {
  inventario: number;
  escriturados: number;
  expedientesDocumentos: number;
  relacionPagos: number;
  alertasPld: number;
  enProceso: number;
  recursosPropios: number;
  creditoHipotecario: number;
  citas: number;
  demandas: number;
  entregas: number;
  postventa: number;
}> = {
  Margot: {
    inventario: 320,
    escriturados: 303,
    expedientesDocumentos: 0,
    relacionPagos: 0,
    alertasPld: 0,
    enProceso: 0,
    recursosPropios: 0,
    creditoHipotecario: 1,
    citas: 0,
    demandas: 0,
    entregas: 0,
    postventa: 0,
  },
  Bottura: {
    inventario: 203,
    escriturados: 0,
    expedientesDocumentos: 0,
    relacionPagos: 0,
    alertasPld: 0,
    enProceso: 0,
    recursosPropios: 0,
    creditoHipotecario: 0,
    citas: 0,
    demandas: 0,
    entregas: 0,
    postventa: 0,
  },
  'Vive Daiku': {
    inventario: 160,
    escriturados: 0,
    expedientesDocumentos: 0,
    relacionPagos: 0,
    alertasPld: 0,
    enProceso: 0,
    recursosPropios: 0,
    creditoHipotecario: 0,
    citas: 0,
    demandas: 0,
    entregas: 0,
    postventa: 0,
  },
};

export const PIPELINE_DATA = [
  { id: 'expediente',      name: 'Expedientes',        count: 0, step: '01' },
  { id: 'voboDesarrollo',  name: 'VoBo Desarrollador', count: 0, step: '02' },
  { id: 'avaluo',          name: 'Avalúo',             count: 0, step: '03' },
  { id: 'voboBanco',       name: 'VoBo Banco',         count: 0, step: '04' },
  { id: 'voboComprador',   name: 'VoBo Comprador',     count: 0, step: '05' },
  { id: 'firma',           name: 'Firma',              count: 0, step: '06' },
];

export type SlaStatus = 'En tiempo' | 'En riesgo' | 'Retrasado' | 'Concluido';

export interface ExpedienteTableData {
  id: string;
  proyecto: Proyecto;
  unidad: string;
  cliente: string;
  pago: string;
  banco: string;
  notaria: string;
  etapa: string;
  avance: number;
  sla: SlaStatus;
  ultimaActualizacion: string;
  monto: number;
  fechaFirma: string;
}

export const EXPEDIENTES_TABLE: ExpedienteTableData[] = [
  {
    id: 'ESC-2041',
    proyecto: 'Margot',
    unidad: 'A-404',
    cliente: 'Marta Ramírez',
    pago: 'Hipotecario',
    banco: 'BBVA',
    notaria: 'Notaría 63',
    etapa: 'Borrador',
    avance: 48,
    sla: 'En tiempo',
    ultimaActualizacion: '23 May 2026',
    monto: 6240000,
    fechaFirma: '12 May 2026'
  },
  {
    id: 'ESC-2042',
    proyecto: 'Margot',
    unidad: 'B-1104',
    cliente: 'Ernesto Gómez',
    pago: 'Hipotecario',
    banco: 'Banorte',
    notaria: 'Notaría 51',
    etapa: 'Registro público',
    avance: 92,
    sla: 'En tiempo',
    ultimaActualizacion: '23 May 2026',
    monto: 4500000,
    fechaFirma: '10 May 2026'
  },
  {
    id: 'ESC-2043',
    proyecto: 'Margot',
    unidad: 'A-1203',
    cliente: 'Carlos López',
    pago: 'Hipotecario',
    banco: 'Santander',
    notaria: 'Notaría 51',
    etapa: 'Expediente',
    avance: 12,
    sla: 'En riesgo',
    ultimaActualizacion: '22 May 2026',
    monto: 5100000,
    fechaFirma: '20 Jun 2026'
  },
  {
    id: 'ESC-2044',
    proyecto: 'Margot',
    unidad: 'B-808',
    cliente: 'Laura Sánchez',
    pago: 'Hipotecario',
    banco: 'BBVA',
    notaria: 'Notaría 59',
    etapa: 'Entrega escritura',
    avance: 100,
    sla: 'Concluido',
    ultimaActualizacion: '22 May 2026',
    monto: 7800000,
    fechaFirma: '01 May 2026'
  },
  {
    id: 'ESC-2045',
    proyecto: 'Margot',
    unidad: 'C-902',
    cliente: 'Diana Muñoz',
    pago: 'Contado',
    banco: '—',
    notaria: 'Notaría 59',
    etapa: 'Instrucción notarial',
    avance: 35,
    sla: 'Retrasado',
    ultimaActualizacion: '21 May 2026',
    monto: 3950000,
    fechaFirma: '05 Jun 2026'
  },
  {
    id: 'ESC-2046',
    proyecto: 'Margot',
    unidad: 'C-1402',
    cliente: 'Patricia Vega',
    pago: 'Contado',
    banco: '—',
    notaria: 'Notaría 63',
    etapa: 'Avalúo',
    avance: 22,
    sla: 'En tiempo',
    ultimaActualizacion: '21 May 2026',
    monto: 4120000,
    fechaFirma: '18 Jun 2026'
  },
  {
    id: 'ESC-2047',
    proyecto: 'Margot',
    unidad: '305B',
    cliente: 'Jorge Acosta',
    pago: 'Hipotecario',
    banco: 'Santander',
    notaria: 'Notaría 51',
    etapa: 'VoBo banco / dev.',
    avance: 65,
    sla: 'En tiempo',
    ultimaActualizacion: '20 May 2026',
    monto: 8500000,
    fechaFirma: '25 May 2026'
  },
  {
    id: 'ESC-2048',
    proyecto: 'Margot',
    unidad: '703',
    cliente: 'Joel Herrera',
    pago: 'Contado',
    banco: '—',
    notaria: 'Notaría 59',
    etapa: 'Firma',
    avance: 82,
    sla: 'En tiempo',
    ultimaActualizacion: '20 May 2026',
    monto: 3200000,
    fechaFirma: '22 May 2026'
  }
];

export const TIMELINE_MILESTONES = [
  { etapa: 'Expediente', status: 'completed', date: '12 Abr', title: 'Cumplimiento', desc: 'PLD aprobado - KYC validado' },
  { etapa: 'Avalúo', status: 'completed', date: '18 Abr', title: 'BBVA', desc: 'Avalúo $6.32M aceptado' },
  { etapa: 'Instrucción notarial', status: 'completed', date: '23 Abr', title: 'Jurídico', desc: 'Instrucción enviada a notaría' },
  { etapa: 'Borrador', status: 'completed', date: '28 Abr', title: 'Notaría 63', desc: 'Borrador v 3 aprobado' },
  { etapa: 'VoBo banco / dev.', status: 'in-progress', date: '04 May', title: 'BBVA - Desarrollador', desc: 'Pendiente VoBo Santander' },
  { etapa: 'Firma', status: 'pending', date: '12 May', title: 'Notaría 51', desc: 'Cita confirmada 11:00 hrs' },
  { etapa: 'Registro público', status: 'pending', date: '26 May', title: 'RPP CDMX', desc: '' },
  { etapa: 'Entrega escritura', status: 'pending', date: '02 Jun', title: 'Postventa', desc: '' }
];
