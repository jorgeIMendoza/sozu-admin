import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  ArrowLeft, ChevronDown, ChevronRight, FileText, CheckCircle2, CreditCard,
  AlertCircle, Banknote, Download, Layers, DollarSign, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { KpiCard, SatBadge } from './KpiCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePortalProductosStore } from '@/lib/portal-productos/store';
import { deriveCuenta } from '@/lib/portal-productos/derive';
import { formatMXN, formatFecha, formatPct } from '@/lib/portal-productos/format';
import { useCuentaProductoDetalle } from '@/hooks/usePortalProductos/useCuentaProductoDetalle';

export default function DetalleCuentaPage() {
  const { cuentaId } = useParams();
  const raw = usePortalProductosStore(s => s.cuentas.find(c => c.id === cuentaId));
  const cuenta = useMemo(() => raw ? deriveCuenta(raw) : null, [raw]);
  const [expand, setExpand] = useState<Record<string, boolean>>({});
  const [pagoExpand, setPagoExpand] = useState<Record<string, boolean>>({});

  // Id numérico real (solo cuentas CCP-) y acuerdos para traer extras (pagos, multas, documentos).
  const cuentaNumId = useMemo(() => {
    const m = cuentaId ? /^CCP-0*(\d+)$/.exec(cuentaId) : null;
    return m ? Number(m[1]) : null;
  }, [cuentaId]);
  const acuerdoIds = useMemo(() => (cuenta?.acuerdos || []).map(a => Number(a.id)).filter(n => !Number.isNaN(n)), [cuenta]);
  const { data: extras } = useCuentaProductoDetalle(cuentaNumId, acuerdoIds);

  const acuerdoNombre = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    cuenta?.acuerdos.forEach(a => { m[a.id] = a.nombre; });
    return m;
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
  const pagos = extras?.pagos ?? [];
  const documentos = extras?.documentos ?? [];
  const multasPorAcuerdo = extras?.multasPorAcuerdo ?? {};

  // Aplicaciones por acuerdo a partir de los PAGOS reales (no de la suma propia).
  type ApReal = { id: number; fecha: string | null; metodo: string; clave: string | null; evidencia: string | null; monto: number; esMulta: boolean };
  const apsPorAcuerdo: Record<string, ApReal[]> = {};
  for (const p of pagos) {
    for (const a of p.apps) {
      (apsPorAcuerdo[String(a.idAcuerdo)] ||= []).push({
        id: a.id, fecha: p.fecha, metodo: p.metodo, clave: p.claveRastreo,
        evidencia: p.urlCep || p.urlRecibo, monto: a.monto, esMulta: a.esMulta,
      });
    }
  }
  const pagadoAcuerdo = (id: string) => (apsPorAcuerdo[id] || []).filter(x => !x.esMulta).reduce((s, x) => s + x.monto, 0);

  const acuerdoStats = cuenta.acuerdos.reduce(
    (acc, a) => {
      const pagado = pagadoAcuerdo(a.id);
      if (a.pagoCompletado || pagado >= a.monto) acc.completados++;
      else if (pagado > 0) acc.parciales++;
      else acc.sinPago++;
      return acc;
    },
    { completados: 0, parciales: 0, sinPago: 0 },
  );
  const pagosMontoTotal = pagos.reduce((s, p) => s + p.monto, 0);
  const stpCount = pagos.filter(p => /stp/i.test(p.metodo)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin/portal-productos/cartera" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700"><ArrowLeft className="h-3.5 w-3.5" /> Volver a Cartera</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Detalle Cuenta de Cobranza {cuenta.id}</h1>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Producto</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">Información detallada de pagos y acuerdos · {cuenta.producto.nombre}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Precio Final" value={formatMXN(cuenta.precioFinal)} icon={<DollarSign className="h-4 w-4" />} />
        <KpiCard label="Total Pagado" value={formatMXN(cuenta.totalPagado)} sub={`${pct(cuenta.totalPagado)} del total`} tone="positive" icon={<DollarSign className="h-4 w-4" />} />
        <KpiCard label="Saldo Pendiente" value={formatMXN(cuenta.saldoPendiente)} sub={`${pct(cuenta.saldoPendiente)} restante`} tone={cuenta.saldoPendiente > 0 ? 'warning' : undefined} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      {/* Información del Producto */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Información del Producto</h3>
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 text-sm md:grid-cols-3">
          <Info label="Proyecto" value={cuenta.proyecto} />
          <Info label="Modelo" value={cuenta.propiedad.modelo} />
          <Info label="Edificio" value={cuenta.propiedad.edificio} />
          <Info label="No. Propiedad" value={cuenta.propiedad.noPropiedad} />
          <Info label="Oferta" value={
            cuenta.ofertaId && cuenta.ofertaId !== '—' ? (
              <a
                href={`/oferta/${cuenta.ofertaId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver oferta comercial"
                className="inline-flex items-center gap-1 font-mono text-emerald-700 hover:underline"
              >
                {cuenta.ofertaId}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : <span className="text-slate-400">—</span>
          } />
          <Info label="Categoría" value={cuenta.producto.categoria} />
          <Info label="Nombre Producto" value={cuenta.producto.nombre} />
          <Info label="Propietario" value={cuenta.producto.propietario} />
          <Info label="CLABE STP" value={<span className="font-mono text-xs">{cuenta.clabeStp || '—'}</span>} />
          <Info label="Fecha Compra" value={cuenta.fechaCompra ? formatFecha(cuenta.fechaCompra, 'card') : '—'} />
          <Info label="Agente Vendedor" value={cuenta.agenteVendedor} />
          <Info label="Clasificación SAT" value={cuenta.producto.satId ? <span className="font-mono text-xs">{cuenta.producto.satId}{cuenta.producto.unidadSat ? ` · ${cuenta.producto.unidadSat}` : ''}</span> : <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Sin clasificación SAT</span>} />
        </div>

        {/* Compradores */}
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h4 className="text-sm font-semibold text-slate-900">Compradores ({cuenta.compradores.length})</h4>
          {cuenta.compradores.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Sin compradores registrados.</p>
          ) : (
            <div className="mt-2 divide-y divide-gray-100">
              {cuenta.compradores.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{c.persona.nombreLegal.split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{c.persona.nombreLegal}</div>
                      {c.persona.rfc && <span className="mt-0.5 inline-block rounded-full border border-emerald-200 px-2 py-0.5 font-mono text-[10px] text-emerald-700">{c.persona.rfc}</span>}
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-700">
                    {(c.porcentaje * 100).toFixed(2)}%<div className="text-[11px] font-normal text-slate-400">Copropiedad</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 text-sm font-semibold text-slate-900">
                <span>Total:</span>
                <span>{(cuenta.compradores.reduce((s, c) => s + c.porcentaje, 0) * 100).toFixed(2)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Acuerdos, Pagos y Documentos */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-900">Acuerdos, Pagos y Documentos</h3>
        <Tabs defaultValue="acuerdos">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="acuerdos">Acuerdos de Pago y Aplicaciones</TabsTrigger>
            <TabsTrigger value="pagos">Pagos Aplicados</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>

          {/* ── Tab Acuerdos ── */}
          <TabsContent value="acuerdos" className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat icon={Layers} label="Total Acuerdos" value={cuenta.acuerdos.length} />
              <MiniStat icon={CheckCircle2} label="Completados" value={acuerdoStats.completados} tone="positive" />
              <MiniStat icon={CreditCard} label="Parciales" value={acuerdoStats.parciales} tone="warning" />
              <MiniStat icon={AlertCircle} label="Sin Pago" value={acuerdoStats.sinPago} tone="danger" />
            </div>

            <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Plan de pagos</h4>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cuenta.acuerdos.map(a => (
                  <div key={a.id}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{a.nombre}</div>
                    <div className="text-sm font-semibold text-slate-800">{a.porcentaje.toFixed(2)}%</div>
                    <div className="text-xs text-emerald-700">{formatMXN(a.monto)}</div>
                  </div>
                ))}
                {cuenta.acuerdos.length === 0 && <p className="text-sm text-slate-400">Sin plan de pagos.</p>}
              </div>
            </div>

            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
              {cuenta.acuerdos.map(a => {
                const isOpen = expand[a.id];
                const aps = (apsPorAcuerdo[a.id] || []).filter(x => !x.esMulta);
                const pagado = pagadoAcuerdo(a.id);
                const multas = multasPorAcuerdo[a.id] || [];
                return (
                  <div key={a.id}>
                    <button onClick={() => setExpand(s => ({ ...s, [a.id]: !s[a.id] }))} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-slate-50">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">{a.orden}</span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{a.nombre}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{aps.length} aplicación(es)</span>
                          {multas.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-600">{multas.length} multa(s)</span>}
                          <span className="text-xs text-slate-400">{a.porcentaje.toFixed(2)}% · {a.fechaCompromiso ? formatFecha(a.fechaCompromiso, 'card') : 'Sin fecha'}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${a.pagoCompletado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{a.pagoCompletado ? 'Pagado' : 'Pendiente'}</span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">Pagado: <span className="font-semibold text-slate-800">{formatMXN(pagado)}</span> de {formatMXN(a.monto)}</div>
                      {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="space-y-3 bg-slate-50/60 px-4 pb-4">
                        {aps.length > 0 ? (
                          <table className="w-full text-xs">
                            <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-2 py-2 text-left">Fecha pago</th>
                                <th className="px-2 py-2 text-left">Método</th>
                                <th className="px-2 py-2 text-left">Clave de rastreo</th>
                                <th className="px-2 py-2 text-left">Comprobante</th>
                                <th className="px-2 py-2 text-right">Monto aplicado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {aps.map(ap => (
                                <tr key={ap.id} className="border-t border-gray-200">
                                  <td className="px-2 py-2">{ap.fecha ? formatFecha(ap.fecha) : 'Sin fecha'}</td>
                                  <td className="px-2 py-2"><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{ap.metodo}</span></td>
                                  <td className="px-2 py-2 font-mono text-[10px] text-slate-600">{ap.clave || '—'}</td>
                                  <td className="px-2 py-2"><Comprobante url={ap.evidencia} /></td>
                                  <td className="px-2 py-2 text-right font-semibold">{formatMXN(ap.monto)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="py-4 text-center text-xs text-slate-400">Sin aplicaciones registradas.</div>
                        )}
                        {/* Multas del acuerdo */}
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Multas</div>
                          {multas.length === 0 ? (
                            <p className="text-[11px] text-slate-400">No hay multas aplicadas a este acuerdo.</p>
                          ) : (
                            <ul className="space-y-1">
                              {multas.map(m => (
                                <li key={m.id} className="flex items-center justify-between text-xs">
                                  <span className="text-slate-600">{m.descripcion || 'Multa'}</span>
                                  <span className="flex items-center gap-2">
                                    <span className="font-semibold">{formatMXN(m.monto)}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${m.esPagada ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{m.esPagada ? 'Pagada' : 'Pendiente'}</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {cuenta.acuerdos.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-400">Sin acuerdos de pago.</div>}
            </div>
          </TabsContent>

          {/* ── Tab Pagos Aplicados ── */}
          <TabsContent value="pagos" className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <MiniStat icon={Banknote} label="Total Pagos" value={pagos.length} />
              <MiniStat icon={DollarSign} label="Monto Total" value={formatMXN(pagosMontoTotal)} tone="positive" isText />
              <MiniStat icon={CreditCard} label="STP" value={stpCount} />
            </div>

            {pagos.length === 0 ? (
              <div className="rounded-xl border border-gray-200 px-4 py-10 text-center text-sm text-slate-400">No hay pagos aplicados a esta cuenta.</div>
            ) : (
              <div className="space-y-3">
                {pagos.map(p => {
                  const isOpen = pagoExpand[p.id];
                  return (
                    <div key={p.id} className="overflow-hidden rounded-xl border border-gray-200">
                      <button onClick={() => setPagoExpand(s => ({ ...s, [p.id]: !s[p.id] }))} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><DollarSign className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">Pago de {formatMXN(p.monto)}</span>
                            <ValidacionBadge estado={p.validacion?.estado} />
                          </div>
                          <div className="text-xs text-slate-500">{p.metodo} · {p.fecha ? formatFecha(p.fecha) : 'Sin fecha'}{p.claveRastreo ? ` · ${p.claveRastreo}` : ''}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Comprobante url={p.urlCep} label="CEP" />
                          <Comprobante url={p.urlRecibo} label="Recibo" />
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{p.apps.length} aplicación(es)</span>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      </button>
                      {isOpen && (
                        <div className="bg-slate-50/60 px-4 pb-4">
                          <table className="w-full text-xs">
                            <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-2 py-2 text-left">Concepto</th>
                                <th className="px-2 py-2 text-left">Tipo</th>
                                <th className="px-2 py-2 text-right">Monto aplicado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.apps.map(ap => (
                                <tr key={ap.id} className="border-t border-gray-200">
                                  <td className="px-2 py-2 text-slate-700">{acuerdoNombre[String(ap.idAcuerdo)] || (ap.esMulta ? 'Multa' : 'Acuerdo')}</td>
                                  <td className="px-2 py-2">{ap.esMulta ? <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600">Multa</span> : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Acuerdo</span>}</td>
                                  <td className="px-2 py-2 text-right font-semibold">{formatMXN(ap.monto)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Tab Documentos ── */}
          <TabsContent value="documentos" className="mt-5">
            {documentos.length === 0 ? (
              <div className="rounded-xl border border-gray-200 px-4 py-10 text-center text-sm text-slate-400">No hay documentos ligados a esta cuenta.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Número</th>
                      <th className="px-4 py-3 text-left">Estatus</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map(d => (
                      <tr key={d.id} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 text-slate-800">{d.tipo}</td>
                        <td className="px-4 py-2.5 text-slate-600">{d.numero || '—'}</td>
                        <td className="px-4 py-2.5"><DocEstatus estatusId={d.estatusId} esDraft={d.esDraft} /></td>
                        <td className="px-4 py-2.5 text-right"><Comprobante url={d.url} label="Ver" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
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

function MiniStat({ icon: Icon, label, value, tone, isText }: { icon: any; label: string; value: number | string; tone?: 'positive' | 'warning' | 'danger'; isText?: boolean }) {
  const color = tone === 'positive' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : tone === 'danger' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-500"><Icon className={`h-3.5 w-3.5 ${color}`} /> {label}</div>
      <div className={`mt-1 font-bold ${isText ? 'text-lg' : 'text-2xl'} ${color}`}>{value}</div>
    </div>
  );
}

function Comprobante({ url, label = 'Comprobante' }: { url: string | null; label?: string }) {
  if (!url) return <span className="text-[11px] text-slate-400">N/A</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50">
      <Download className="h-3 w-3" /> {label}
    </a>
  );
}

function ValidacionBadge({ estado }: { estado?: string }) {
  if (!estado) return null;
  const e = estado.toLowerCase();
  const cls = /valid|aprob/.test(e)
    ? 'bg-emerald-50 text-emerald-700'
    : /rechaz|error/.test(e)
      ? 'bg-red-50 text-red-600'
      : 'bg-amber-50 text-amber-700';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{estado}</span>;
}

function DocEstatus({ estatusId, esDraft }: { estatusId: number | null; esDraft: boolean }) {
  if (esDraft) return <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Borrador</span>;
  if (estatusId === 2) return <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">Validado</span>;
  return <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">Pendiente</span>;
}
