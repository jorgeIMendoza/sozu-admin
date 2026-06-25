export function formatMXN(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n || 0);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-MX').format(n || 0);
}

export function formatPct(n: number, dec = 1): string {
  return `${(n * 100).toFixed(dec)}%`;
}

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export function formatFecha(d: string | Date | null, modo: 'tabla' | 'card' = 'tabla'): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  if (modo === 'card') return `${dd} ${MESES[date.getMonth()]} ${yyyy}`;
  return `${dd}/${mm}/${yyyy}`;
}

export function mesEtiqueta(d: Date): string {
  return `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}