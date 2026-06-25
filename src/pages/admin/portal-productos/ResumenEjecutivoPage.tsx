import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { Boxes, CheckCircle2, Clock, AlertOctagon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, PieChart, Pie, Cell, LabelList } from 'recharts';
import { KpiCard, StatusBadge } from './KpiCard';
import { GlobalFiltersBar } from '@/components/admin/portal-productos/GlobalFiltersBar';
import { usePortalProductosStore } from '@/lib/portal-productos/store';
import { aplicarFiltrosCobranza, deriveTodas, type CuentaDerivada } from '@/lib/portal-productos/derive';
import { formatMXN, formatPct } from '@/lib/portal-productos/format';
import { CATEGORIAS, CATEGORIA_LABEL_CORTO, PROPIETARIOS } from '@/lib/portal-productos/types';

const COLORS_PROP = ['#16A34A', '#0EA5E9', '#A855F7'];

export default function ResumenEjecutivoPage() {
  const cuentas = usePortalProductosStore(s => s.cuentas);
  const filtros = usePortalProductosStore(s => s.filtros);
  const refrescar = usePortalProductosStore(s => s.refrescar);

  const filtradas: CuentaDerivada[] = useMemo(
    () => deriveTodas(aplicarFiltrosCobranza(cuentas, filtros)),
    [cuentas, filtros],
  );
  const totalSinFiltro = cuentas.length;

  const totales = useMemo(() => {
    let comercializado = 0, cobrado = 0, pendiente = 0, vencido = 0, nVencidas = 0;
    for (const c of filtradas) {
      comercializado += c.precioFinal;
      cobrado += c.totalPagado;
      pendiente += c.saldoPendiente;
      vencido += c.saldoVencido;
      if (c.estatusPago === 'vencido') nVencidas++;
    }
    return { comercializado, cobrado, pendiente, vencido, nVencidas };
  }, [filtradas]);

  const porCategoria = useMemo(() => CATEGORIAS.map(cat => {
    const cs = filtradas.filter(c => c.producto.categoria === cat);
    let cobrado = 0, pendiente = 0, vencido = 0, total = 0;
    for (const c of cs) {
      cobrado += c.totalPagado;
      vencido += c.saldoVencido;
      pendiente += Math.max(0, c.saldoPendiente - c.saldoVencido);
      total += c.precioFinal;
    }
    return { categoria: CATEGORIA_LABEL_CORTO[cat], categoriaCompleta: cat, Cobrado: cobrado, Pendiente: pendiente, Vencido: vencido, total };
  }), [filtradas]);

  const porPropietario = useMemo(() => PROPIETARIOS.map(p => ({
    name: p,
    value: filtradas.filter(c => c.producto.propietario === p).reduce((s, c) => s + c.precioFinal, 0),
  })).filter(x => x.value > 0), [filtradas]);

  const atencion = useMemo(() => [...filtradas]
    .filter(c => c.estatusPago === 'vencido')
    .sort((a, b) => b.saldoVencido - a.saldoVencido)
    .slice(0, 8), [filtradas]);

  const conteoLabel = filtradas.length === totalSinFiltro
    ? `${filtradas.length} cuentas`
    : `${filtradas.length} en filtro · ${totalSinFiltro} en total`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Resumen Ejecutivo</h1>
          <p className="mt-1 text-sm text-slate-500">Cartera de productos comercializados</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Datos en vivo
          </span>
          <Button variant="outline" size="sm" onClick={refrescar}><RefreshCw className="h-3.5 w-3.5" /> Refrescar</Button>
        </div>
      </div>

      <GlobalFiltersBar />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Valor comercializado MXN" value={formatMXN(totales.comercializado)} sub={conteoLabel} icon={<Boxes className="h-4 w-4" />} />
        <KpiCard label="Total cobrado MXN" value={formatMXN(totales.cobrado)} sub={totales.comercializado > 0 ? `${formatPct(totales.cobrado / totales.comercializado)} del total` : '—'} icon={<CheckCircle2 className="h-4 w-4" />} tone="positive" />
        <KpiCard label="Saldo pendiente MXN" value={formatMXN(totales.pendiente)} sub={totales.comercializado > 0 ? `${formatPct(totales.pendiente / totales.comercializado)} restante` : '—'} icon={<Clock className="h-4 w-4" />} tone="warning" />
        <KpiCard label="Cartera vencida MXN" value={formatMXN(totales.vencido)} sub={`${totales.nVencidas} cuentas vencidas`} icon={<AlertOctagon className="h-4 w-4" />} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900">Cobranza por Categoría</h3>
          <p className="text-xs text-slate-500">Cobrado · Pendiente · Vencido (MXN)</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCategoria}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="categoria" tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatMXN(v)} labelFormatter={(_, payload) => payload?.[0]?.payload?.categoriaCompleta ?? ''} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Cobrado" stackId="a" fill="#16A34A" />
                <Bar dataKey="Pendiente" stackId="a" fill="#F59E0B" />
                <Bar dataKey="Vencido" stackId="a" fill="#DC2626" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="total" position="top" formatter={(v: number) => v > 0 ? `$${Math.round(v / 1000)}k` : ''} style={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Mezcla por Propietario</h3>
          <p className="text-xs text-slate-500">Valor comercializado</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porPropietario} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {porPropietario.map((_, i) => <Cell key={i} fill={COLORS_PROP[i % COLORS_PROP.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatMXN(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Cuentas que requieren atención</h3>
          <p className="text-xs text-slate-500">Top 8 cuentas con mayor saldo vencido</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left">ID Cuenta</th>
              <th className="px-5 py-3 text-left">Producto</th>
              <th className="px-5 py-3 text-left">Categoría</th>
              <th className="px-5 py-3 text-left">Comprador</th>
              <th className="px-5 py-3 text-right">Saldo vencido</th>
              <th className="px-5 py-3 text-left">Días atraso</th>
            </tr>
          </thead>
          <tbody>
            {atencion.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">No hay cuentas vencidas en el rango actual.</td></tr>
            )}
            {atencion.map((c) => (
              <tr key={c.id} className="cursor-pointer border-b border-gray-100 hover:bg-slate-50">
                <td className="px-5 py-4">
                  <Link to={`/admin/portal-productos/cartera/${c.id}`} className="font-mono text-xs font-semibold text-emerald-700">{c.id}</Link>
                </td>
                <td className="px-5 py-4 text-slate-700">{c.producto.nombre}</td>
                <td className="px-5 py-4 text-slate-600">{c.producto.categoria}</td>
                <td className="px-5 py-4 text-slate-600">{c.compradores[0]?.persona.nombreLegal}{c.compradores.length > 1 ? ` (+${c.compradores.length - 1})` : ''}</td>
                <td className="px-5 py-4 text-right font-semibold text-red-600">{formatMXN(c.saldoVencido)}</td>
                <td className="px-5 py-4"><StatusBadge estatus="vencido" dias={c.diasAtraso} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}