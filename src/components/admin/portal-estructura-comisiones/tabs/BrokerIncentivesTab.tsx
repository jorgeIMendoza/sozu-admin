import { Fragment, useMemo, useState } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus, Trash2, Info, Building2, AlertTriangle, TrendingUp, Target, ChevronRight, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useProyectosMotorComisiones } from '@/hooks/usePortalEstructuraComisiones/useProyectosMotorComisiones';
import {
  useCanalesConfigProyecto, resolverCanalesDeProyecto, canalesAplicables,
} from '@/hooks/usePortalEstructuraComisiones/useCanalesPorProyecto';
import { useProyectosSozuReales } from '@/hooks/usePortalEstructuraComisiones/useProyectosTallwoodReales';
import {
  useEstructuraRealRaw, comisionistasDisponibles,
} from '@/hooks/usePortalEstructuraComisiones/useEstructuraRealSimulador';
import {
  useMetasEscalon, useCrearEscalon, useActualizarEscalon, useEliminarEscalon,
  escaleraEfectiva, desglosePorVenta, totalesDelMes, tramoVigente, siguienteTramo,
  type MetaEscalon, type TramoEfectivo,
} from '@/hooks/usePortalEstructuraComisiones/useMetasEscalon';

/**
 * Incentivos por metas de cierre mensual.
 *
 * El cálculo es **marginal por tramos**: cada venta se paga con el porcentaje
 * del tramo en el que cae y las ventas anteriores conservan el suyo. La escalera
 * se define por canal y admite override por comisionista.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);

/** Tope de columnas del desglose, para que la tabla siga siendo legible. */
const MAX_COLUMNAS_DESGLOSE = 12;

export default function BrokerIncentivesTab() {
  const { channels: catalogoCanales, motorProjectId, setMotorProjectId, commissionRules, roles } = useSimulator();
  const { data: proyectosMotor = [], isLoading: cargandoProyectos } = useProyectosMotorComisiones();
  const proyectoActual = proyectosMotor.find(p => p.id === motorProjectId);

  const { data: canalesConfig } = useCanalesConfigProyecto(motorProjectId);
  const canales = useMemo(
    () => canalesAplicables(resolverCanalesDeProyecto(catalogoCanales, canalesConfig)),
    [catalogoCanales, canalesConfig],
  );

  const { data: metas } = useMetasEscalon(motorProjectId);
  const ddlPendiente = metas === null;

  const { data: estructuraRaw } = useEstructuraRealRaw();
  const comisionistas = useMemo(
    () => comisionistasDisponibles(estructuraRaw, roles, motorProjectId),
    [estructuraRaw, roles, motorProjectId],
  );
  const nombrePorPersonal = useMemo(
    () => new Map(comisionistas.map(c => [c.personalId, c.nombre])),
    [comisionistas],
  );

  const { proyectos: proyectosSozu } = useProyectosSozuReales();
  const precioPromUnidad = proyectosSozu.find(p => p.id === motorProjectId)?.precioPromedioUnidad ?? 0;

  const [ventasSimuladas, setVentasSimuladas] = useState<Record<string, number>>({});

  const encabezado = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">Incentivos por metas de cierre</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Define cuántas ventas debe cerrar cada canal en el mes para que suba la comisión, y
          ajusta la escalera por comisionista cuando haga falta.
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select
          value={motorProjectId != null ? String(motorProjectId) : undefined}
          onValueChange={(v) => setMotorProjectId(Number(v))}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder={cargandoProyectos ? 'Cargando proyectos…' : 'Selecciona un proyecto'} />
          </SelectTrigger>
          <SelectContent>
            {proyectosMotor.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (motorProjectId == null) {
    return (
      <div className="space-y-6 animate-fade-in">
        {encabezado}
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Selecciona un proyecto</p>
          <p className="text-xs text-muted-foreground">
            Las metas de cierre se definen por canal y por desarrollo. Elige uno arriba para empezar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {encabezado}

      {ddlPendiente && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium">DDL pendiente de ejecutar en la base de datos</p>
            <p className="text-muted-foreground">
              La tabla <code>comisiones_metas_escalon</code> aún no existe. Ejecuta el DDL de{' '}
              <code>Ejecuciones_manuales/20260811_incentivos_metas_cierre.md</code> para poder
              capturar la escalera.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span>
          Las metas se miden con las <strong>ventas del canal</strong> en el mes. El cálculo es{' '}
          <strong>marginal por tramos</strong>: cada venta se paga con el porcentaje del tramo en
          el que cae y las anteriores <strong>conservan el suyo</strong>. Con escalones 3/5/7, las
          ventas 1–2 van a la base, 3–4 al escalón de 3, 5–6 al de 5 y 7 en adelante al de 7.
        </span>
      </div>

      {canales.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Este proyecto no tiene canales habilitados. Actívalos en Canales de Venta.
        </p>
      ) : (
        canales.map(canal => (
          <CanalEscalera
            key={canal.id}
            canal={canal}
            idProyecto={motorProjectId}
            escalonesDelCanal={(metas ?? []).filter(m => m.idCanal === canal.id && m.idPersonal === null)}
            escalonesPorPersona={(metas ?? []).filter(m => m.idCanal === canal.id && m.idPersonal !== null)}
            ddlPendiente={ddlPendiente}
            comisionistasDelCanal={commissionRules
              .filter(r => r.channelId === canal.id && r.percentage > 0)
              .map(r => ({
                idRegla: r.id,
                idPersonal: r.personalId,
                nombre: r.personalId ? nombrePorPersonal.get(r.personalId) ?? 'Sin comisionista' : 'Sin comisionista',
                pctBase: r.percentage,
              }))}
            ventasDelMes={ventasSimuladas[canal.id] ?? 0}
            onVentasChange={(v) => setVentasSimuladas(prev => ({ ...prev, [canal.id]: v }))}
            precioPromUnidad={precioPromUnidad}
            nombreProyecto={proyectoActual?.nombre ?? ''}
          />
        ))
      )}
    </div>
  );
}

interface ComisionistaFila {
  idRegla: string;
  idPersonal: string | null;
  nombre: string;
  pctBase: number;
}

function CanalEscalera({
  canal, idProyecto, escalonesDelCanal, escalonesPorPersona, ddlPendiente,
  comisionistasDelCanal, ventasDelMes, onVentasChange, precioPromUnidad, nombreProyecto,
}: {
  canal: { id: string; name: string };
  idProyecto: number;
  escalonesDelCanal: MetaEscalon[];
  escalonesPorPersona: MetaEscalon[];
  ddlPendiente: boolean;
  comisionistasDelCanal: ComisionistaFila[];
  ventasDelMes: number;
  onVentasChange: (v: number) => void;
  precioPromUnidad: number;
  nombreProyecto: string;
}) {
  const [expandida, setExpandida] = useState<string | null>(null);

  const escaleraCanal = useMemo(() => escaleraEfectiva(escalonesDelCanal, []), [escalonesDelCanal]);
  const vigente = tramoVigente(escaleraCanal, ventasDelMes);
  const proxima = siguienteTramo(escaleraCanal, ventasDelMes);
  const columnas = Math.min(ventasDelMes, MAX_COLUMNAS_DESGLOSE);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{canal.name}</h3>
          {vigente ? (
            <Badge className="text-[10px] gap-1">
              <TrendingUp className="h-3 w-3" />
              tramo actual +{vigente.incrementoPct}% desde {vigente.ventasMeta} ventas
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Comisión base</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Ventas del mes</span>
          <Input
            type="number"
            min="0"
            className="w-20 h-8 text-sm font-mono"
            value={ventasDelMes}
            onChange={e => onVentasChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
        </div>
      </div>

      <TablaEscalones
        titulo="Metas del canal"
        subtitulo="Aplican a todos los comisionistas que no tengan su propia escalera."
        idProyecto={idProyecto}
        idCanal={canal.id}
        idPersonal={null}
        escalones={escalonesDelCanal}
        ventasDelMes={ventasDelMes}
        ddlPendiente={ddlPendiente}
      />

      {/* Efecto por comisionista, con su desglose venta por venta */}
      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Con {ventasDelMes} venta{ventasDelMes === 1 ? '' : 's'} en el mes
          {proxima && (
            <span className="ml-2 font-normal normal-case text-amber-600">
              · la venta {proxima.ventasMeta} sube a +{proxima.incrementoPct}%
            </span>
          )}
        </p>

        {comisionistasDelCanal.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Sin comisionistas con porcentaje capturado en este canal. Configúralos en Comisiones.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Comisionista</th>
                  <th>Base</th>
                  {Array.from({ length: columnas }, (_, i) => (
                    <th key={i} className="text-right whitespace-nowrap">Venta {i + 1}</th>
                  ))}
                  {ventasDelMes > MAX_COLUMNAS_DESGLOSE && <th className="text-right">…</th>}
                  <th className="text-right">Total del mes</th>
                </tr>
              </thead>
              <tbody>
                {comisionistasDelCanal.map(c => {
                  const propios = escalonesPorPersona.filter(m => m.idPersonal === c.idPersonal);
                  const escalera = escaleraEfectiva(escalonesDelCanal, propios);
                  const desglose = desglosePorVenta(c.pctBase, escalera, ventasDelMes, precioPromUnidad);
                  const totales = totalesDelMes(desglose);
                  const abierta = expandida === c.idRegla;
                  const tieneOverride = propios.length > 0;

                  return (
                    <Fragment key={c.idRegla}>
                      <tr>
                        <td>
                          <button
                            title={abierta ? 'Ocultar su escalera' : 'Ver y editar su escalera'}
                            onClick={() => setExpandida(abierta ? null : c.idRegla)}
                            className="rounded p-1 hover:bg-muted"
                          >
                            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', abierta && 'rotate-90')} />
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium whitespace-nowrap">{c.nombre}</span>
                            {tieneOverride && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-[10px] border-accent text-accent gap-0.5">
                                    <User className="h-2.5 w-2.5" /> propia
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  Tiene {propios.length} tramo(s) propio(s) que sobrescriben al canal.
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="font-mono text-sm">{c.pctBase.toFixed(2)}%</td>
                        {desglose.slice(0, columnas).map(v => (
                          <td key={v.ordinal} className="text-right whitespace-nowrap">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-sm">
                                {precioPromUnidad > 0 ? fmt(v.importe) : '—'}
                              </span>
                              <span className={cn(
                                'font-mono text-[10px]',
                                v.tramo ? 'text-accent' : 'text-muted-foreground',
                              )}>
                                {v.pct.toFixed(3)}%
                              </span>
                            </div>
                          </td>
                        ))}
                        {Array.from({ length: Math.max(0, columnas - desglose.length) }, (_, i) => (
                          <td key={`vacia-${i}`} className="text-right text-muted-foreground">—</td>
                        ))}
                        {ventasDelMes > MAX_COLUMNAS_DESGLOSE && (
                          <td className="text-right text-xs text-muted-foreground">
                            +{ventasDelMes - MAX_COLUMNAS_DESGLOSE}
                          </td>
                        )}
                        <td className="text-right font-mono text-sm font-semibold whitespace-nowrap">
                          {precioPromUnidad > 0 ? fmt(totales.importe) : '—'}
                        </td>
                      </tr>

                      {abierta && (
                        <tr>
                          <td colSpan={columnas + 4 + (ventasDelMes > MAX_COLUMNAS_DESGLOSE ? 1 : 0)}>
                            <div className="rounded-lg border bg-card p-4 my-1">
                              <TablaEscalones
                                titulo={`Escalera propia de ${c.nombre}`}
                                subtitulo="Sobrescribe el tramo del canal con la misma meta. Los tramos que no definas aquí se heredan."
                                idProyecto={idProyecto}
                                idCanal={canal.id}
                                idPersonal={c.idPersonal}
                                escalones={propios}
                                ventasDelMes={ventasDelMes}
                                ddlPendiente={ddlPendiente}
                                escaleraHeredada={escalera}
                                deshabilitado={c.idPersonal === null}
                                motivoDeshabilitado="Este renglón no tiene comisionista asignado: asígnalo en Comisiones para darle escalera propia."
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          {precioPromUnidad > 0
            ? `Estimado sobre el precio promedio ponderado por unidad disponible de ${nombreProyecto}: ${fmt(precioPromUnidad)}. Cada venta se paga con el porcentaje de su tramo; las anteriores conservan el suyo.`
            : `Sin unidades disponibles en ${nombreProyecto} no hay precio promedio con el que estimar el pago.`}
        </p>
      </div>
    </div>
  );
}

/**
 * Tabla de escalones editable, tanto del canal como de un comisionista.
 * Los cambios de meta e incremento se confirman en blur, no por tecla.
 */
function TablaEscalones({
  titulo, subtitulo, idProyecto, idCanal, idPersonal, escalones, ventasDelMes,
  ddlPendiente, escaleraHeredada, deshabilitado, motivoDeshabilitado,
}: {
  titulo: string;
  subtitulo: string;
  idProyecto: number;
  idCanal: string;
  idPersonal: string | null;
  escalones: MetaEscalon[];
  ventasDelMes: number;
  ddlPendiente: boolean;
  /** Escalera resultante tras el merge, para mostrar qué se hereda. */
  escaleraHeredada?: TramoEfectivo[];
  deshabilitado?: boolean;
  motivoDeshabilitado?: string;
}) {
  const crear = useCrearEscalon(idProyecto);
  const actualizar = useActualizarEscalon(idProyecto);
  const eliminar = useEliminarEscalon(idProyecto);
  const [nuevaMeta, setNuevaMeta] = useState('');
  const [nuevoIncremento, setNuevoIncremento] = useState('');

  const ordenados = [...escalones].sort((a, b) => a.ventasMeta - b.ventasMeta);
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar');

  const agregar = () => {
    const meta = Number(nuevaMeta);
    const inc = Number(nuevoIncremento);
    if (!Number.isInteger(meta) || meta <= 0) {
      toast.error('La meta debe ser un número entero de ventas mayor a cero'); return;
    }
    if (!Number.isFinite(inc) || inc < 0) {
      toast.error('El incremento no puede ser negativo'); return;
    }
    if (ordenados.some(m => m.ventasMeta === meta)) {
      toast.error(`Ya existe un escalón para ${meta} ventas en este nivel`); return;
    }
    crear.mutate({ idCanal, idPersonal, ventasMeta: meta, incrementoPct: inc }, {
      onSuccess: () => { setNuevaMeta(''); setNuevoIncremento(''); toast.success('Escalón agregado'); },
      onError,
    });
  };

  const bloqueado = ddlPendiente || deshabilitado;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{titulo}</p>
      <p className="text-[11px] text-muted-foreground mb-2">{subtitulo}</p>

      {deshabilitado && motivoDeshabilitado && (
        <p className="text-xs text-amber-600 mb-2">{motivoDeshabilitado}</p>
      )}

      {ordenados.length === 0 ? (
        <p className="text-sm text-muted-foreground italic mb-2">
          {idPersonal === null
            ? 'Sin metas definidas: la comisión se queda en la base.'
            : 'Sin tramos propios: hereda toda la escalera del canal.'}
        </p>
      ) : (
        <table className="data-table mb-2">
          <thead>
            <tr>
              <th>Al llegar a</th>
              <th>
                Incremento sobre la base
                <Tooltip>
                  <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Porcentaje de la comisión base, no puntos porcentuales: con base 1.0% y +20%,
                    ese tramo paga 1.2%. Solo afecta a las ventas de su tramo.
                  </TooltipContent>
                </Tooltip>
              </th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map(m => {
              const alcanzado = ventasDelMes >= m.ventasMeta;
              return (
                <tr key={m.id} className={alcanzado ? '' : 'opacity-60'}>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <NumeroEditable
                        valor={m.ventasMeta}
                        entero
                        min={1}
                        ancho="w-20"
                        disabled={bloqueado}
                        onCommit={(v) => actualizar.mutate({ id: m.id, ventasMeta: v }, {
                          onSuccess: () => toast.success('Meta actualizada'), onError,
                        })}
                      />
                      <span className="text-xs text-muted-foreground">ventas</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">+</span>
                      <NumeroEditable
                        valor={m.incrementoPct}
                        min={0}
                        ancho="w-24"
                        disabled={bloqueado}
                        onCommit={(v) => actualizar.mutate({ id: m.id, incrementoPct: v }, {
                          onSuccess: () => toast.success('Incremento actualizado'), onError,
                        })}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td>
                    {alcanzado
                      ? <Badge variant="secondary" className="text-[10px]">Alcanzado</Badge>
                      : <span className="text-xs text-muted-foreground">
                          Faltan {m.ventasMeta - ventasDelMes}
                        </span>}
                  </td>
                  <td>
                    <button
                      title="Quitar escalón"
                      disabled={bloqueado}
                      onClick={() => eliminar.mutate(m.id, {
                        onSuccess: () => toast.success('Escalón eliminado'), onError,
                      })}
                      className="rounded p-1 hover:bg-destructive/10 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Qué escalera queda tras el merge, cuando es la de una persona */}
      {escaleraHeredada && escaleraHeredada.length > 0 && (
        <p className="text-[11px] text-muted-foreground mb-2">
          Escalera efectiva:{' '}
          {escaleraHeredada.map((t, i) => (
            <span key={t.ventasMeta}>
              {i > 0 && ' · '}
              <span className={t.esOverride ? 'text-accent font-medium' : ''}>
                {t.ventasMeta}→+{t.incrementoPct}%{t.esOverride ? ' (propio)' : ''}
              </span>
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Target className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="number"
          min="1"
          placeholder="Ventas"
          className="w-24 h-8 text-sm"
          disabled={bloqueado}
          value={nuevaMeta}
          onChange={e => setNuevaMeta(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">ventas →</span>
        <Input
          type="number"
          min="0"
          placeholder="% sobre base"
          className="w-32 h-8 text-sm"
          disabled={bloqueado}
          value={nuevoIncremento}
          onChange={e => setNuevoIncremento(e.target.value)}
        />
        <Button size="sm" variant="outline" className="gap-1" disabled={bloqueado} onClick={agregar}>
          <Plus className="h-3 w-3" /> Agregar escalón
        </Button>
      </div>
    </div>
  );
}

/** Input numérico que confirma en blur/Enter, para no disparar un UPDATE por tecla. */
function NumeroEditable({ valor, onCommit, ancho, min = 0, entero, disabled }: {
  valor: number;
  onCommit: (v: number) => void;
  ancho: string;
  min?: number;
  entero?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (!Number.isFinite(parsed) || parsed < min || (entero && !Number.isInteger(parsed))) {
      toast.error(entero
        ? `Debe ser un número entero mayor o igual a ${min}`
        : `Debe ser un número mayor o igual a ${min}`);
      return;
    }
    if (parsed !== valor) onCommit(parsed);
  };

  return (
    <Input
      type="number"
      min={min}
      disabled={disabled}
      className={cn('h-8 text-sm font-mono', ancho)}
      value={draft ?? String(valor)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}
