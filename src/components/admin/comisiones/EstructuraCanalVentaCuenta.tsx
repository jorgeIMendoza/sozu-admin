import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Info, RotateCcw, Search, Trash2, UserPlus, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  useEstructuraCanalesCuenta,
  type CanalEstructuraCuenta,
  type ComisionistaCanal,
  type EstadoCanalValidacion,
} from '@/hooks/usePortalEstructuraComisiones/useEstructuraCanalesCuenta';
import {
  useComisionistasExternosCuenta,
  useBuscarAgentesExternos,
  useAsignarComisionistaExterno,
  useEliminarComisionistaExterno,
} from '@/hooks/usePortalEstructuraComisiones/useComisionExternaCuenta';

/**
 * Estructura de Comisiones del Canal de Venta, dentro del detalle de una Cuenta
 * de Cobranza.
 *
 * Muestra, en solo lectura, los canales de venta que el Portal Estructura de
 * comisiones tiene cargados para el proyecto de la propiedad vendida y su
 * desglose: comisión total del canal, cuánto se va a la parte externa, cuánto
 * se dispersa al equipo interno y quién cobra cada punto. El valor en pesos se
 * estima sobre el **Precio Final de esta cuenta**, que es la venta concreta que
 * se está viendo.
 *
 * Solo se muestran los canales con una validación de Alta Dirección **sobre la
 * versión vigente** de la estructura. Un canal que se modificó y se reenvió a
 * validar deja de contar como validado aunque tenga una validación previa: esa
 * decisión se tomó sobre otra versión, y no se ofrece aquí hasta revalidarse.
 */

const fmtMoneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

const fmtPct = (n: number) => `${(n ?? 0).toFixed(3)}%`;

const ESTADO_CHIP: Record<EstadoCanalValidacion, { label: string; clase: string; Icono: typeof CheckCircle }> = {
  validada: {
    label: 'Validado',
    clase: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    Icono: CheckCircle,
  },
  rechazada: {
    label: 'Rechazado',
    clase: 'border-destructive/40 bg-destructive/10 text-destructive',
    Icono: XCircle,
  },
  obsoleta: {
    label: 'Requiere nueva validación',
    clase: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    Icono: RotateCcw,
  },
  pendiente: {
    label: 'Pendiente de validación',
    clase: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    Icono: Clock,
  },
};

const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

export interface EstructuraCanalVentaCuentaProps {
  /** Proyecto al que pertenece la propiedad vendida. `null` mientras carga. */
  idProyecto: number | null;
  nombreProyecto?: string | null;
  /** `cuentas_cobranza.precio_final` — base para estimar el valor de cada comisión. */
  precioFinal: number | null;
  /** Cuenta de cobranza — necesaria para asignar el agente externo del canal. */
  idCuentaCobranza?: number | null;
  /** Solo lectura: oculta la asignación/eliminación del agente externo. */
  readOnly?: boolean;
}

export default function EstructuraCanalVentaCuenta({
  idProyecto,
  nombreProyecto,
  precioFinal,
  idCuentaCobranza = null,
  readOnly = false,
}: EstructuraCanalVentaCuentaProps) {
  const { canales, validados, isLoading, schemaMissing } = useEstructuraCanalesCuenta(idProyecto);
  const [canalId, setCanalId] = useState<string | null>(null);

  // Solo los canales ya validados por Alta Dirección sobre la versión vigente.
  const visibles = validados;

  // Selección por defecto: el primer canal disponible. Se recalcula cuando
  // cambia la lista (otro proyecto, o al mostrar los pendientes) para no dejar
  // seleccionado un canal que ya no está en el selector.
  useEffect(() => {
    if (visibles.length === 0) {
      if (canalId !== null) setCanalId(null);
      return;
    }
    if (!canalId || !visibles.some(c => c.id === canalId)) {
      setCanalId(visibles[0].id);
    }
  }, [visibles, canalId]);

  const canal = visibles.find(c => c.id === canalId) ?? null;

  return (
    <Card>
      <CardHeader className="px-4 py-3 border-b border-border/40">
        <CardTitle className="text-[13px] font-semibold flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            Estructura de Comisiones por Canal de Venta
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Canales cargados en el Portal Estructura de comisiones para este proyecto. Solo se
                pueden seleccionar los que Alta Dirección validó sobre la versión vigente: si el
                canal se modificó y se reenvió a validar, deja de estar disponible hasta que se
                valide de nuevo. Es información de consulta: no modifica la comisión de esta cuenta.
              </TooltipContent>
            </Tooltip>
          </span>
          {nombreProyecto && (
            <Badge variant="outline" className="text-[11px] font-normal">{nombreProyecto}</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-3 space-y-3">
        {idProyecto == null ? (
          <p className="text-[12px] text-muted-foreground py-4 text-center">
            No se pudo determinar el proyecto de la propiedad, así que no hay canales que mostrar.
          </p>
        ) : isLoading ? (
          <p className="text-[12px] text-muted-foreground py-4 text-center">Cargando canales del proyecto…</p>
        ) : schemaMissing ? (
          <p className="text-[12px] text-amber-600 py-4 text-center">
            El catálogo de Canales de Venta aún no existe en esta base de datos.
          </p>
        ) : canales.length === 0 ? (
          <p className="text-[12px] text-muted-foreground py-4 text-center">
            {nombreProyecto ?? 'Este proyecto'} no tiene canales de venta configurados en el Portal
            Estructura de comisiones.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1.5 min-w-[240px]">
                <Label className="text-[12px] font-medium text-muted-foreground">Canal de Venta</Label>
                <Select
                  value={canalId ?? undefined}
                  onValueChange={setCanalId}
                  disabled={visibles.length === 0}
                >
                  <SelectTrigger className="h-9 w-full sm:w-80 text-[13px]">
                    <SelectValue placeholder="Selecciona un canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibles.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-[13px]">
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {visibles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center space-y-1">
                <p className="text-[13px] font-medium">Ningún canal con validación vigente</p>
                <p className="text-[12px] text-muted-foreground">
                  Los {canales.length} canal{canales.length === 1 ? '' : 'es'} de{' '}
                  {nombreProyecto ?? 'este proyecto'} están capturados, pero ninguno tiene una
                  validación de Alta Dirección sobre la versión actual de la estructura. Se
                  mostrarán aquí en cuanto Alta Dirección los valide.
                </p>
              </div>
            ) : canal ? (
              <DetalleCanal
                canal={canal}
                precioFinal={precioFinal}
                idCuentaCobranza={idCuentaCobranza}
                readOnly={readOnly}
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Desglose completo del canal seleccionado. */
function DetalleCanal({ canal, precioFinal, idCuentaCobranza, readOnly }: {
  canal: CanalEstructuraCuenta;
  precioFinal: number | null;
  idCuentaCobranza: number | null;
  readOnly?: boolean;
}) {
  const base = precioFinal && precioFinal > 0 ? precioFinal : 0;
  const chip = ESTADO_CHIP[canal.validacion.estado];

  const cuadra = Math.abs(canal.remanentePct) < 0.0005;
  const colorRemanente = cuadra
    ? 'text-emerald-600'
    : canal.remanentePct > 0
      ? 'text-amber-600'
      : 'text-destructive';

  return (
    <div className="space-y-3">
      {/* Estado de la estructura: sin esto, un canal capturado a medias se lee
          igual que uno autorizado. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium',
          chip.clase,
        )}>
          <chip.Icono className="size-3.5 shrink-0" />
          {chip.label}
        </span>
        {/* El autor solo acompaña a una decisión que sigue en pie. En una
            obsoleta se explica aparte, porque ahí el dato relevante es que ya
            no aplica, no quién la firmó. */}
        {(canal.validacion.estado === 'validada' || canal.validacion.estado === 'rechazada') && (
          <span className="text-[11px] text-muted-foreground">
            {canal.validacion.validadoPor ?? 'Sin autor registrado'}
            {canal.validacion.fecha && ` · ${fmtFecha(canal.validacion.fecha)}`}
          </span>
        )}
        {canal.categoria && (
          <Badge variant="outline" className="text-[10px] font-normal">{canal.categoria}</Badge>
        )}
        {canal.externaEsPropia && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] font-normal">% externo propio</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Este proyecto define su propia comisión externa para el canal, en lugar de heredar la
              del catálogo maestro.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Una validación que caducó por un reenvío es la que más fácil se lee
          mal: el canal se validó de verdad, pero sobre otra versión. */}
      {canal.validacion.estado === 'obsoleta' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <RotateCcw className="size-3.5 mt-0.5 shrink-0 text-amber-600" />
          <p className="text-[12px] text-amber-700 dark:text-amber-400">
            La estructura de este canal se modificó y se envió de nuevo a validar
            {canal.validacion.reenviadaEl && ` el ${fmtFecha(canal.validacion.reenviadaEl)}`}.
            {canal.validacion.estadoPrevio === 'validada' ? ' La validación anterior' : ' El rechazo anterior'}
            {canal.validacion.validadoPor && ` de ${canal.validacion.validadoPor}`}
            {canal.validacion.fecha && ` (${fmtFecha(canal.validacion.fecha)})`}
            {' '}ya no aplica: el canal no se puede tomar como validado hasta que Alta Dirección
            valide la nueva versión.
          </p>
        </div>
      )}

      {canal.totalSinDefinir && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-amber-600" />
          <p className="text-[12px] text-amber-700 dark:text-amber-400">
            La comisión total de este canal no está capturada para el proyecto, así que el reparto
            no se puede contrastar contra nada.
          </p>
        </div>
      )}

      {/* Desglose de la comisión del canal. Cada cifra en % y en pesos: el %
          es lo que se pactó y el monto es lo que significa en esta venta. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Cifra etiqueta="Comisión total" pct={canal.comisionTotalPct} base={base} />
        <Cifra etiqueta="Externa" pct={canal.comisionExternaPct} base={base} />
        <Cifra
          etiqueta="Interna esperada"
          pct={canal.comisionInternaPct}
          base={base}
          ayuda="Comisión total del canal menos la parte externa: lo que queda para repartir entre el equipo interno."
        />
        <Cifra etiqueta="Dispersada" pct={canal.dispersadaPct} base={base} />
        <Cifra
          etiqueta="Remanente"
          pct={canal.remanentePct}
          base={base}
          color={colorRemanente}
          destacado
          ayuda="Comisión interna aún sin asignar a ningún comisionista. Negativo significa que el reparto excede lo disponible."
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        {base > 0
          ? <>Valores estimados sobre el Precio Final de esta cuenta: <span className="font-medium tabular-nums">{fmtMoneda(base)}</span>. Sin IVA.</>
          : 'Esta cuenta no tiene Precio Final capturado, así que solo se muestran los porcentajes.'}
      </p>

      {/* Comisión externa: cuando el canal la tiene, se puede asignar al Agente
          externo o Inmobiliaria que la asume (guardado en `comisionistas`). */}
      {canal.comisionExternaPct > 0 && idCuentaCobranza != null && (
        <ExternaAsignacion
          idCuentaCobranza={idCuentaCobranza}
          comisionExternaPct={canal.comisionExternaPct}
          base={base}
          readOnly={readOnly}
        />
      )}

      <GrupoComisionistas
        titulo="Empleados SOZU"
        descripcion="Personal directo de la organización."
        filas={canal.empleadosSozu}
        base={base}
      />
      <GrupoComisionistas
        titulo="Colaboradores Investimento"
        descripcion="Su sueldo lo paga Investimento; la comisión les llega como bono por el soporte que dan."
        filas={canal.colaboradoresInvestimento}
        base={base}
      />
      {canal.sinComisionista.length > 0 && (
        <GrupoComisionistas
          titulo="Sin comisionista asignado"
          descripcion="Reglas heredadas del modelo por rol: suman a la dispersión pero no tienen persona."
          filas={canal.sinComisionista}
          base={base}
          alerta
        />
      )}
    </div>
  );
}

function Cifra({ etiqueta, pct, base, color, destacado, ayuda }: {
  etiqueta: string;
  pct: number;
  base: number;
  color?: string;
  destacado?: boolean;
  ayuda?: string;
}) {
  return (
    <div className={cn(
      'rounded-md border px-2.5 py-2',
      destacado ? 'border-primary/30 bg-background' : 'border-border/60 bg-muted/30',
    )}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {etiqueta}
        {ayuda && (
          <Tooltip>
            <TooltipTrigger asChild><Info className="size-3 opacity-60" /></TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{ayuda}</TooltipContent>
          </Tooltip>
        )}
      </p>
      <p className={cn('text-[13px] font-bold tabular-nums mt-0.5', color ?? 'text-foreground')}>
        {fmtPct(pct)}
      </p>
      <p className="text-[11px] text-muted-foreground tabular-nums">
        {base > 0 ? fmtMoneda((pct / 100) * base) : '—'}
      </p>
    </div>
  );
}

/**
 * Un bloque de comisionistas del mismo tipo de personal, con su subtotal.
 *
 * El subtotal por grupo es el dato que no se puede leer de la tabla general:
 * cuánto del canal se va a empleados directos y cuánto a Investimento.
 */
function GrupoComisionistas({ titulo, descripcion, filas, base, alerta }: {
  titulo: string;
  descripcion: string;
  filas: ComisionistaCanal[];
  base: number;
  alerta?: boolean;
}) {
  const subtotalPct = filas.reduce((s, f) => s + f.porcentaje, 0);

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className={cn(
        'flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border/40',
        alerta ? 'bg-amber-500/10' : 'bg-muted/40',
      )}>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground shrink-0" />
            {titulo}
            <Badge variant="outline" className="text-[10px] font-normal">
              {filas.length}
            </Badge>
          </p>
          <p className="text-[11px] text-muted-foreground">{descripcion}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] font-semibold tabular-nums">{fmtPct(subtotalPct)}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {base > 0 ? fmtMoneda((subtotalPct / 100) * base) : '—'}
          </p>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">
          Sin comisionistas de este tipo en el canal.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="text-[11px] font-semibold">Comisionista</TableHead>
              <TableHead className="text-[11px] font-semibold">Rol</TableHead>
              <TableHead className="text-[11px] font-semibold">Perfil</TableHead>
              <TableHead className="text-[11px] font-semibold text-right">% s/ venta</TableHead>
              <TableHead className="text-[11px] font-semibold text-right">Valor estimado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f, i) => (
              <TableRow key={`${f.idPersonal ?? 'sin'}-${f.rol}-${i}`}>
                <TableCell className="text-[12px] font-medium">{f.nombre}</TableCell>
                <TableCell className="text-[12px] text-muted-foreground">{f.rol}</TableCell>
                <TableCell className="text-[12px]">
                  {f.tipoPersonal ? (
                    <span className={cn(
                      'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                      f.tipoPersonal === 'empleado_sozu'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
                    )}>
                      {f.tipoPersonal === 'empleado_sozu' ? 'Empleado SOZU' : 'Colaborador Investimento'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{f.pool === 'sozu' ? 'SOZU' : 'Proyecto'}</span>
                  )}
                </TableCell>
                <TableCell className="text-[12px] text-right tabular-nums">{fmtPct(f.porcentaje)}</TableCell>
                <TableCell className="text-[12px] text-right tabular-nums">
                  {base > 0 ? fmtMoneda((f.porcentaje / 100) * base) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/**
 * Asignación del Agente externo / Inmobiliaria que asume la comisión externa del
 * canal en esta venta. Persiste en `comisionistas` (misma tabla que la sección
 * "Comisionistas" del diálogo, con la que queda sincronizada). El % se fija al
 * externo del canal.
 */
function ExternaAsignacion({ idCuentaCobranza, comisionExternaPct, base, readOnly }: {
  idCuentaCobranza: number;
  comisionExternaPct: number;
  base: number;
  readOnly?: boolean;
}) {
  const { data: asignados = [], isLoading } = useComisionistasExternosCuenta(idCuentaCobranza);
  const [search, setSearch] = useState('');
  const { data: resultados = [], isFetching } = useBuscarAgentesExternos(search);
  const asignar = useAsignarComisionistaExterno(idCuentaCobranza);
  const eliminar = useEliminarComisionistaExterno(idCuentaCobranza);

  const emailsAsignados = new Set(asignados.map(a => a.email));
  const resultadosFiltrados = resultados.filter(r => !emailsAsignados.has(r.email));
  const montoExterno = base > 0 ? (comisionExternaPct / 100) * base : 0;

  const handleAsignar = (email: string) => {
    asignar.mutate(
      { email, porcentaje: comisionExternaPct },
      {
        onSuccess: () => { setSearch(''); toast.success('Agente externo asignado a la comisión del canal'); },
        onError: (e: any) => toast.error(e?.message || 'No se pudo asignar el agente externo'),
      },
    );
  };

  return (
    <div className="rounded-lg border border-emerald-500/30 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-emerald-500/20 bg-emerald-500/10">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold flex items-center gap-1.5">
            <UserPlus className="size-3.5 text-emerald-600 shrink-0" />
            Comisión externa — Agente / Inmobiliaria
          </p>
          <p className="text-[11px] text-muted-foreground">
            Quien asuma el rol externo del canal cobra esta comisión sobre la venta.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{fmtPct(comisionExternaPct)}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">{base > 0 ? fmtMoneda(montoExterno) : '—'}</p>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {isLoading ? (
          <p className="text-[12px] text-muted-foreground">Cargando asignación…</p>
        ) : asignados.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            Sin agente externo asignado{readOnly ? '.' : '. Búscalo abajo para que asuma el rol y la comisión.'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {asignados.map(a => (
              <li key={a.email} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium flex flex-wrap items-center gap-1.5">
                    {a.nombre}
                    {a.esInmobiliaria && <Badge variant="secondary" className="text-[10px]">Inmobiliaria</Badge>}
                    {a.pagada
                      ? <Badge variant="default" className="text-[10px]">Pagada</Badge>
                      : a.aprobada
                        ? <Badge variant="secondary" className="text-[10px]">Aprobada</Badge>
                        : <Badge variant="outline" className="text-[10px]">Pendiente</Badge>}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-[12px] font-semibold tabular-nums">{fmtPct(a.porcentaje)}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{base > 0 ? fmtMoneda((a.porcentaje / 100) * base) : '—'}</p>
                  </div>
                  {!readOnly && !a.pagada && !a.aprobada && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => eliminar.mutate(a.email)}
                      disabled={eliminar.isPending}
                      aria-label={`Quitar ${a.nombre}`}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar Agente externo o Inmobiliaria…"
                className="h-8 pl-8 text-[13px]"
              />
            </div>
            {search.trim().length >= 2 && (
              <div className="rounded-md border border-border/60 bg-background max-h-52 overflow-y-auto">
                {isFetching ? (
                  <p className="px-3 py-2 text-[12px] text-muted-foreground">Buscando…</p>
                ) : resultadosFiltrados.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-muted-foreground">
                    Sin coincidencias de agentes externos o inmobiliarias.
                  </p>
                ) : (
                  resultadosFiltrados.map(r => (
                    <button
                      key={r.email}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted/60 disabled:opacity-60"
                      disabled={asignar.isPending}
                      onClick={() => handleAsignar(r.email)}
                    >
                      <span className="min-w-0">
                        <span className="text-[12px] font-medium flex items-center gap-1.5">
                          {r.nombre}
                          {r.esInmobiliaria && <Badge variant="secondary" className="text-[10px]">Inmobiliaria</Badge>}
                        </span>
                        <span className="block text-[11px] text-muted-foreground truncate">{r.email}</span>
                      </span>
                      <span className="text-[11px] font-medium text-emerald-600 shrink-0">Asignar {fmtPct(comisionExternaPct)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <p className="text-[10.5px] text-muted-foreground">
              El % se fija al externo del canal ({fmtPct(comisionExternaPct)}). Se guarda en los Comisionistas de esta cuenta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
