/**
 * Tabla de pagos READ-ONLY para el Portal Notaría.
 * Versión exclusiva para notaría — sin callbacks de escritura.
 *
 * Diferencias respecto a PaymentsTable (RelacionPagos.tsx):
 *   - Sin onToggleValidacion (no modifica pagos.validacion_documental_efectivo)
 *   - Sin onAnalizarComprobante (no ejecuta análisis de comprobantes)
 *   - Sin validandoPagoId (no hay estado de loading de mutación)
 *   - Comprobante: abre URL en nueva pestaña (read-only), no valida
 *   - Columna PLD: solo visualización (dot de color)
 *   - Indicador "Solo lectura" en el header
 *
 * RESTRICCIÓN ABSOLUTA: esta tabla no debe recibir ningún callback de escritura.
 * Si se requiere validación de comprobantes, debe hacerse desde el portal administrativo.
 */

import { ExternalLink } from 'lucide-react';
import { TableRowSkeleton } from '@/components/admin/relacion-pagos';
import type { PldPaymentFlagInfo } from '@/hooks/usePldForCuenta';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotariaTablePagoRow {
  pagoId: number;
  fechaPago: string | null;
  monto: number;
  metodoPago: string;
  concepto: string | null;
  urlCep: string | null;
  urlRecibo: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const FLAG_DOT: Record<string, string> = {
  verde:    'bg-emerald-500',
  amarillo: 'bg-amber-400',
  naranja:  'bg-orange-500',
  rojo:     'bg-red-500',
  gris:     'bg-slate-300',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface NotariaPaymentsTableProps {
  pagos: NotariaTablePagoRow[];
  isLoading: boolean;
  flagsPorPago?: Map<number, PldPaymentFlagInfo>;
  titulo?: string;
}

export function NotariaPaymentsTable({
  pagos,
  isLoading,
  flagsPorPago,
  titulo,
}: NotariaPaymentsTableProps) {
  const hasPld = !!flagsPorPago;
  const HEADERS = [
    'Fecha del Pago', 'Concepto', 'Pago', 'Método de Pago',
    ...(hasPld ? ['PLD'] : []),
    'Comprobante',
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {titulo && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{titulo}</p>
          <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
            Solo lectura
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              {HEADERS.map(h => (
                <th
                  key={h}
                  className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRowSkeleton key={i} colCount={HEADERS.length} />
              ))
            ) : pagos.length === 0 ? (
              <tr>
                <td
                  colSpan={HEADERS.length}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  Sin pagos registrados
                </td>
              </tr>
            ) : (
              pagos.map(p => {
                const comprobanteUrl = p.urlCep || p.urlRecibo;
                const pldInfo = hasPld ? flagsPorPago!.get(p.pagoId) : undefined;
                return (
                  <tr key={p.pagoId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                      {p.fechaPago ? fmtDate(p.fechaPago) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 max-w-[180px] truncate">
                      {p.concepto ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {fmtMxn(p.monto)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                      {p.metodoPago}
                    </td>
                    {hasPld && (
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {pldInfo ? (
                          <span
                            title={pldInfo.tooltip}
                            className={`inline-block w-3 h-3 rounded-full cursor-default ${FLAG_DOT[pldInfo.flag] ?? 'bg-slate-300'}`}
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3.5 min-w-[140px]">
                      {comprobanteUrl ? (
                        <a
                          href={comprobanteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 underline underline-offset-2 decoration-dotted whitespace-nowrap"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          Ver comprobante
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs whitespace-nowrap">Sin comprobante</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
