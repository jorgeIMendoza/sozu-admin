/**
 * Modal de Relación de Pagos para el Portal Notaría.
 * EXCLUSIVAMENTE DE LECTURA — cero mutaciones sobre pagos, compradores o acuerdos.
 *
 * RESTRICCIÓN ABSOLUTA: este componente NO ejecuta y NO importa código que ejecute:
 *   Mutations · INSERT · UPDATE · DELETE · RPC de escritura ·
 *   Edge Functions administrativas · validación de comprobantes ·
 *   conciliación · cambio de conceptos · cambio de método de pago ·
 *   modificación de aplicaciones o acuerdos de pago · edición de PLD ·
 *   subida o reemplazo de comprobantes · eliminación de pagos ·
 *   navegación a pantallas administrativas.
 *
 * Única acción permitida: visualización de comprobantes vía URL en nueva pestaña.
 *
 * Seguridad MVP: el notarioId viene de AppNotariaDashboard (ya validado).
 * La funcionalidad NO debe ir a Producción sin RLS en cuentas_cobranza + pagos.
 */

import { useMemo, useState } from 'react';
import { X, Loader2, DollarSign, TrendingDown, TrendingUp, FileText, Eye, Download } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useCuentaCobranzaFinancials } from '@/hooks/useCuentaCobranzaFinancials';
import { useAccesoriosFinancials } from '@/hooks/useAccesoriosFinancials';
import { usePldForCuenta, type PagoInputPld } from '@/hooks/usePldForCuenta';
import { useNotariaRelacionPagos } from '@/hooks/useNotariaRelacionPagos';
import { useExportToExcel } from '@/hooks/useExportToExcel';
import {
  KpiCard, KpiCardSkeleton, DetailCard, DetailCardSkeleton,
  CashPaymentCard, EscrituracionCard, AccesorioCard,
} from '@/components/admin/relacion-pagos';
import { NotariaPldSummaryCard } from './NotariaPldSummaryCard';
import { NotariaPaymentsTable, type NotariaTablePagoRow } from './NotariaPaymentsTable';

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

function derivarConcepto(
  pagoId: number,
  aplicaciones: { id_pago: number; es_multa: boolean; concepto_nombre: string | null }[],
): string | null {
  const apls = aplicaciones.filter(a => a.id_pago === pagoId);
  if (!apls.length) return null;
  if (apls.length > 1) return 'Múltiples aplicaciones';
  if (apls[0].es_multa) return 'Multa';
  return apls[0].concepto_nombre ?? null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NotariaRelacionPagosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentaId: number;
  notarioId: number | null;
  unitCode: string;
  clienteName: string;
  cuentaCode: string;
  proyectoNombre: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotariaRelacionPagosModal({
  open,
  onOpenChange,
  cuentaId,
  notarioId,
  unitCode,
  clienteName,
  cuentaCode,
  proyectoNombre,
}: NotariaRelacionPagosModalProps) {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // ── Data hooks (todos read-only) ──────────────────────────────────────────
  const {
    pagosPrincipal, aplicacionesPrincipal,
    pagosBodega, aplicacionesBodega,
    pagosEst, aplicacionesEst,
    idPropiedad, cuentaIdPrincipal, isLoading: isLoadingRp, isError,
  } = useNotariaRelacionPagos({ cuentaId, notarioId, enabled: open });

  // useCuentaCobranzaFinancials y usePldForCuenta usan la cuenta principal resuelta,
  // no la cuenta recibida (que puede ser una accesoria).
  // cuentaIdPrincipal es null mientras carga → hooks deshabilitados hasta resolución.
  const { data: financials, isLoading: isLoadingFinancials } = useCuentaCobranzaFinancials(
    open ? cuentaIdPrincipal : null,
  );

  const { data: accesorios, isLoading: isLoadingAccesorios } = useAccesoriosFinancials(
    open ? (idPropiedad ?? financials?.idPropiedad ?? null) : null,
  );

  // PLD — alimentado por los pagos de la cuenta principal
  const pagosParaPld = useMemo((): PagoInputPld[] => {
    return pagosPrincipal.map(p => ({
      id: p.id,
      monto: p.monto,
      fecha_pago: p.fecha_pago ?? '',
      clave_rastreo: p.clave_rastreo,
      url_cep: p.url_cep,
      url_recibo: p.url_recibo,
      descripcion: p.descripcion,
      id_metodos_pago: p.id_metodos_pago,
      validacion_documental_efectivo: p.validacion_documental_efectivo,
    }));
  }, [pagosPrincipal]);

  const valorUma = financials ? financials.limiteEfectivo / 8025 : 0;
  const pld = usePldForCuenta(
    open ? cuentaIdPrincipal : null,
    pagosParaPld,
    valorUma,
    financials?.precioFinal ?? 0,
  );

  // ── Computed row arrays ───────────────────────────────────────────────────
  const rowsPrincipal = useMemo((): NotariaTablePagoRow[] =>
    pagosPrincipal.map(p => ({
      pagoId: p.id,
      fechaPago: p.fecha_pago,
      monto: p.monto,
      metodoPago: p.metodo_pago,
      concepto: derivarConcepto(p.id, aplicacionesPrincipal),
      urlCep: p.url_cep,
      urlRecibo: p.url_recibo,
    })),
  [pagosPrincipal, aplicacionesPrincipal]);

  const rowsBodega = useMemo((): NotariaTablePagoRow[] =>
    pagosBodega.map(p => ({
      pagoId: p.id,
      fechaPago: p.fecha_pago,
      monto: p.monto,
      metodoPago: p.metodo_pago,
      concepto: derivarConcepto(p.id, aplicacionesBodega),
      urlCep: p.url_cep,
      urlRecibo: p.url_recibo,
    })),
  [pagosBodega, aplicacionesBodega]);

  const rowsEst = useMemo((): NotariaTablePagoRow[] =>
    pagosEst.map(p => ({
      pagoId: p.id,
      fechaPago: p.fecha_pago,
      monto: p.monto,
      metodoPago: p.metodo_pago,
      concepto: derivarConcepto(p.id, aplicacionesEst),
      urlCep: p.url_cep,
      urlRecibo: p.url_recibo,
    })),
  [pagosEst, aplicacionesEst]);

  // KPI aggregates
  const totalPagosPrincipal = pagosPrincipal.reduce((s, p) => s + p.monto, 0);
  const conComprobante = pagosPrincipal.filter(p => !!(p.url_cep || p.url_recibo)).length;
  const sinComprobante = pagosPrincipal.length - conComprobante;

  const isLoadingCards = isLoadingFinancials || isLoadingAccesorios || pld.isLoading;
  const isLoadingTable = isLoadingRp;

  // ── Exportar Excel ────────────────────────────────────────────────────────
  // Reutiliza exactamente el mismo mecanismo que Portal Escrituración:
  // useExportToExcel → Edge Function exportar-reporte → descarga XLSX.
  // Alcance: unidad principal + bodegas + estacionamientos (exclusivo, sin extras).
  const { exportToExcel, isExporting } = useExportToExcel();

  const totalExportRows = rowsPrincipal.length + rowsBodega.length + rowsEst.length;

  const handleExport = async () => {
    const pagoIdsBodega = new Set(rowsBodega.map(p => p.pagoId));
    const pagoIdsEst    = new Set(rowsEst.map(p => p.pagoId));

    const sanitize = (s: string) =>
      s.replace(/[^a-zA-Z0-9À-ÿ_-]/g, '_').replace(/_+/g, '_').slice(0, 40);

    const fmtDateExport = (s: string | null) =>
      s
        ? new Date(s + 'T00:00:00').toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric',
          })
        : '—';

    const rows = [...rowsPrincipal, ...rowsBodega, ...rowsEst].map(p => ({
      proyecto:    proyectoNombre,
      comprador:   clienteName,
      depto:       unitCode,
      producto:    pagoIdsBodega.has(p.pagoId) ? 'Bodega'
                   : pagoIdsEst.has(p.pagoId)  ? 'Cajón'
                   : 'Propiedad',
      fecha_pago:  fmtDateExport(p.fechaPago),
      concepto:    p.concepto ?? '—',
      pago:        p.monto,
      metodo_pago: p.metodoPago ?? '—',
      comprobante: p.urlCep || p.urlRecibo || '—',
    }));

    await exportToExcel({
      data: rows,
      filename: `Relacion_Pagos_${sanitize(proyectoNombre)}_${sanitize(unitCode)}_${cuentaCode}`,
      columnas_visibles: [
        { key: 'proyecto',    label: 'Proyecto' },
        { key: 'comprador',   label: 'Comprador' },
        { key: 'depto',       label: 'Depto' },
        { key: 'producto',    label: 'Producto' },
        { key: 'fecha_pago',  label: 'Fecha del Pago' },
        { key: 'concepto',    label: 'Concepto' },
        { key: 'pago',        label: 'Pago' },
        { key: 'metodo_pago', label: 'Método de Pago' },
        { key: 'comprobante', label: 'Comprobante' },
      ],
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-200 bg-white sticky top-0 z-10">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Relación de Pagos
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {unitCode} · {clienteName} · <span className="font-mono">{cuentaCode}</span>
              </p>
              {proyectoNombre && (
                <p className="text-xs text-slate-400">{proyectoNombre}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExport}
                disabled={isExporting || totalExportRows === 0 || isLoadingRp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {isExporting ? 'Exportando...' : 'Exportar Excel'}
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-6">
            {isError && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                No fue posible cargar la relación de pagos.
              </div>
            )}

            {/* ── KPI Cards ── */}
            <section>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Resumen de cuenta</h3>
              {isLoadingCards ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard
                    label="Precio final"
                    value={fmtMxn(financials?.precioFinal ?? 0)}
                    valueClass="text-slate-900 text-xl"
                  />
                  <KpiCard
                    label="Total pagado"
                    value={fmtMxn(financials?.totalPagadoReal ?? totalPagosPrincipal)}
                    valueClass="text-emerald-600 text-xl"
                  />
                  <KpiCard
                    label="Saldo pendiente"
                    value={fmtMxn(financials?.saldoPendiente ?? 0)}
                    valueClass={`text-xl ${(financials?.saldoPendiente ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
                  />
                  <KpiCard
                    label="Pagos registrados"
                    value={pagosPrincipal.length}
                    sub={`${conComprobante} con comprobante · ${sinComprobante} sin comprobante`}
                    valueClass="text-slate-900 text-xl"
                  />
                </div>
              )}
            </section>

            {/* ── Financial detail cards ── */}
            <section>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Detalle financiero</h3>
              {isLoadingCards ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => <DetailCardSkeleton key={i} />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <DetailCard
                    label="Total pagado (aplicaciones)"
                    value={fmtMxn(financials?.totalPagadoAplicaciones ?? 0)}
                    valueClass="text-emerald-600 text-xl"
                    sub="Excluye conceptos 7 y 9"
                    icon={<TrendingUp className="w-4 h-4 text-slate-400" />}
                  />
                  <DetailCard
                    label="Sobrepago"
                    value={financials?.haySobrepago ? fmtMxn(financials.montoSobrepago) : '—'}
                    valueClass={`text-xl ${financials?.haySobrepago ? 'text-red-500' : 'text-slate-400'}`}
                    icon={<TrendingDown className="w-4 h-4 text-slate-400" />}
                  />
                  <NotariaPldSummaryCard
                    pldStatus={pld.pldStatus}
                    motivoPrincipal={pld.motivoPrincipal}
                    escrituraBloqueada={pld.escrituraBloqueada}
                  />
                </div>
              )}
            </section>

            {/* ── Efectivo + Escrituración + Accesorios ── */}
            {!isLoadingCards && financials && (
              <section>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Efectivo y escrituración</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <CashPaymentCard
                    limite={financials.limiteEfectivo}
                    pagado={financials.pagadoEfectivo}
                    disponible={financials.aunPermitidoEfectivo}
                  />
                  {financials.valorEscrituracion != null && (
                    <EscrituracionCard value={financials.valorEscrituracion} />
                  )}
                  {accesorios?.bodega && (
                    <AccesorioCard
                      titulo="Bodega"
                      precioFinal={accesorios.bodega.precioFinal}
                      totalPagado={accesorios.bodega.totalPagadoReal}
                      saldoPendiente={accesorios.bodega.saldoPendiente}
                    />
                  )}
                  {accesorios?.cajon && (
                    <AccesorioCard
                      titulo="Cajón / Estacionamiento"
                      precioFinal={accesorios.cajon.precioFinal}
                      totalPagado={accesorios.cajon.totalPagadoReal}
                      saldoPendiente={accesorios.cajon.saldoPendiente}
                    />
                  )}
                </div>
              </section>
            )}

            {/* ── Tabla principal ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pagos — Unidad principal</h3>
                {isLoadingTable && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
              </div>
              <NotariaPaymentsTable
                pagos={rowsPrincipal}
                isLoading={isLoadingTable}
                flagsPorPago={pld.flagsPorPago}
              />
            </section>

            {/* ── Tabla bodega ── */}
            {(rowsBodega.length > 0 || isLoadingTable) && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pagos — Bodega(s)</h3>
                  {isLoadingTable && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                </div>
                <NotariaPaymentsTable
                  pagos={rowsBodega}
                  isLoading={isLoadingTable}
                />
              </section>
            )}

            {/* ── Tabla estacionamiento ── */}
            {(rowsEst.length > 0 || isLoadingTable) && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pagos — Estacionamiento(s) / Cajón(es)</h3>
                  {isLoadingTable && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                </div>
                <NotariaPaymentsTable
                  pagos={rowsEst}
                  isLoading={isLoadingTable}
                />
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Visor de comprobante ── */}
      <Dialog open={!!viewerUrl} onOpenChange={open => { if (!open) setViewerUrl(null); }}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Comprobante</span>
            </div>
            <div className="flex items-center gap-2">
              {viewerUrl && (
                <a
                  href={viewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" /> Abrir en nueva pestaña
                </a>
              )}
              <button
                onClick={() => setViewerUrl(null)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {viewerUrl && (
            <iframe
              src={viewerUrl}
              className="flex-1 w-full border-0"
              title="Comprobante"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
