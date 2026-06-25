import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowLeft, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard, SatBadge } from './KpiCard';
import { usePortalProductosStore } from '@/lib/portal-productos/store';
import { deriveCuenta } from '@/lib/portal-productos/derive';
import { formatMXN, formatFecha, formatPct } from '@/lib/portal-productos/format';
import type { AplicacionPago } from '@/lib/portal-productos/types';
import { toast } from 'sonner';

export default function DetalleCuentaPage() {
  const { cuentaId } = useParams();
  const raw = usePortalProductosStore(s => s.cuentas.find(c => c.id === cuentaId));
  const cuenta = useMemo(() => raw ? deriveCuenta(raw) : null, [raw]);
  const [expand, setExpand] = useState<Record<string, boolean>>({});

  const apsPorAcuerdo = useMemo<Record<string, AplicacionPago[]>>(() => {
    const map: Record<string, AplicacionPago[]> = {};
    if (!cuenta) return map;
    for (const a of cuenta.aplicaciones) (map[a.acuerdoId] ||= []).push(a);
    return map;
  }, [cuenta]);

  if (!cuenta) {
    return (
      <div className="space-y-4">
        <Link to="/admin/portal-productos/cartera" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-emerald-700"><ArrowLeft className="h-3.5 w-3.5" /> Volver a Cartera</Link>
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-500">Cuenta no encontrada.</div>
      </div>
    );
  }

  const pct = (n: number) => cuenta.precioFinal ? formatPct(n / cuenta.precioFinal) : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/portal-productos/cartera" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700"><ArrowLeft className="h-3.5 w-3.5" /> Volver a Cartera</Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Detalle Cuenta de Producto {cuenta.id}</h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Producto</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{cuenta.producto.nombre}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.success('PDF simulado: Estado de Cuenta')}>
          <FileText className="h-3.5 w-3.5" /> Estado de Cuenta
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Precio Final MXN" value={formatMXN(cuenta.precioFinal)} />
        <KpiCard label="Total Pagado MXN" value={formatMXN(cuenta.totalPagado)} sub={`${pct(cuenta.totalPagado)} del total`} tone="positive" />
        <KpiCard label="Saldo Pendiente MXN" value={formatMXN(cuenta.saldoPendiente)} sub={`${pct(cuenta.saldoPendiente)} restante`} tone="warning" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Información del Producto</h3>
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 text-sm md:grid-cols-3">
          <Info label="Proyecto" value={cuenta.proyecto} />
          <Info label="Modelo" value={cuenta.propiedad.modelo} />
          <Info label="Edificio" value={cuenta.propiedad.edificio} />
          <Info label="No. Propiedad" value={cuenta.propiedad.noPropiedad} />
          <Info label="Oferta" value={<span className="text-emerald-700">{cuenta.ofertaId}</span>} />
          <Info label="Categoría" value={cuenta.producto.categoria} />
          <Info label="Nombre Producto" value={cuenta.producto.nombre} />
          <Info label="Propietario" value={cuenta.producto.propietario} />
          <Info label="CLABE STP" value={<span className="font-mono text-xs">{cuenta.clabeStp}</span>} />
          <Info label="Fecha Compra" value={formatFecha(cuenta.fechaCompra, 'card')} />
          <Info label="Agente Vendedor" value={cuenta.agenteVendedor} />
          <Info label="Clasificación SAT" value={cuenta.producto.satId ? <span className="font-mono text-xs">{cuenta.producto.satId} · {cuenta.producto.unidadSat}</span> : <SatBadge tieneSat={false} />} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Compradores ({cuenta.compradores.length})</h3>
        <div className="mt-3 divide-y divide-gray-100">
          {cuenta.compradores.map((c, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{c.persona.nombreLegal.split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{c.persona.nombreLegal}</div>
                  <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">{c.persona.rfc}</span>
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-700">{Math.round(c.porcentaje * 100)}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Acuerdos de Pago y Aplicaciones</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {cuenta.acuerdos.map(a => {
            const isOpen = expand[a.id];
            const aps = apsPorAcuerdo[a.id] || [];
            return (
              <div key={a.id}>
                <button onClick={() => setExpand(s => ({ ...s, [a.id]: !s[a.id] }))} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">{a.nombre}</div>
                    <div className="text-xs text-slate-500">{formatFecha(a.fechaCompromiso, 'card')} · {Math.round(a.porcentaje * 100)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">{formatMXN(a.monto)}</div>
                    <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${a.pagoCompletado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{a.pagoCompletado ? 'Pagado' : 'Pendiente'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="bg-slate-50/60 px-5 pb-5">
                    {aps.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-2 py-2 text-left">Fecha</th>
                            <th className="px-2 py-2 text-left">Método</th>
                            <th className="px-2 py-2 text-left">Clave</th>
                            <th className="px-2 py-2 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aps.map(ap => (
                            <tr key={ap.id} className="border-t border-gray-200">
                              <td className="px-2 py-2">{formatFecha(ap.fechaPago)}</td>
                              <td className="px-2 py-2"><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{ap.metodo}</span></td>
                              <td className="px-2 py-2 font-mono text-[10px] text-slate-600">{ap.claveRastreo}</td>
                              <td className="px-2 py-2 text-right font-semibold">{formatMXN(ap.montoAplicado)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400">Sin aplicaciones registradas.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-slate-800">{value}</div>
    </div>
  );
}