import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Info, ChevronRight, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useHistorialComisiones, resumirPorProyecto,
  type ComisionHistorial, type EstatusComision, type TipoComision,
} from '@/hooks/usePortalEstructuraComisiones/useHistorialComisiones';

/**
 * Historial de comisiones — la trazabilidad del pago real.
 *
 * El resto del portal modela lo que *debería* pagarse; esta vista muestra lo que
 * ya se devengó y en qué estado está. Sirve para auditar una contra la otra.
 *
 * **Paleta**: dos tonos categóricos —externa e interna—, validados con el script
 * de la guía de visualización en claro y oscuro (banda de luminosidad, piso de
 * croma, separación CVD con peor par ΔE 23.7 protan, y contraste contra la
 * superficie). Son los mismos que Escenarios y el comparativo de canales usan
 * para lo externo y lo dispersado, así que un color significa lo mismo en todo
 * el portal. Lo pagado va en tono pleno y lo pendiente al 35% con borde: dentro
 * de una serie es 1 hue en 2 intensidades, no un tercer color.
 */

const COLOR_EXTERNA = '#c2761c';
const COLOR_INTERNA = '#1f86cc';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);

const fechaCorta = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ESTILO_ESTATUS: Record<EstatusComision, { texto: string; clase: string }> = {
  pagada: { texto: 'Pagada', clase: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  autorizada: { texto: 'Autorizada', clase: 'border-primary/40 bg-primary/10 text-primary' },
  en_espera: { texto: 'En espera', clase: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
};

export default function HistorialComisionesTab() {
  const { data: comisiones = [], isLoading } = useHistorialComisiones();

  const [busqueda, setBusqueda] = useState('');
  const [proyecto, setProyecto] = useState<string>('todos');
  const [tipo, setTipo] = useState<'todos' | TipoComision>('todos');
  const [estatus, setEstatus] = useState<'todos' | EstatusComision>('todos');
  const [expandido, setExpandido] = useState<number | null>(null);

  const proyectosDisponibles = useMemo(
    () => [...new Set(comisiones.map(c => c.contexto))].sort(),
    [comisiones],
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return comisiones.filter(c => {
      if (proyecto !== 'todos' && c.contexto !== proyecto) return false;
      if (tipo !== 'todos' && c.tipo !== tipo) return false;
      if (estatus !== 'todos' && c.estatus !== estatus) return false;
      if (!q) return true;
      return `${c.beneficiario} ${c.rol} ${c.folio} ${c.contexto} ${c.unidad ?? ''}`
        .toLowerCase().includes(q);
    });
  }, [comisiones, busqueda, proyecto, tipo, estatus]);

  /** Totales del conjunto filtrado: los KPI deben responder a lo que se ve. */
  const totales = useMemo(() => {
    const t = { externa: 0, interna: 0, pagado: 0, pendiente: 0, unidades: new Set<number>() };
    for (const c of filtradas) {
      if (c.tipo === 'externa') t.externa += c.monto; else t.interna += c.monto;
      if (c.estatus === 'pagada') t.pagado += c.monto; else t.pendiente += c.monto;
      t.unidades.add(c.idCuenta);
    }
    return { ...t, unidades: t.unidades.size, total: t.externa + t.interna };
  }, [filtradas]);

  const porProyecto = useMemo(() => resumirPorProyecto(filtradas), [filtradas]);

  /** Agrupado por cuenta: la trazabilidad natural es "esta venta, estos pagos". */
  const porCuenta = useMemo(() => {
    const mapa = new Map<number, ComisionHistorial[]>();
    for (const c of filtradas) {
      const lista = mapa.get(c.idCuenta);
      if (lista) lista.push(c);
      else mapa.set(c.idCuenta, [c]);
    }
    return [...mapa.entries()]
      .map(([idCuenta, items]) => ({
        idCuenta,
        items,
        total: items.reduce((s, x) => s + x.monto, 0),
        cabeza: items[0],
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtradas]);

  const hayFiltro = proyecto !== 'todos' || tipo !== 'todos' || estatus !== 'todos' || busqueda.trim() !== '';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">Historial de Comisiones</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Comisiones ya devengadas, externas e internas, con su estatus y su trazabilidad hasta la
          venta. El resto del portal define cuánto <em>debería</em> pagarse; aquí se ve lo que
          efectivamente se pagó.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Cargando el historial…</p>
        </div>
      ) : comisiones.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Sin comisiones devengadas</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Solo aparecen las comisiones de unidades vendidas o posteriores. Antes de la venta no
            hay comisión que pagar.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs sobre el conjunto filtrado */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              etiqueta="Comisión externa"
              valor={fmt(totales.externa)}
              nota="agentes e inmobiliarias"
              marca={COLOR_EXTERNA}
            />
            <Kpi
              etiqueta="Comisión interna"
              valor={fmt(totales.interna)}
              nota="personal de SOZU"
              marca={COLOR_INTERNA}
            />
            <Kpi
              etiqueta="Pagado"
              valor={fmt(totales.pagado)}
              nota={totales.total > 0 ? `${((totales.pagado / totales.total) * 100).toFixed(1)}% del total` : '—'}
            />
            <Kpi
              etiqueta="Pendiente"
              valor={fmt(totales.pendiente)}
              nota={`${totales.unidades} unidad${totales.unidades === 1 ? '' : 'es'} con comisión`}
              alerta={totales.pendiente > 0}
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por beneficiario, rol, folio, proyecto o unidad…"
                className="pl-9"
              />
            </div>
            <Select value={proyecto} onValueChange={setProyecto}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los proyectos</SelectItem>
                {proyectosDisponibles.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Externa e interna</SelectItem>
                <SelectItem value="externa">Solo externa</SelectItem>
                <SelectItem value="interna">Solo interna</SelectItem>
              </SelectContent>
            </Select>
            <Select value={estatus} onValueChange={(v) => setEstatus(v as typeof estatus)}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estatus</SelectItem>
                <SelectItem value="pagada">Pagadas</SelectItem>
                <SelectItem value="autorizada">Autorizadas</SelectItem>
                <SelectItem value="en_espera">En espera</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AnalisisPorProyecto filas={porProyecto} />

          {/* Detalle, agrupado por venta */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <div>
                <h3 className="font-semibold">Detalle por venta</h3>
                <p className="text-xs text-muted-foreground">
                  Da clic en una venta para ver a quién se le pagó y cuánto.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {porCuenta.length} venta{porCuenta.length === 1 ? '' : 's'} · {filtradas.length} comisiones
                </span>
                {hayFiltro && (
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => { setProyecto('todos'); setTipo('todos'); setEstatus('todos'); setBusqueda(''); }}
                  >
                    Quitar filtros
                  </Button>
                )}
              </div>
            </div>

            {porCuenta.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Ninguna comisión cumple los filtros.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table data-table--anclada">
                  <thead>
                    <tr>
                      <th>Venta</th>
                      <th>Proyecto</th>
                      <th>Unidad</th>
                      <th className="text-right">Precio final</th>
                      <th className="text-right">Comisiones</th>
                      <th className="text-right">% del precio</th>
                      <th>Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCuenta.map(({ idCuenta, items, total, cabeza }) => {
                      const abierta = expandido === idCuenta;
                      const pctPrecio = cabeza.precioFinal > 0 ? (total / cabeza.precioFinal) * 100 : 0;
                      const pendientes = items.filter(i => i.estatus !== 'pagada').length;
                      return (
                        <>
                          <tr
                            key={idCuenta}
                            className={cn('cursor-pointer hover:bg-muted/40', abierta && 'bg-muted/30')}
                            onClick={() => setExpandido(abierta ? null : idCuenta)}
                          >
                            <td className="font-medium whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', abierta && 'rotate-90')} />
                                {cabeza.folio}
                              </span>
                            </td>
                            <td className="text-sm">{cabeza.contexto}</td>
                            <td className="text-sm text-muted-foreground">{cabeza.unidad ?? '—'}</td>
                            <td className="text-right font-mono text-sm whitespace-nowrap">{fmt(cabeza.precioFinal)}</td>
                            <td className="text-right font-mono text-sm font-semibold whitespace-nowrap">{fmt(total)}</td>
                            <td className="text-right font-mono text-sm text-foreground/70">{pctPrecio.toFixed(3)}%</td>
                            <td>
                              {pendientes === 0
                                ? <ChipEstatus estatus="pagada" />
                                : <span className="text-xs text-amber-600 whitespace-nowrap">
                                    {pendientes} de {items.length} sin pagar
                                  </span>}
                            </td>
                          </tr>

                          {abierta && (
                            <tr key={`${idCuenta}-detalle`}>
                              <td colSpan={7} className="bg-muted/20 p-0">
                                <table className="w-full">
                                  <tbody>
                                    {[...items].sort((a, b) => b.monto - a.monto).map(i => (
                                      <tr key={i.clave} className="border-b last:border-0 border-border/50">
                                        <td className="pl-9 py-1.5">
                                          <span className="flex items-center gap-1.5">
                                            <span
                                              className="h-2 w-2 rounded-full shrink-0"
                                              style={{ backgroundColor: i.tipo === 'externa' ? COLOR_EXTERNA : COLOR_INTERNA }}
                                            />
                                            <span className="text-sm">{i.beneficiario}</span>
                                          </span>
                                        </td>
                                        <td className="py-1.5 text-xs text-muted-foreground">{i.rol}</td>
                                        <td className="py-1.5 text-xs text-muted-foreground">
                                          {i.tipo === 'externa' ? 'Externa' : 'Interna'}
                                        </td>
                                        <td className="py-1.5 text-right font-mono text-xs w-20">{i.pct.toFixed(3)}%</td>
                                        <td className="py-1.5 text-right font-mono text-sm w-32 whitespace-nowrap">{fmt(i.monto)}</td>
                                        <td className="py-1.5 w-28"><ChipEstatus estatus={i.estatus} /></td>
                                        <td className="py-1.5 pr-4 text-xs text-muted-foreground w-40 whitespace-nowrap">
                                          {i.estatus === 'pagada' && fechaCorta(i.fechaPago)
                                            ? `Pagada ${fechaCorta(i.fechaPago)}`
                                            : i.autorizacionCuenta ?? '—'}
                                          {i.notasRechazo && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Info className="inline ml-1 h-3 w-3 text-destructive" />
                                              </TooltipTrigger>
                                              <TooltipContent className="max-w-xs text-xs">{i.notasRechazo}</TooltipContent>
                                            </Tooltip>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ etiqueta, valor, nota, marca, alerta }: {
  etiqueta: string; valor: string; nota: string; marca?: string; alerta?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        {marca && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: marca }} />}
        {etiqueta}
      </p>
      <p className={cn('text-xl font-bold font-mono mt-1', alerta && 'text-amber-600')}>{valor}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{nota}</p>
    </div>
  );
}

function ChipEstatus({ estatus }: { estatus: EstatusComision }) {
  const e = ESTILO_ESTATUS[estatus];
  return (
    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', e.clase)}>
      {e.texto}
    </span>
  );
}

/**
 * Pago total por proyecto.
 *
 * **Forma: barras horizontales apiladas, una fila por proyecto.** Horizontal
 * porque los nombres de proyecto son largos y en columnas se tendrían que girar.
 * Dos series —externa e interna—, cada una partida en pagado (tono pleno) y
 * pendiente (35% con borde): dentro de la serie es una intensidad, no un color
 * nuevo, así que siguen siendo dos identidades y no cuatro.
 *
 * Las cifras van al lado, no solo en el gráfico: la barra da la proporción de un
 * vistazo y el número es el que se audita.
 */
function AnalisisPorProyecto({ filas }: { filas: ReturnType<typeof resumirPorProyecto> }) {
  const maximo = useMemo(
    () => Math.max(1, ...filas.map(f => f.total)),
    [filas],
  );

  if (filas.length === 0) return null;

  const totalGeneral = filas.reduce((s, f) => s + f.total, 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">Pago total por proyecto</h3>
          <p className="text-xs text-muted-foreground">
            Comisión devengada por desarrollo, separando externa de interna y pagado de pendiente.
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold font-mono">{fmt(totalGeneral)}</p>
          <p className="text-[11px] text-muted-foreground">
            {filas.length} proyecto{filas.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Leyenda siempre presente: la identidad no depende solo del color. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 pb-3 border-b">
        <LeyendaSerie color={COLOR_EXTERNA} etiqueta="Externa" />
        <LeyendaSerie color={COLOR_INTERNA} etiqueta="Interna" />
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-2.5 w-4 rounded-sm bg-muted-foreground/70 shrink-0" />
          pagado
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-2.5 w-4 rounded-sm border border-muted-foreground/60 bg-muted-foreground/25 shrink-0" />
          pendiente
        </span>
      </div>

      <div className="space-y-3">
        {filas.map(f => (
          <div key={f.proyecto}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
              <span className="text-sm font-medium">{f.proyecto}</span>
              <span className="text-xs text-muted-foreground">
                {f.unidades} unidad{f.unidades === 1 ? '' : 'es'} · {f.operaciones} comisiones ·{' '}
                <span className="font-mono font-semibold text-foreground">{fmt(f.total)}</span>
              </span>
            </div>

            {/* Barra apilada con 2px de separación, como marca la guía. */}
            <div className="flex h-6 w-full gap-0.5">
              <Segmento monto={f.externaPagada} maximo={maximo} color={COLOR_EXTERNA} etiqueta="Externa pagada" />
              <Segmento monto={f.externaPendiente} maximo={maximo} color={COLOR_EXTERNA} pendiente etiqueta="Externa pendiente" />
              <Segmento monto={f.internaPagada} maximo={maximo} color={COLOR_INTERNA} etiqueta="Interna pagada" />
              <Segmento monto={f.internaPendiente} maximo={maximo} color={COLOR_INTERNA} pendiente etiqueta="Interna pendiente" />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              {f.externaPagada > 0 && <Cifra color={COLOR_EXTERNA} texto={`Externa pagada ${fmt(f.externaPagada)}`} />}
              {f.externaPendiente > 0 && <Cifra color={COLOR_EXTERNA} texto={`Externa pendiente ${fmt(f.externaPendiente)}`} atenuado />}
              {f.internaPagada > 0 && <Cifra color={COLOR_INTERNA} texto={`Interna pagada ${fmt(f.internaPagada)}`} />}
              {f.internaPendiente > 0 && <Cifra color={COLOR_INTERNA} texto={`Interna pendiente ${fmt(f.internaPendiente)}`} atenuado />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Segmento({ monto, maximo, color, pendiente, etiqueta }: {
  monto: number; maximo: number; color: string; pendiente?: boolean; etiqueta: string;
}) {
  if (monto <= 0) return null;
  const ancho = `${(monto / maximo) * 100}%`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="first:rounded-l last:rounded-r"
          style={{
            width: ancho,
            backgroundColor: pendiente ? `${color}59` : color,
            border: pendiente ? `1px solid ${color}` : undefined,
          }}
        />
      </TooltipTrigger>
      <TooltipContent className="text-xs">{etiqueta}: {fmt(monto)}</TooltipContent>
    </Tooltip>
  );
}

function LeyendaSerie({ color, etiqueta }: { color: string; etiqueta: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {etiqueta}
    </span>
  );
}

function Cifra({ color, texto, atenuado }: { color: string; texto: string; atenuado?: boolean }) {
  return (
    <span className="flex items-center gap-1 text-[11px]">
      <span
        className="h-2 w-2 rounded-sm shrink-0"
        style={{ backgroundColor: atenuado ? `${color}59` : color, border: atenuado ? `1px solid ${color}` : undefined }}
      />
      <span className="text-muted-foreground">{texto}</span>
    </span>
  );
}
