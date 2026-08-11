import { useMemo, useState } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Info, Building2, AlertTriangle, TrendingUp, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useProyectosMotorComisiones } from '@/hooks/usePortalEstructuraComisiones/useProyectosMotorComisiones';
import {
  useCanalesConfigProyecto, resolverCanalesDeProyecto, canalesAplicables,
} from '@/hooks/usePortalEstructuraComisiones/useCanalesPorProyecto';
import { useProyectosSozuReales } from '@/hooks/usePortalEstructuraComisiones/useProyectosTallwoodReales';
import {
  useEstructuraRealRaw, comisionistasDisponibles,
} from '@/hooks/usePortalEstructuraComisiones/useEstructuraRealSimulador';
import {
  useMetasEscalon, useGuardarMeta, useEliminarMeta,
  escalonAlcanzado, siguienteMeta, pctEfectivo, type MetaEscalon,
} from '@/hooks/usePortalEstructuraComisiones/useMetasEscalon';

/**
 * Incentivos por metas de cierre mensual.
 *
 * Sustituye a las reglas de volumen, monto de venta y enganche, que no se
 * operaban. La lógica real: cada canal define metas de ventas por mes y, al
 * alcanzarlas, sube la comisión de **todos** sus comisionistas de forma
 * **retroactiva al mes**.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);

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

  /** Precio base para estimar el valor en pesos, igual que en Comisiones. */
  const { proyectos: proyectosSozu } = useProyectosSozuReales();
  const precioPromUnidad = proyectosSozu.find(p => p.id === motorProjectId)?.precioPromedioUnidad ?? 0;

  /** Ventas del mes por canal, para simular. Solo vive en la pantalla. */
  const [ventasSimuladas, setVentasSimuladas] = useState<Record<string, number>>({});

  if (motorProjectId == null) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Encabezado
          proyectosMotor={proyectosMotor}
          cargandoProyectos={cargandoProyectos}
          motorProjectId={motorProjectId}
          setMotorProjectId={setMotorProjectId}
        />
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
      <Encabezado
        proyectosMotor={proyectosMotor}
        cargandoProyectos={cargandoProyectos}
        motorProjectId={motorProjectId}
        setMotorProjectId={setMotorProjectId}
      />

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
          Cada canal define <strong>metas de ventas por mes</strong>. Al alcanzar una meta, la comisión
          de <strong>todos los comisionistas de ese canal</strong> sube el porcentaje indicado sobre su
          comisión base, y el ajuste es <strong>retroactivo</strong>: todas las ventas del mes se
          liquidan al porcentaje nuevo. Aplica el escalón <strong>mayor alcanzado</strong>, no la suma.
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
            metas={(metas ?? []).filter(m => m.idCanal === canal.id)}
            ddlPendiente={ddlPendiente}
            comisionistasDelCanal={commissionRules
              .filter(r => r.channelId === canal.id && r.percentage > 0)
              .map(r => ({
                id: r.id,
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

function Encabezado({ proyectosMotor, cargandoProyectos, motorProjectId, setMotorProjectId }: {
  proyectosMotor: Array<{ id: number; nombre: string }>;
  cargandoProyectos: boolean;
  motorProjectId: number | null;
  setMotorProjectId: (id: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">Incentivos por metas de cierre</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Define cuántas ventas debe cerrar cada canal en el mes para que suba la comisión de su equipo.
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
}

/** Escalera de un canal + simulador de lo que se paga con N ventas en el mes. */
function CanalEscalera({
  canal, idProyecto, metas, ddlPendiente, comisionistasDelCanal,
  ventasDelMes, onVentasChange, precioPromUnidad, nombreProyecto,
}: {
  canal: { id: string; name: string };
  idProyecto: number;
  metas: MetaEscalon[];
  ddlPendiente: boolean;
  comisionistasDelCanal: Array<{ id: string; nombre: string; pctBase: number }>;
  ventasDelMes: number;
  onVentasChange: (v: number) => void;
  precioPromUnidad: number;
  nombreProyecto: string;
}) {
  const guardar = useGuardarMeta(idProyecto);
  const eliminar = useEliminarMeta(idProyecto);
  const [nuevaMeta, setNuevaMeta] = useState('');
  const [nuevoIncremento, setNuevoIncremento] = useState('');

  const ordenadas = [...metas].sort((a, b) => a.ventasMeta - b.ventasMeta);
  const alcanzado = escalonAlcanzado(ordenadas, ventasDelMes);
  const proxima = siguienteMeta(ordenadas, ventasDelMes);

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
    if (ordenadas.some(m => m.ventasMeta === meta)) {
      toast.error(`Ya existe un escalón para ${meta} ventas en este canal`); return;
    }
    guardar.mutate({ idCanal: canal.id, ventasMeta: meta, incrementoPct: inc }, {
      onSuccess: () => { setNuevaMeta(''); setNuevoIncremento(''); toast.success('Escalón agregado'); },
      onError,
    });
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{canal.name}</h3>
          {alcanzado ? (
            <Badge className="text-[10px] gap-1">
              <TrendingUp className="h-3 w-3" />
              +{alcanzado.incrementoPct}% desde {alcanzado.ventasMeta} ventas
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

      {/* Escalera */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Metas del canal
        </p>
        {ordenadas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic mb-2">
            Sin metas definidas: la comisión se queda en la base.
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
                      la comisión efectiva es 1.2%.
                    </TooltipContent>
                  </Tooltip>
                </th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map(m => {
                const activa = alcanzado?.id === m.id;
                const superada = ventasDelMes >= m.ventasMeta && !activa;
                return (
                  <tr key={m.id} className={ventasDelMes < m.ventasMeta ? 'opacity-60' : ''}>
                    <td className="font-medium">{m.ventasMeta} ventas</td>
                    <td className="font-mono text-sm">+{m.incrementoPct}%</td>
                    <td>
                      {activa
                        ? <Badge className="text-[10px]">Aplicando</Badge>
                        : superada
                          ? <span className="text-xs text-muted-foreground">Superada</span>
                          : <span className="text-xs text-muted-foreground">
                              Faltan {m.ventasMeta - ventasDelMes}
                            </span>}
                    </td>
                    <td>
                      <button
                        title="Quitar escalón"
                        onClick={() => eliminar.mutate(m.id, {
                          onSuccess: () => toast.success('Escalón eliminado'),
                          onError,
                        })}
                        className="rounded p-1 hover:bg-destructive/10"
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

        <div className="flex flex-wrap items-center gap-2">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="number"
            min="1"
            placeholder="Ventas"
            className="w-24 h-8 text-sm"
            disabled={ddlPendiente}
            value={nuevaMeta}
            onChange={e => setNuevaMeta(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">ventas →</span>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="% sobre base"
            className="w-32 h-8 text-sm"
            disabled={ddlPendiente}
            value={nuevoIncremento}
            onChange={e => setNuevoIncremento(e.target.value)}
          />
          <Button size="sm" variant="outline" className="gap-1" disabled={ddlPendiente} onClick={agregar}>
            <Plus className="h-3 w-3" /> Agregar escalón
          </Button>
        </div>
      </div>

      {/* Efecto sobre cada comisionista */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Con {ventasDelMes} venta{ventasDelMes === 1 ? '' : 's'} en el mes
          {proxima && (
            <span className="ml-2 font-normal normal-case text-amber-600">
              · faltan {proxima.ventasMeta - ventasDelMes} para +{proxima.incrementoPct}%
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
                  <th>Comisionista</th>
                  <th>Comisión base</th>
                  <th>Comisión efectiva</th>
                  <th>Por unidad</th>
                  <th>Total del mes</th>
                </tr>
              </thead>
              <tbody>
                {comisionistasDelCanal.map(c => {
                  const efectivo = pctEfectivo(c.pctBase, alcanzado);
                  const porUnidad = precioPromUnidad * efectivo / 100;
                  return (
                    <tr key={c.id}>
                      <td className="text-sm font-medium">{c.nombre}</td>
                      <td className="font-mono text-sm">{c.pctBase.toFixed(2)}%</td>
                      <td className="font-mono text-sm font-semibold">
                        {efectivo.toFixed(2)}%
                        {alcanzado && (
                          <span className="ml-1 text-[11px] font-normal text-accent">
                            +{alcanzado.incrementoPct}%
                          </span>
                        )}
                      </td>
                      <td className="font-mono text-sm">
                        {precioPromUnidad > 0 ? fmt(porUnidad) : '—'}
                      </td>
                      <td className="font-mono text-sm font-semibold">
                        {precioPromUnidad > 0 ? fmt(porUnidad * ventasDelMes) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          {precioPromUnidad > 0
            ? `Estimado sobre el precio promedio ponderado por unidad disponible de ${nombreProyecto}: ${fmt(precioPromUnidad)}. Al ser retroactivo, las ${ventasDelMes} ventas del mes se liquidan al porcentaje efectivo.`
            : `Sin unidades disponibles en ${nombreProyecto} no hay precio promedio con el que estimar el pago.`}
        </p>
      </div>
    </div>
  );
}
