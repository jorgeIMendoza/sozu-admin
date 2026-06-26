import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GlobalFiltersBar } from '@/components/admin/portal-productos/GlobalFiltersBar';
import { usePortalProductosStore } from '@/lib/portal-productos/store';
import { aplicarFiltrosCobranza, deriveTodas, type CuentaDerivada } from '@/lib/portal-productos/derive';
import { formatMXN, formatPct } from '@/lib/portal-productos/format';
import { CATEGORIAS, PROPIETARIOS, type Categoria } from '@/lib/portal-productos/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

export default function AnalisisCobranzaPage() {
  const cuentas = usePortalProductosStore(s => s.cuentas);
  const filtros = usePortalProductosStore(s => s.filtros);
  const filtradas: CuentaDerivada[] = useMemo(
    () => deriveTodas(aplicarFiltrosCobranza(cuentas, filtros)),
    [cuentas, filtros],
  );
  const [catConcepto, setCatConcepto] = useState<Categoria>('Paquete de muebles');

  const porCategoria = useMemo(() => CATEGORIAS.map(cat => {
    const cs = filtradas.filter(c => c.producto.categoria === cat);
    let com = 0, cob = 0, pen = 0, ven = 0;
    for (const c of cs) { com += c.precioFinal; cob += c.totalPagado; pen += c.saldoPendiente; ven += c.saldoVencido; }
    return { cat, n: cs.length, com, cob, pen, ven };
  }), [filtradas]);

  const totalRow = porCategoria.reduce((acc, r) => ({
    n: acc.n + r.n, com: acc.com + r.com, cob: acc.cob + r.cob, pen: acc.pen + r.pen, ven: acc.ven + r.ven,
  }), { n: 0, com: 0, cob: 0, pen: 0, ven: 0 });

  const aging = useMemo(() => {
    const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    let totalDias = 0, nVenc = 0;
    for (const c of filtradas) {
      if (c.agingBucket) {
        buckets[c.agingBucket] += c.saldoVencido;
        totalDias += c.diasAtraso; nVenc++;
      }
    }
    return { data: Object.entries(buckets).map(([bucket, monto]) => ({ bucket, monto })), promedio: nVenc ? Math.round(totalDias / nVenc) : 0 };
  }, [filtradas]);

  const COLORS_AGING = ['#16A34A', '#F59E0B', '#EA580C', '#DC2626'];

  // Selección de bucket de aging → muestra las cuentas de ese rango.
  const [bucketSel, setBucketSel] = useState<string | null>(null);
  const cuentasBucket = useMemo(
    () => bucketSel
      ? filtradas.filter(c => c.agingBucket === bucketSel).sort((a, b) => b.saldoVencido - a.saldoVencido)
      : [],
    [filtradas, bucketSel],
  );

  const porConcepto = useMemo(() => {
    const cs = filtradas.filter(c => c.producto.categoria === catConcepto);
    const map: Record<string, { nombre: string; com: number; cob: number; pen: number }> = {};
    for (const c of cs) {
      const k = c.producto.nombre;
      (map[k] ||= { nombre: k, com: 0, cob: 0, pen: 0 });
      map[k].com += c.precioFinal; map[k].cob += c.totalPagado; map[k].pen += c.saldoPendiente;
    }
    return Object.values(map).sort((a, b) => b.com - a.com);
  }, [filtradas, catConcepto]);

  const porPropietario = useMemo(() => PROPIETARIOS.map(p => {
    const cs = filtradas.filter(c => c.producto.propietario === p);
    let com = 0, cob = 0, pen = 0, ven = 0;
    for (const c of cs) { com += c.precioFinal; cob += c.totalPagado; pen += c.saldoPendiente; ven += c.saldoVencido; }
    return { p, com, cob, pen, ven };
  }), [filtradas]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Análisis de Cobranza</h1>
        <p className="mt-1 text-sm text-slate-500">Cobranza por categoría, concepto, antigüedad y propietario</p>
      </div>
      <GlobalFiltersBar />

      <Bloque titulo="Cobranza por Categoría">
        <table className="w-full text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Cuentas</th>
              <th className="px-4 py-3 text-right">Comercializado</th>
              <th className="px-4 py-3 text-right">Cobrado</th>
              <th className="px-4 py-3 text-right">Pendiente</th>
              <th className="px-4 py-3 text-right">Vencido</th>
              <th className="px-4 py-3 text-left">% Cobrado</th>
            </tr>
          </thead>
          <tbody>
            {porCategoria.map(r => {
              const pct = r.com ? r.cob / r.com : 0;
              return (
                <tr key={r.cat} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.cat}</td>
                  <td className="px-4 py-3 text-right">{r.n}</td>
                  <td className="px-4 py-3 text-right">{formatMXN(r.com)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatMXN(r.cob)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{formatMXN(r.pen)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatMXN(r.ven)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${pct * 100}%` }} /></div>
                      <span className="text-xs text-slate-600">{formatPct(pct)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 text-sm font-semibold">
              <td className="px-4 py-3">Totales</td>
              <td className="px-4 py-3 text-right">{totalRow.n}</td>
              <td className="px-4 py-3 text-right">{formatMXN(totalRow.com)}</td>
              <td className="px-4 py-3 text-right text-emerald-700">{formatMXN(totalRow.cob)}</td>
              <td className="px-4 py-3 text-right text-amber-700">{formatMXN(totalRow.pen)}</td>
              <td className="px-4 py-3 text-right text-red-600">{formatMXN(totalRow.ven)}</td>
              <td className="px-4 py-3 text-xs text-slate-600">{totalRow.com ? formatPct(totalRow.cob / totalRow.com) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </Bloque>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Aging de cartera</h3>
            <span className="text-[11px] text-slate-400">Haz clic en un rango para ver sus cuentas</span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatMXN(v)} />
                <Bar
                  dataKey="monto"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d: any) => {
                    const b = d?.bucket ?? d?.payload?.bucket;
                    if (b) setBucketSel(prev => (prev === b ? null : b));
                  }}
                >
                  {aging.data.map((d, i) => (
                    <Cell
                      key={i}
                      fill={COLORS_AGING[i]}
                      fillOpacity={!bucketSel || bucketSel === d.bucket ? 1 : 0.35}
                      stroke={bucketSel === d.bucket ? '#0F172A' : undefined}
                      strokeWidth={bucketSel === d.bucket ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Antigüedad promedio</div>
          <div className="mt-2 text-4xl font-bold text-red-600">{aging.promedio}<span className="ml-1 text-lg font-normal text-slate-500">días</span></div>
        </div>
      </div>

      {/* Cuentas del rango de aging seleccionado */}
      {bucketSel && (
        <Bloque
          titulo={`Cuentas con antigüedad ${bucketSel} días (${cuentasBucket.length})`}
          extra={
            <button onClick={() => setBucketSel(null)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700">
              <X className="h-3.5 w-3.5" /> Limpiar selección
            </button>
          }
        >
          {cuentasBucket.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">No hay cuentas en este rango.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">ID Cuenta</th>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-left">Comprador</th>
                  <th className="px-4 py-3 text-left">Propietario</th>
                  <th className="px-4 py-3 text-right">Saldo vencido</th>
                  <th className="px-4 py-3 text-right">Días atraso</th>
                </tr>
              </thead>
              <tbody>
                {cuentasBucket.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link to={`/admin/portal-productos/cartera/${c.id}`} className="font-mono text-xs font-semibold text-emerald-700 hover:underline">{c.id}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{c.producto.nombre}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.producto.categoria}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.compradores[0]?.persona.nombreLegal ?? '—'}{c.compradores.length > 1 ? ` (+${c.compradores.length - 1})` : ''}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.producto.propietario}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">{formatMXN(c.saldoVencido)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{c.diasAtraso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bloque>
      )}

      <Bloque titulo="Cobranza por Concepto" extra={
        <Select value={catConcepto} onValueChange={v => setCatConcepto(v as Categoria)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      }>
        <table className="w-full text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-right">Comercializado</th>
              <th className="px-4 py-3 text-right">Cobrado</th>
              <th className="px-4 py-3 text-right">Pendiente</th>
              <th className="px-4 py-3 text-left">% Cobrado</th>
            </tr>
          </thead>
          <tbody>
            {porConcepto.map(r => {
              const pct = r.com ? r.cob / r.com : 0;
              return (
                <tr key={r.nombre} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.nombre}</td>
                  <td className="px-4 py-3 text-right">{formatMXN(r.com)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatMXN(r.cob)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{formatMXN(r.pen)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${pct * 100}%` }} /></div>
                      <span className="text-xs text-slate-600">{formatPct(pct)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {porConcepto.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">Sin datos.</td></tr>}
          </tbody>
        </table>
      </Bloque>

      <Bloque titulo="Cobranza por Propietario">
        <table className="w-full text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Propietario</th>
              <th className="px-4 py-3 text-right">Comercializado</th>
              <th className="px-4 py-3 text-right">Cobrado</th>
              <th className="px-4 py-3 text-right">Pendiente</th>
              <th className="px-4 py-3 text-right">Vencido</th>
            </tr>
          </thead>
          <tbody>
            {porPropietario.map(r => (
              <tr key={r.p} className="border-b border-gray-100">
                <td className="px-4 py-3 font-medium text-slate-900">{r.p}</td>
                <td className="px-4 py-3 text-right">{formatMXN(r.com)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{formatMXN(r.cob)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{formatMXN(r.pen)}</td>
                <td className="px-4 py-3 text-right text-red-600">{formatMXN(r.ven)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloque>
    </div>
  );
}

function Bloque({ titulo, children, extra }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        {extra}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}