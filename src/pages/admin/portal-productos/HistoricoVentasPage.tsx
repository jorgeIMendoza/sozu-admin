import { useMemo, useState } from 'react';
import { RefreshCw, ShoppingCart, BadgeDollarSign, Package, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalFiltersBar } from '@/components/admin/portal-productos/GlobalFiltersBar';
import { KpiCard } from './KpiCard';
import { usePortalProductosStore } from '@/lib/portal-productos/store';
import { aplicarFiltrosVentas, aplicarFiltrosCobranza } from '@/lib/portal-productos/derive';
import { formatMXN, formatNumber, mesEtiqueta } from '@/lib/portal-productos/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function HistoricoVentasPage() {
  const cuentas = usePortalProductosStore(s => s.cuentas);
  const filtros = usePortalProductosStore(s => s.filtros);
  const refrescar = usePortalProductosStore(s => s.refrescar);
  const rangoMeses = filtros.rangoMeses > 0 ? filtros.rangoMeses : 12;
  const filtradas = useMemo(() => aplicarFiltrosVentas(cuentas, filtros, rangoMeses), [cuentas, filtros, rangoMeses]);
  const cobranzaScope = useMemo(() => aplicarFiltrosCobranza(cuentas, filtros), [cuentas, filtros]);
  const [modo, setModo] = useState<'monto' | 'unidades'>('monto');

  const serie = useMemo(() => {
    const map = new Map<string, { mes: string; unidades: number; valor: number; cobrado: number; key: string }>();
    const hoy = new Date();
    for (let i = rangoMeses - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      map.set(k, { mes: mesEtiqueta(d), unidades: 0, valor: 0, cobrado: 0, key: k });
    }
    for (const c of filtradas) {
      const d = new Date(c.fechaCompra);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const row = map.get(k);
      if (row) { row.unidades += 1; row.valor += c.precioFinal; }
    }
    for (const c of cuentas) {
      for (const ap of c.aplicaciones) {
        const d = new Date(ap.fechaPago);
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        const row = map.get(k);
        if (row) row.cobrado += ap.montoAplicado;
      }
    }
    return Array.from(map.values());
  }, [filtradas, cuentas, rangoMeses]);

  const hoy = new Date();
  const mesActualKey = `${hoy.getFullYear()}-${hoy.getMonth()}`;
  const mesActual = serie.find(s => s.key === mesActualKey) || { unidades: 0, valor: 0, cobrado: 0 };

  const totalVendidos = cobranzaScope.length;
  const valorCarteraActiva = cobranzaScope.reduce((s, c) => {
    const aplicado = c.aplicaciones.reduce((x, a) => x + a.montoAplicado, 0);
    return s + Math.max(c.precioFinal - aplicado, 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Histórico de Ventas de Productos</h1>
          <p className="mt-1 text-sm text-slate-500">Evolución mensual de unidades y valor comercializado</p>
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
        <KpiCard label="Vendidos este mes" value={formatNumber(mesActual.unidades)} sub={formatMXN(mesActual.valor)} icon={<ShoppingCart className="h-4 w-4" />} tone="positive" />
        <KpiCard label="Cobrado este mes MXN" value={formatMXN(mesActual.cobrado)} icon={<BadgeDollarSign className="h-4 w-4" />} tone="positive" />
        <KpiCard label="Total vendidos" value={formatNumber(totalVendidos)} sub="cuentas históricas" icon={<Package className="h-4 w-4" />} />
        <KpiCard label="Valor cartera activa MXN" value={formatMXN(valorCarteraActiva)} sub="saldos pendientes" icon={<Layers className="h-4 w-4" />} tone="warning" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Evolución mensual</h3>
            <p className="text-xs text-slate-500">{modo === 'monto' ? 'Valor vendido por mes' : 'Unidades vendidas por mes'}</p>
          </div>
          <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-xs font-medium">
            <button onClick={() => setModo('unidades')} className={`rounded px-3 py-1 ${modo === 'unidades' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Por unidades</button>
            <button onClick={() => setModo('monto')} className={`rounded px-3 py-1 ${modo === 'monto' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Por monto</button>
          </div>
        </div>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#64748B', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={(v) => modo === 'monto' ? `$${(v / 1000).toFixed(0)}k` : `${v}`} />
              <Tooltip formatter={(v: number) => modo === 'monto' ? formatMXN(v) : `${v} u.`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={modo === 'monto' ? 'valor' : 'unidades'} fill="#16A34A" radius={[4, 4, 0, 0]} name={modo === 'monto' ? 'Valor vendido' : 'Unidades'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Resumen mensual</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Mes</th>
              <th className="px-4 py-3 text-right">Unidades</th>
              <th className="px-4 py-3 text-right">Valor vendido</th>
              <th className="px-4 py-3 text-right">Cobrado en el mes</th>
            </tr>
          </thead>
          <tbody>
            {serie.map(r => (
              <tr key={r.key} className="border-b border-gray-100">
                <td className="px-4 py-3 font-medium text-slate-900">{r.mes}</td>
                <td className="px-4 py-3 text-right">{formatNumber(r.unidades)}</td>
                <td className="px-4 py-3 text-right">{formatMXN(r.valor)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{formatMXN(r.cobrado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}