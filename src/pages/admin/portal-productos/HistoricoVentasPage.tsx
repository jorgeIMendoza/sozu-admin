import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShoppingCart, BadgeDollarSign, Package, Layers, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalFiltersBar } from '@/components/admin/portal-productos/GlobalFiltersBar';
import { KpiCard } from './KpiCard';
import { usePortalProductosStore } from '@/lib/portal-productos/store';
import { aplicarFiltrosVentas, aplicarFiltrosCobranza } from '@/lib/portal-productos/derive';
import { formatMXN, formatNumber, formatFecha, mesEtiqueta } from '@/lib/portal-productos/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts';

export default function HistoricoVentasPage() {
  const cuentas = usePortalProductosStore(s => s.cuentas);
  const filtros = usePortalProductosStore(s => s.filtros);
  const refrescar = usePortalProductosStore(s => s.refrescar);
  const rangoMeses = filtros.rangoMeses > 0 ? filtros.rangoMeses : 12;
  const filtradas = useMemo(() => aplicarFiltrosVentas(cuentas, filtros, rangoMeses), [cuentas, filtros, rangoMeses]);
  const cobranzaScope = useMemo(() => aplicarFiltrosCobranza(cuentas, filtros), [cuentas, filtros]);
  const [modo, setModo] = useState<'monto' | 'unidades'>('monto');
  const [mesSel, setMesSel] = useState<string | null>(null);

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

  // Cuentas del mes seleccionado en el gráfico (por fecha de compra).
  const cuentasMes = useMemo(() => {
    if (!mesSel) return [];
    return filtradas
      .filter(c => { const d = new Date(c.fechaCompra); return `${d.getFullYear()}-${d.getMonth()}` === mesSel; })
      .sort((a, b) => b.precioFinal - a.precioFinal);
  }, [filtradas, mesSel]);
  const mesSelLabel = serie.find(s => s.key === mesSel)?.mes ?? '';
  const mesSelMonto = cuentasMes.reduce((s, c) => s + c.precioFinal, 0);

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
              <Bar
                dataKey={modo === 'monto' ? 'valor' : 'unidades'}
                radius={[4, 4, 0, 0]}
                name={modo === 'monto' ? 'Valor vendido' : 'Unidades'}
                cursor="pointer"
                onClick={(d: any) => {
                  const k = d?.key ?? d?.payload?.key;
                  if (k) setMesSel(prev => (prev === k ? null : k));
                }}
              >
                {serie.map((d, i) => (
                  <Cell
                    key={i}
                    fill="#16A34A"
                    fillOpacity={!mesSel || mesSel === d.key ? 1 : 0.4}
                    stroke={mesSel === d.key ? '#0F172A' : undefined}
                    strokeWidth={mesSel === d.key ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-[11px] text-slate-400">Haz clic en un mes para ver sus cuentas</p>
      </div>

      {/* Cuentas del mes seleccionado */}
      {mesSel && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Cuentas vendidas en {mesSelLabel}
              <span className="ml-2 font-normal text-slate-500">{cuentasMes.length} u. · {formatMXN(mesSelMonto)}</span>
            </h3>
            <button onClick={() => setMesSel(null)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700">
              <X className="h-3.5 w-3.5" /> Limpiar selección
            </button>
          </div>
          <div className="overflow-x-auto">
            {cuentasMes.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">No hay cuentas vendidas en este mes.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">ID Cuenta</th>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-left">Categoría</th>
                    <th className="px-4 py-3 text-left">Comprador</th>
                    <th className="px-4 py-3 text-left">Propietario</th>
                    <th className="px-4 py-3 text-left">Fecha compra</th>
                    <th className="px-4 py-3 text-right">Precio final</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentasMes.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link to={`/admin/portal-productos/cartera/${c.id}`} className="font-mono text-xs font-semibold text-emerald-700 hover:underline">{c.id}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{c.producto.nombre}</td>
                      <td className="px-4 py-2.5 text-slate-600">{c.producto.categoria}</td>
                      <td className="px-4 py-2.5 text-slate-600">{c.compradores[0]?.persona.nombreLegal ?? '—'}{c.compradores.length > 1 ? ` (+${c.compradores.length - 1})` : ''}</td>
                      <td className="px-4 py-2.5 text-slate-600">{c.producto.propietario}</td>
                      <td className="px-4 py-2.5 text-slate-600">{c.fechaCompra ? formatFecha(c.fechaCompra, 'card') : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{formatMXN(c.precioFinal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

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