import { Link } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { Search, Download, Eye } from 'lucide-react';
import { PaginationBar } from '@/components/admin/PaginationBar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { usePortalProductosStore } from '@/lib/portal-productos/store';
import { deriveTodas } from '@/lib/portal-productos/derive';
import { formatMXN } from '@/lib/portal-productos/format';
import { StatusBadge, SatBadge } from './KpiCard';
import { CATEGORIAS, PROPIETARIOS, PROYECTOS, type EstatusPago } from '@/lib/portal-productos/types';

export default function CarteraPage() {
  const cuentas = usePortalProductosStore(s => s.cuentas);
  const [busqueda, setBusqueda] = useState('');
  const [tab, setTab] = useState<'todos' | EstatusPago>('todos');
  const [categoria, setCategoria] = useState<string>('all');
  const [proyecto, setProyecto] = useState<string>('all');
  const [propietario, setPropietario] = useState<string>('all');
  const [vendedor, setVendedor] = useState<string>('all');
  const [orden, setOrden] = useState<'precio' | 'pendiente' | 'dias'>('precio');

  const enriquecidas = useMemo(() => deriveTodas(cuentas), [cuentas]);

  // Vendedores reales presentes en los datos (para el filtro).
  const vendedores = useMemo(
    () => [...new Set(enriquecidas.map(c => c.agenteVendedor).filter(v => v && v !== '—'))].sort((a, b) => a.localeCompare(b)),
    [enriquecidas],
  );

  const counts = useMemo(() => {
    const r: Record<'todos' | EstatusPago, number> = { todos: enriquecidas.length, pagado: 0, al_corriente: 0, atrasado: 0, vencido: 0 };
    for (const e of enriquecidas) r[e.estatusPago]++;
    return r;
  }, [enriquecidas]);

  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    let arr = enriquecidas.filter((c) => {
      if (tab !== 'todos' && c.estatusPago !== tab) return false;
      if (categoria !== 'all' && c.producto.categoria !== categoria) return false;
      if (proyecto !== 'all' && c.proyecto !== proyecto) return false;
      if (propietario !== 'all' && c.producto.propietario !== propietario) return false;
      if (vendedor !== 'all' && c.agenteVendedor !== vendedor) return false;
      if (q) {
        const hay = [c.id, c.producto.nombre, c.propiedad.noPropiedad, c.agenteVendedor, ...c.compradores.map(x => x.persona.nombreLegal)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    arr = [...arr].sort((a, b) => {
      if (orden === 'precio') return b.precioFinal - a.precioFinal;
      if (orden === 'pendiente') return b.saldoPendiente - a.saldoPendiente;
      return b.diasAtraso - a.diasAtraso;
    });
    return arr;
  }, [enriquecidas, busqueda, tab, categoria, proyecto, propietario, vendedor, orden]);

  // Paginación: 20 productos por vista.
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [busqueda, tab, categoria, proyecto, propietario, vendedor, orden, enriquecidas.length]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => filtradas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtradas, page],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cartera de Productos</h1>
          <p className="mt-1 text-sm text-slate-500">Todas las cuentas de cobranza de tipo Producto</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.success('Exportación simulada a Excel')}>
          <Download className="h-3.5 w-3.5" /> Exportar a Excel
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por ID Cuenta, Producto, Comprador o No. Propiedad…" className="h-11 pl-10" />
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as never)}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="todos">Todos <span className="ml-1.5 text-slate-400">({counts.todos})</span></TabsTrigger>
          <TabsTrigger value="pagado">Pagados <span className="ml-1.5 text-slate-400">({counts.pagado})</span></TabsTrigger>
          <TabsTrigger value="al_corriente">Al corriente <span className="ml-1.5 text-slate-400">({counts.al_corriente})</span></TabsTrigger>
          <TabsTrigger value="atrasado">Atrasados <span className="ml-1.5 text-slate-400">({counts.atrasado})</span></TabsTrigger>
          <TabsTrigger value="vencido">Vencidos <span className="ml-1.5 text-slate-400">({counts.vencido})</span></TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas las categorías</SelectItem>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={proyecto} onValueChange={setProyecto}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos los proyectos</SelectItem>{PROYECTOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={propietario} onValueChange={setPropietario}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Propietario" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos los propietarios</SelectItem>{PROPIETARIOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={vendedor} onValueChange={setVendedor}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los vendedores</SelectItem>
            {vendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={orden} onValueChange={v => setOrden(v as never)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="precio">Ordenar: Precio</SelectItem>
            <SelectItem value="pendiente">Ordenar: Pendiente</SelectItem>
            <SelectItem value="dias">Ordenar: Días atraso</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { setCategoria('all'); setProyecto('all'); setPropietario('all'); setVendedor('all'); setBusqueda(''); setTab('todos'); }} className="text-slate-600">Limpiar filtros</Button>
        <span className="ml-auto text-xs text-slate-500">
          {filtradas.length === enriquecidas.length ? `${filtradas.length} resultados` : `${filtradas.length} en filtro · ${enriquecidas.length} en total`}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">ID Cuenta</th>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Comprador(es)</th>
                <th className="px-4 py-3 text-left">Propiedad ligada</th>
                <th className="px-4 py-3 text-left">Propietario</th>
                <th className="px-4 py-3 text-left">Vendedor</th>
                <th className="px-4 py-3 text-right">Precio Final</th>
                <th className="px-4 py-3 text-right">Pagado</th>
                <th className="px-4 py-3 text-right">Pendiente</th>
                <th className="px-4 py-3 text-left">Avance</th>
                <th className="px-4 py-3 text-left">Estatus</th>
                <th className="px-4 py-3 text-center">SAT</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => (
                <tr key={c.id} className="group border-b border-gray-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    {/^(CCP|BOD|EST)-/.test(c.id) ? (
                      <Link
                        to={`/admin/portal-productos/cartera/${c.id}`}
                        title="Ver detalle de la cuenta de cobranza"
                        className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        {c.id}
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-slate-500">{c.id}</span>
                    )}
                  </td>
                  <td className="max-w-[260px] px-4 py-2.5">
                    <div className="truncate font-medium text-slate-900" title={c.producto.nombre}>{c.producto.nombre}</div>
                    <div className="truncate text-xs text-slate-500" title={c.producto.descripcion}>{c.producto.descripcion}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.producto.categoria}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.compradores[0]?.persona.nombreLegal}{c.compradores.length > 1 ? ` (+${c.compradores.length - 1})` : ''}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{c.propiedad.noPropiedad} · {c.propiedad.modelo} · {c.propiedad.edificio}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.producto.propietario}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.agenteVendedor && c.agenteVendedor !== '—' ? c.agenteVendedor : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{formatMXN(c.precioFinal)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-700">{formatMXN(c.totalPagado)}</td>
                  <td className={`px-4 py-2.5 text-right ${c.saldoPendiente === 0 ? 'text-slate-500' : 'text-amber-700'}`}>{formatMXN(c.saldoPendiente)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Progress value={c.avancePct} className={`h-1.5 w-24 ${c.avancePct >= 90 ? '[&>div]:bg-emerald-500' : c.avancePct >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`} />
                      <span className="text-xs text-slate-600">{c.avancePct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge estatus={c.estatusPago} dias={c.diasAtraso} /></td>
                  <td className="px-4 py-2.5 text-center"><SatBadge tieneSat={!!c.producto.satId} /></td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-400">Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalCount={filtradas.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}