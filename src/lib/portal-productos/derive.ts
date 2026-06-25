import type { CuentaProducto, EstatusPago, GlobalFilters } from './types';

// Fuente única de derivación — toda métrica derivada se calcula aquí.
// SWAP POINT: reemplazar por vista SQL / RPC en Supabase cuando exista la BD real.

const HOY = new Date();
const GRACIA_DIAS = 7;

function diffDias(a: Date | string, b: Date | string): number {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return Math.floor((da.getTime() - db.getTime()) / 86400000);
}

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

export interface CuentaDerivada extends CuentaProducto {
  totalPagado: number;
  saldoPendiente: number;
  avancePct: number;
  estatusPago: EstatusPago;
  saldoVencido: number;
  diasAtraso: number;
  agingBucket: AgingBucket | null;
}

export function deriveCuenta(c: CuentaProducto): CuentaDerivada {
  const aplicado = c.aplicaciones.reduce((s, a) => s + a.montoAplicado, 0);
  const totalPagado = Math.min(Math.max(aplicado, 0), c.precioFinal);
  const saldoPendiente = Math.max(c.precioFinal - totalPagado, 0);
  const avancePct = c.precioFinal > 0
    ? Math.min(Math.round((totalPagado / c.precioFinal) * 100), 100)
    : 0;

  const vencidos = c.acuerdos.filter(a =>
    a.fechaCompromiso && !a.pagoCompletado && new Date(a.fechaCompromiso) < HOY,
  );
  const saldoVencido = Math.min(
    vencidos.reduce((s, a) => s + a.monto, 0),
    saldoPendiente,
  );

  const proximos = c.acuerdos
    .filter(a => a.fechaCompromiso && !a.pagoCompletado && new Date(a.fechaCompromiso) >= HOY)
    .sort((x, y) => +new Date(x.fechaCompromiso!) - +new Date(y.fechaCompromiso!));

  let estatusPago: EstatusPago;
  if (saldoPendiente === 0) estatusPago = 'pagado';
  else if (saldoVencido > 0) estatusPago = 'vencido';
  else if (proximos[0] && diffDias(proximos[0].fechaCompromiso!, HOY) <= GRACIA_DIAS) estatusPago = 'atrasado';
  else estatusPago = 'al_corriente';

  const diasAtraso = vencidos.length
    ? Math.max(...vencidos.map(a => diffDias(HOY, a.fechaCompromiso!)))
    : 0;
  const agingBucket: AgingBucket | null = diasAtraso === 0 ? null
    : diasAtraso <= 30 ? '0-30'
    : diasAtraso <= 60 ? '31-60'
    : diasAtraso <= 90 ? '61-90' : '90+';

  return { ...c, totalPagado, saldoPendiente, avancePct, estatusPago, saldoVencido, diasAtraso, agingBucket };
}

export function deriveTodas(cuentas: CuentaProducto[]): CuentaDerivada[] {
  return cuentas.map(deriveCuenta);
}

export function aplicarFiltrosCobranza<T extends CuentaProducto>(cuentas: T[], f: GlobalFilters): T[] {
  return cuentas.filter(c => {
    if (f.proyecto !== 'all' && c.proyecto !== f.proyecto) return false;
    if (f.propietario !== 'all' && c.producto.propietario !== f.propietario) return false;
    if (f.categoria !== 'all' && c.producto.categoria !== f.categoria) return false;
    return true;
  });
}

export function aplicarFiltrosVentas<T extends CuentaProducto>(cuentas: T[], f: GlobalFilters, mesesOverride?: number): T[] {
  const meses = mesesOverride ?? (f.rangoMeses > 0 ? f.rangoMeses : 12);
  const desde = new Date(HOY); desde.setMonth(desde.getMonth() - meses);
  return aplicarFiltrosCobranza(cuentas, f).filter(c => new Date(c.fechaCompra) >= desde);
}