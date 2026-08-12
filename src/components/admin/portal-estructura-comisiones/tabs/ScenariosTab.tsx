import { useMemo, useState } from 'react';
import { useSimulator } from '@/lib/portal-estructura-comisiones/stores/SimulatorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus, Trash2, Pencil, Building2, AlertTriangle, Info, TrendingUp, ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useProyectosMotorComisiones } from '@/hooks/usePortalEstructuraComisiones/useProyectosMotorComisiones';
import {
  useCanalesConfigProyecto, resolverCanalesDeProyecto,
} from '@/hooks/usePortalEstructuraComisiones/useCanalesPorProyecto';
import { useProyectosSozuReales } from '@/hooks/usePortalEstructuraComisiones/useProyectosTallwoodReales';
import { useMetasEscalon } from '@/hooks/usePortalEstructuraComisiones/useMetasEscalon';
import {
  useEstructuraRealRaw, comisionistasDisponibles,
} from '@/hooks/usePortalEstructuraComisiones/useEstructuraRealSimulador';
import {
  useEscenariosComision, useGuardarEscenario, useEliminarEscenario, conciliarEscenario,
  type EscenarioComision, type ConfigCanal, type EscenarioConciliado,
} from '@/hooks/usePortalEstructuraComisiones/useEscenariosComision';

/**
 * Escenarios de comisión.
 *
 * Un escenario es un conjunto de ventas de un proyecto, cada una ligada a un
 * Canal de Venta. Sobre él se concilia la comisión: total del canal − dispersado
 * externamente − total dispersado = remanente.
 *
 * El orden de las ventas importa, porque la escalera de incentivos es marginal:
 * la tercera venta de un canal cae en otro tramo que la primera.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);

export default function ScenariosTab() {
  const { channels: catalogoCanales, motorProjectId, setMotorProjectId, commissionRules, roles } = useSimulator();
  const { data: proyectosMotor = [], isLoading: cargandoProyectos } = useProyectosMotorComisiones();
  const proyectoActual = proyectosMotor.find(p => p.id === motorProjectId);

  const { data: canalesConfig } = useCanalesConfigProyecto(motorProjectId);
  const { data: metas } = useMetasEscalon(motorProjectId);
  const { data: estructuraRaw } = useEstructuraRealRaw();
  const { proyectos: proyectosSozu } = useProyectosSozuReales();
  const precioPromUnidad = proyectosSozu.find(p => p.id === motorProjectId)?.precioPromedioUnidad ?? 0;

  const { data: escenarios, isLoading } = useEscenariosComision(motorProjectId);
  const ddlPendiente = escenarios === null;
  const guardar = useGuardarEscenario(motorProjectId);
  const eliminar = useEliminarEscenario(motorProjectId);

  const [dialogo, setDialogo] = useState<{ open: boolean; escenario: EscenarioComision | null }>({
    open: false, escenario: null,
  });
  const [borrarTarget, setBorrarTarget] = useState<EscenarioComision | null>(null);

  const comisionistas = useMemo(
    () => comisionistasDisponibles(estructuraRaw, roles, motorProjectId),
    [estructuraRaw, roles, motorProjectId],
  );
  const nombrePorPersonal = useMemo(
    () => new Map(comisionistas.map(c => [c.personalId, c.nombre])),
    [comisionistas],
  );

  /**
   * Config de cada canal del catálogo: su comisión total y externa en este
   * proyecto, su escalera y sus comisionistas. Incluye canales que ya no
   * aplican, para poder conciliar escenarios guardados antes de quitarlos.
   */
  const configPorCanal = useMemo(() => {
    const resueltos = resolverCanalesDeProyecto(catalogoCanales, canalesConfig);
    const mapa = new Map<string, ConfigCanal>();
    for (const r of resueltos) {
      mapa.set(r.canal.id, {
        idCanal: r.canal.id,
        nombre: r.canal.name,
        comisionTotalPct: r.comisionTotalPct,
        comisionExternaPct: r.comisionExternaPct,
        aplica: r.aplica && r.canal.active,
        escalonesDelCanal: (metas ?? []).filter(m => m.idCanal === r.canal.id && m.idPersonal === null),
        comisionistas: commissionRules
          .filter(cr => cr.channelId === r.canal.id && cr.percentage > 0)
          .map(cr => ({
            idPersonal: cr.personalId,
            nombre: cr.personalId ? nombrePorPersonal.get(cr.personalId) ?? 'Sin comisionista' : 'Sin comisionista',
            pctBase: cr.percentage,
            escalonesPropios: (metas ?? []).filter(
              m => m.idCanal === r.canal.id && m.idPersonal === cr.personalId,
            ),
          })),
      });
    }
    return mapa;
  }, [catalogoCanales, canalesConfig, metas, commissionRules, nombrePorPersonal]);

  /** Canales que se pueden elegir al armar una venta: los vigentes del proyecto. */
  const canalesElegibles = useMemo(
    () => Array.from(configPorCanal.values()).filter(c => c.aplica),
    [configPorCanal],
  );

  const encabezado = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">Escenarios</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Modela un conjunto de ventas por canal y observa cómo se reparte la comisión: total del
          canal, dispersado externamente, dispersado entre comisionistas y remanente.
        </p>
      </div>
      <div className="flex items-center gap-2">
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
        {motorProjectId != null && (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={ddlPendiente}
            onClick={() => setDialogo({ open: true, escenario: null })}
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo Escenario
          </Button>
        )}
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
            Cada escenario analiza las ventas de un desarrollo con sus canales. Elige uno arriba.
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
              Las tablas <code>comisiones_escenarios</code> y{' '}
              <code>comisiones_escenario_ventas</code> aún no existen. Ejecuta{' '}
              <code>Ejecuciones_manuales/20260812_escenarios_de_comision.md</code>.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span>
          Un escenario es un conjunto de ventas, cada una ligada a un canal. <strong>El orden
          importa</strong>: la escalera de incentivos es marginal, así que la tercera venta de un
          canal cae en otro tramo que la primera. La comisión se recalcula al abrirlo con la
          configuración vigente, así que un escenario refleja siempre la política actual.
        </span>
      </div>

      {precioPromUnidad === 0 && (
        <p className="text-sm text-amber-600">
          {proyectoActual?.nombre ?? 'Este proyecto'} no tiene unidades disponibles, así que no hay
          precio promedio con el que calcular montos. Los porcentajes sí se calculan.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground italic">Cargando escenarios…</p>
      ) : (escenarios ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Sin escenarios en {proyectoActual?.nombre}</p>
          <p className="text-xs text-muted-foreground">
            Crea uno agregando ventas y eligiendo el canal de cada una.
          </p>
        </div>
      ) : (
        (escenarios ?? []).map(esc => (
          <TarjetaEscenario
            key={esc.id}
            escenario={esc}
            conciliacion={conciliarEscenario(esc.ventas, configPorCanal, precioPromUnidad)}
            precioPromUnidad={precioPromUnidad}
            nombreProyecto={proyectoActual?.nombre ?? ''}
            onEditar={() => setDialogo({ open: true, escenario: esc })}
            onEliminar={() => setBorrarTarget(esc)}
          />
        ))
      )}

      <EscenarioDialog
        key={dialogo.escenario?.id ?? 'nuevo'}
        open={dialogo.open}
        escenario={dialogo.escenario}
        canalesElegibles={canalesElegibles}
        onClose={() => setDialogo({ open: false, escenario: null })}
        onGuardar={(input) => guardar.mutate(input, {
          onSuccess: () => {
            toast.success(dialogo.escenario ? 'Escenario actualizado' : 'Escenario creado');
            setDialogo({ open: false, escenario: null });
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar'),
        })}
      />

      <AlertDialog open={borrarTarget !== null} onOpenChange={(o) => { if (!o) setBorrarTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar "{borrarTarget?.nombre}"</AlertDialogTitle>
            <AlertDialogDescription>
              El escenario y sus {borrarTarget?.ventas.length ?? 0} venta(s) dejarán de aparecer.
              Es una baja lógica: el análisis se conserva en la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!borrarTarget) return;
              eliminar.mutate(borrarTarget.id, {
                onSuccess: () => { toast.success('Escenario eliminado'); setBorrarTarget(null); },
                onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo eliminar'),
              });
            }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Tarjeta de un escenario: conciliación, mezcla de canales y sus ventas. */
function TarjetaEscenario({
  escenario, conciliacion, precioPromUnidad, nombreProyecto, onEditar, onEliminar,
}: {
  escenario: EscenarioComision;
  conciliacion: EscenarioConciliado;
  precioPromUnidad: number;
  nombreProyecto: string;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const [verVentas, setVerVentas] = useState(false);
  const { totales, ventas, ventasPorCanal, canalesNoVigentes, hayExcedido } = conciliacion;

  /** % promedio por venta: comparable entre escenarios de distinto tamaño. */
  const promedio = (pct: number) => (ventas.length ? pct / ventas.length : 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold flex items-center gap-2">
            {escenario.nombre}
            <Badge variant="outline" className="text-[10px]">
              {ventas.length} venta{ventas.length === 1 ? '' : 's'}
            </Badge>
          </h3>
          {escenario.descripcion && (
            <p className="text-sm text-muted-foreground">{escenario.descripcion}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ventasPorCanal.map(c => (
              <Badge key={c.idCanal} variant="secondary" className="text-[10px] font-normal">
                {c.nombre}: {c.ventas}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button title="Modificar" onClick={onEditar} className="rounded p-1.5 hover:bg-muted">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button title="Eliminar" onClick={onEliminar} className="rounded p-1.5 hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </div>

      {/* Conciliación del escenario */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Concepto
          etiqueta="Comisión total"
          pct={totales.totalPct}
          pctPromedio={promedio(totales.totalPct)}
          importe={totales.totalImporte}
          precioPromUnidad={precioPromUnidad}
        />
        <Concepto
          etiqueta="Dispersado externamente"
          pct={totales.externoPct}
          pctPromedio={promedio(totales.externoPct)}
          importe={totales.externoImporte}
          precioPromUnidad={precioPromUnidad}
        />
        <Concepto
          etiqueta="Total dispersado"
          pct={totales.dispersadoPct}
          pctPromedio={promedio(totales.dispersadoPct)}
          importe={totales.dispersadoImporte}
          precioPromUnidad={precioPromUnidad}
          tono="accent"
        />
        <Concepto
          etiqueta="Remanente de comisión"
          pct={totales.remanentePct}
          pctPromedio={promedio(totales.remanentePct)}
          importe={totales.remanenteImporte}
          precioPromUnidad={precioPromUnidad}
          tono={totales.remanentePct < -0.0001 ? 'negativo' : 'positivo'}
        />
      </div>

      {hayExcedido && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Alguna venta deja remanente negativo.</span>{' '}
            Lo dispersado supera la comisión que el canal recibe en ese cierre. Revisa la escalera en
            Incentivos o la comisión total del canal en Comisiones.
          </p>
        </div>
      )}

      {canalesNoVigentes.length > 0 && (
        <p className="mt-3 text-xs text-amber-600">
          Este escenario usa canales que ya no aplican al proyecto:{' '}
          <span className="font-medium">{canalesNoVigentes.join(', ')}</span>. Se conservan para no
          perder el análisis, pero su configuración puede haber cambiado.
        </p>
      )}

      <button
        onClick={() => setVerVentas(v => !v)}
        className="mt-3 text-xs font-medium text-primary hover:underline"
      >
        {verVentas ? 'Ocultar las ventas' : `Ver las ${ventas.length} ventas del escenario`}
      </button>

      {verVentas && (
        <div className="mt-3 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Canal</th>
                <th>
                  Venta del canal
                  <Tooltip>
                    <TooltipTrigger><Info className="ml-1 inline h-3 w-3" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Posición de esta venta dentro de su canal. Es lo que define el tramo de la
                      escalera, no la posición en el escenario.
                    </TooltipContent>
                  </Tooltip>
                </th>
                <th className="text-right">Comisión total</th>
                <th className="text-right">Externo</th>
                <th className="text-right">Dispersado</th>
                <th className="text-right">Remanente</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map(v => (
                <tr key={v.orden}>
                  <td className="font-mono text-sm">{v.orden}</td>
                  <td className="text-sm">{v.canalNombre}</td>
                  <td>
                    <span className="text-sm">#{v.ordinalEnCanal}</span>
                    {v.incrementoPct != null && (
                      <Badge className="ml-1.5 text-[10px] gap-0.5">
                        <TrendingUp className="h-2.5 w-2.5" />+{v.incrementoPct}%
                      </Badge>
                    )}
                  </td>
                  <CeldaVenta pct={v.totalPct} importe={v.totalImporte} precioPromUnidad={precioPromUnidad} />
                  <CeldaVenta pct={v.externoPct} importe={v.externoImporte} precioPromUnidad={precioPromUnidad} />
                  <CeldaVenta pct={v.dispersadoPct} importe={v.dispersadoImporte} precioPromUnidad={precioPromUnidad} tono="accent" />
                  <CeldaVenta
                    pct={v.remanentePct}
                    importe={v.remanenteImporte}
                    precioPromUnidad={precioPromUnidad}
                    tono={v.remanentePct < -0.0001 ? 'negativo' : 'positivo'}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        {precioPromUnidad > 0
          ? `Montos estimados sobre el precio promedio ponderado por unidad disponible de ${nombreProyecto}: ${fmt(precioPromUnidad)}.`
          : 'Sin precio promedio disponible no se pueden estimar montos.'}
      </p>
    </div>
  );
}

function Concepto({ etiqueta, pct, pctPromedio, importe, precioPromUnidad, tono = 'neutro' }: {
  etiqueta: string;
  pct: number;
  pctPromedio: number;
  importe: number;
  precioPromUnidad: number;
  tono?: 'neutro' | 'accent' | 'positivo' | 'negativo';
}) {
  const color =
    tono === 'negativo' ? 'text-destructive'
    : tono === 'positivo' ? 'text-emerald-600'
    : tono === 'accent' ? 'text-accent'
    : 'text-foreground';

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className={cn('text-lg font-bold font-mono mt-0.5', color)}>
        {precioPromUnidad > 0 ? fmt(importe) : '—'}
      </p>
      <p className={cn('text-xs font-mono font-semibold', color)}>
        {pctPromedio.toFixed(3)}% <span className="font-normal text-muted-foreground">por venta</span>
      </p>
      <p className="text-[11px] text-muted-foreground">{pct.toFixed(3)}% acumulado</p>
    </div>
  );
}

function CeldaVenta({ pct, importe, precioPromUnidad, tono = 'neutro' }: {
  pct: number;
  importe: number;
  precioPromUnidad: number;
  tono?: 'neutro' | 'accent' | 'positivo' | 'negativo';
}) {
  const color =
    tono === 'negativo' ? 'text-destructive'
    : tono === 'positivo' ? 'text-emerald-600'
    : tono === 'accent' ? 'text-accent'
    : 'text-foreground/70';

  return (
    <td className="text-right whitespace-nowrap">
      <div className="flex flex-col items-end">
        <span className={cn('font-mono text-sm', tono === 'negativo' && 'text-destructive font-semibold')}>
          {precioPromUnidad > 0 ? fmt(importe) : '—'}
        </span>
        <span className={cn('font-mono text-xs font-semibold', color)}>{pct.toFixed(3)}%</span>
      </div>
    </td>
  );
}

/**
 * Alta y modificación. Las ventas se arman como una lista ordenada de canales:
 * el orden es posicional y determina el tramo de la escalera.
 */
function EscenarioDialog({ open, escenario, canalesElegibles, onClose, onGuardar }: {
  open: boolean;
  escenario: EscenarioComision | null;
  canalesElegibles: ConfigCanal[];
  onClose: () => void;
  onGuardar: (input: { id?: number; nombre: string; descripcion: string | null; canalesPorVenta: string[] }) => void;
}) {
  const [nombre, setNombre] = useState(escenario?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(escenario?.descripcion ?? '');
  const [ventas, setVentas] = useState<string[]>(
    escenario ? escenario.ventas.slice().sort((a, b) => a.orden - b.orden).map(v => v.idCanal) : [],
  );
  /** Canal y cantidad para el alta rápida de varias ventas de golpe. */
  const [canalNuevo, setCanalNuevo] = useState(canalesElegibles[0]?.idCanal ?? '');
  const [cantidad, setCantidad] = useState('1');

  const nombreCanal = (id: string) =>
    canalesElegibles.find(c => c.idCanal === id)?.nombre ?? `Canal #${id}`;

  const agregar = () => {
    const n = Number(cantidad);
    if (!canalNuevo) { toast.error('Elige un canal'); return; }
    if (!Number.isInteger(n) || n <= 0 || n > 200) {
      toast.error('La cantidad debe ser un entero entre 1 y 200'); return;
    }
    setVentas(prev => [...prev, ...Array.from({ length: n }, () => canalNuevo)]);
  };

  const quitar = (indice: number) => setVentas(prev => prev.filter((_, i) => i !== indice));

  const guardar = () => {
    if (!nombre.trim()) { toast.error('El nombre del escenario es obligatorio'); return; }
    if (ventas.length === 0) { toast.error('Agrega al menos una venta'); return; }
    onGuardar({
      id: escenario?.id,
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      canalesPorVenta: ventas,
    });
  };

  /** Resumen de cuántas ventas van por canal, para revisar antes de guardar. */
  const porCanal = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const id of ventas) mapa.set(id, (mapa.get(id) ?? 0) + 1);
    return Array.from(mapa.entries()).map(([id, n]) => ({ id, nombre: nombreCanal(id), n }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventas, canalesElegibles]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{escenario ? `Modificar "${escenario.nombre}"` : 'Nuevo escenario'}</DialogTitle>
          <DialogDescription>
            Agrega las ventas del escenario indicando el canal de cada una. El orden determina el
            tramo de la escalera de incentivos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Mes fuerte con inmobiliarias" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          {canalesElegibles.length === 0 ? (
            <p className="text-sm text-amber-600">
              Este proyecto no tiene canales habilitados. Actívalos en Canales de Venta antes de
              armar un escenario.
            </p>
          ) : (
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Agregar ventas
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-48">
                  <Label className="text-xs">Canal de venta</Label>
                  <Select value={canalNuevo} onValueChange={setCanalNuevo}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Elige un canal" /></SelectTrigger>
                    <SelectContent>
                      {canalesElegibles.map(c => (
                        <SelectItem key={c.idCanal} value={c.idCanal}>
                          {c.nombre} · total {c.comisionTotalPct}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="text-xs">Ventas</Label>
                  <Input
                    type="number"
                    min="1"
                    className="h-9"
                    value={cantidad}
                    onChange={e => setCantidad(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="gap-1 h-9" onClick={agregar}>
                  <Plus className="h-3.5 w-3.5" /> Agregar
                </Button>
              </div>

              {porCanal.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {porCanal.map(c => (
                    <Badge key={c.id} variant="secondary" className="text-[10px] font-normal">
                      {c.nombre}: {c.n}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Ventas del escenario ({ventas.length})
            </p>
            {ventas.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Aún no hay ventas. Agrégalas eligiendo canal y cantidad.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
                {ventas.map((idCanal, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                    <span className="text-xs font-mono text-muted-foreground w-8">#{i + 1}</span>
                    <Select
                      value={idCanal}
                      onValueChange={(v) => setVentas(prev => prev.map((x, j) => (j === i ? v : x)))}
                    >
                      <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {canalesElegibles.map(c => (
                          <SelectItem key={c.idCanal} value={c.idCanal}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      title="Quitar esta venta"
                      onClick={() => quitar(i)}
                      className="rounded p-1 hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={!nombre.trim() || ventas.length === 0} onClick={guardar}>
              {escenario ? 'Guardar cambios' : 'Crear escenario'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
