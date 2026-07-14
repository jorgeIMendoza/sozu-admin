/**
 * Componentes puramente presentacionales extraídos de RelacionPagos.tsx.
 * Sin hooks, sin contexto, sin navegación, sin efectos secundarios.
 * Se importan en Portal Notaría sin riesgo de arrastrar lógica administrativa.
 *
 * RelacionPagos.tsx mantiene sus propias definiciones inline — este archivo
 * es una copia limpia para uso exclusivo de Portal Notaría. No modificar
 * RelacionPagos.tsx ni depender de este archivo desde el portal administrativo.
 */

import { DollarSign, FileText } from 'lucide-react';

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// ─── Skeletons ────────────────────────────────────────────────────────────────

export function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

export function KpiCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <Shimmer className="h-3 w-24 mb-3" />
      <Shimmer className="h-8 w-28" />
    </div>
  );
}

export function DetailCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <Shimmer className="h-3 w-24 mb-3" />
      <Shimmer className="h-8 w-36 mb-2" />
      <Shimmer className="h-3 w-20" />
    </div>
  );
}

export function TableRowSkeleton({ colCount = 9 }: { colCount?: number }) {
  return (
    <tr>
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <Shimmer className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// ─── KPI + Detail Cards ───────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueClass?: string;
  colSpan?: boolean;
}

export function KpiCard({ label, value, sub, valueClass = 'text-slate-900', colSpan }: KpiCardProps) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm ${colSpan ? 'col-span-2 md:col-span-1' : ''}`}>
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

interface DetailCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueClass?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  borderClass?: string;
}

export function DetailCard({ label, icon, value, sub, valueClass = 'text-slate-900', children, borderClass = 'border-slate-200' }: DetailCardProps) {
  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      {children}
    </div>
  );
}

// ─── Financial Cards ──────────────────────────────────────────────────────────

interface CashPaymentCardProps {
  limite: number;
  pagado: number;
  disponible: number;
}

export function CashPaymentCard({ limite, pagado, disponible }: CashPaymentCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pago en efectivo</p>
        <DollarSign className="w-4 h-4 text-slate-400" />
      </div>
      <div className="space-y-2 mt-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Límite:</span>
          <span className="font-medium text-slate-700">{fmtMxn(limite)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Pagado:</span>
          <span className="font-medium text-slate-700">{fmtMxn(pagado)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Aún permitido:</span>
          <span className={`font-medium ${disponible < 0 ? 'text-red-500' : 'text-slate-700'}`}>
            {fmtMxn(disponible)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function EscrituracionCard({ value }: { value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor de escrituración</p>
        <FileText className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-purple-600">{fmtMxn(value)}</p>
      <p className="text-xs text-slate-400 mt-1">
        Suma de precio final de propiedad, bodegas y estacionamientos
      </p>
    </div>
  );
}

interface AccesorioCardProps {
  titulo: string;
  precioFinal: number;
  totalPagado: number;
  saldoPendiente: number;
}

export function AccesorioCard({ titulo, precioFinal, totalPagado, saldoPendiente }: AccesorioCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{titulo}</p>
        <DollarSign className="w-4 h-4 text-slate-400" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-slate-400">Precio Final</span>
          <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtMxn(precioFinal)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-slate-400">Total Pagado</span>
          <span className="text-sm font-semibold text-emerald-600 tabular-nums">{fmtMxn(totalPagado)}</span>
        </div>
        <div className="border-t border-slate-100 pt-2 flex justify-between items-baseline">
          <span className="text-xs text-slate-400">Saldo Pendiente</span>
          <span className={`text-sm font-bold tabular-nums ${saldoPendiente <= 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
            {fmtMxn(saldoPendiente)}
          </span>
        </div>
      </div>
    </div>
  );
}
