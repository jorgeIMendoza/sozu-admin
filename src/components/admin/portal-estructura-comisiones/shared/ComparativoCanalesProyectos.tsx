import { useMemo, useState } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Channel } from '@/lib/portal-estructura-comisiones/types/simulator';
import {
  useCanalesDeTodosLosProyectos, compararCanalesEntreProyectos,
  type CanalComparado,
} from '@/hooks/usePortalEstructuraComisiones/useCanalesPorProyecto';

/**
 * Comparativo de la comisión de cada canal entre proyectos.
 *
 * **Forma: dumbbell, no barras agrupadas.** Cada fila es un canal en un
 * proyecto, con dos puntos —externa y total— unidos por una línea. Esa línea es
 * la comisión interna: lo que queda para repartir entre el equipo. Con barras
 * agrupadas los dos valores quedan lado a lado y la resta hay que hacerla de
 * cabeza; aquí la brecha *es* la marca, así que se lee sin calcular.
 *
 * **Paleta** validada con el script de la guía en claro y oscuro: banda de
 * luminosidad, piso de croma, separación CVD (peor par ΔE 23.7 protan) y
 * contraste contra la superficie. Los mismos dos tonos que usa Escenarios para
 * lo externo y lo dispersado, para que un color signifique lo mismo en todo el
 * portal.
 */

const COLOR_EXTERNA = '#c2761c';
const COLOR_TOTAL = '#1f86cc';

const fmtPct = (n: number) => `${n.toFixed(3)}%`;

const fechaCorta = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function ComparativoCanalesProyectos({ catalogo }: { catalogo: Channel[] }) {
  const { data: config, isLoading } = useCanalesDeTodosLosProyectos();
  const [agrupacion, setAgrupacion] = useState<'canal' | 'proyecto'>('canal');

  const filas = useMemo(
    () => compararCanalesEntreProyectos(catalogo, config),
    [catalogo, config],
  );

  /**
   * Escala común a todas las filas: comparar exige el mismo eje. Se redondea
   * hacia arriba al medio punto para que la marca más alta no toque el borde.
   */
  const maximo = useMemo(() => {
    const max = Math.max(0, ...filas.map(f => f.comisionTotalPct));
    return Math.max(0.5, Math.ceil(max * 2) / 2);
  }, [filas]);

  /** Filas agrupadas por canal o por proyecto, según lo que se quiera comparar. */
  const grupos = useMemo(() => {
    const mapa = new Map<string, CanalComparado[]>();
    for (const f of filas) {
      const clave = agrupacion === 'canal' ? f.canal : f.proyecto;
      const lista = mapa.get(clave);
      if (lista) lista.push(f);
      else mapa.set(clave, [f]);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filas, agrupacion]);

  const proyectos = useMemo(
    () => new Set(filas.map(f => f.idProyecto)).size,
    [filas],
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">Cargando comparativo…</p>
      </div>
    );
  }

  // `null` = la tabla no existe; `[]` = existe pero nadie ha guardado nada.
  if (config === null) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-2">Comparativo entre proyectos</h3>
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <p className="text-xs text-muted-foreground">
            No se pudo leer la configuración de canales por proyecto. Falta ejecutar el DDL de
            <span className="font-medium text-foreground"> comisiones_canal_config</span>.
          </p>
        </div>
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Comparativo entre proyectos</h3>
        <p className="py-6 text-center text-sm text-muted-foreground">
          Ningún proyecto tiene canales guardados todavía. Elige un proyecto arriba, ajusta sus
          canales y guarda los cambios para que aparezca aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">Comparativo entre proyectos</h3>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Comisión total y externa de cada canal, solo de los proyectos con cambios ya guardados.
            La distancia entre los dos puntos es lo que queda para el equipo interno.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5 shrink-0">
          <Button
            size="sm"
            variant={agrupacion === 'canal' ? 'default' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setAgrupacion('canal')}
          >
            Por canal
          </Button>
          <Button
            size="sm"
            variant={agrupacion === 'proyecto' ? 'default' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setAgrupacion('proyecto')}
          >
            Por proyecto
          </Button>
        </div>
      </div>

      {/* Leyenda siempre presente: la identidad no depende solo del color. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 pb-3 border-b">
        <Leyenda color={COLOR_EXTERNA} etiqueta="Comisión externa" />
        <Leyenda color={COLOR_TOTAL} etiqueta="Comisión total" />
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-0.5 w-6 rounded-full bg-muted-foreground/40 shrink-0" />
          Comisión interna (la brecha)
        </span>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {filas.length} canales · {proyectos} proyecto{proyectos === 1 ? '' : 's'} · escala 0–{maximo}%
        </span>
      </div>

      <div className="space-y-4">
        {grupos.map(([titulo, items]) => (
          <div key={titulo}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {titulo}
            </p>
            <div className="space-y-1">
              {items.map(f => (
                <FilaDumbbell
                  key={`${f.idProyecto}-${f.idCanal}`}
                  fila={f}
                  etiqueta={agrupacion === 'canal' ? f.proyecto : f.canal}
                  maximo={maximo}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground mt-4 flex items-start gap-1.5">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        Los porcentajes externos sin valor propio del proyecto heredan del catálogo maestro; se
        marcan con un punto hueco.
      </p>
    </div>
  );
}

function Leyenda({ color, etiqueta }: { color: string; etiqueta: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {etiqueta}
    </span>
  );
}

/**
 * Una fila del dumbbell. La barra de fondo es la escala; los dos puntos, los
 * valores; la línea entre ellos, la comisión interna.
 */
function FilaDumbbell({ fila, etiqueta, maximo }: {
  fila: CanalComparado;
  etiqueta: string;
  maximo: number;
}) {
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / maximo) * 100))}%`;
  const izq = Math.min(fila.comisionExternaPct, fila.comisionTotalPct);
  const der = Math.max(fila.comisionExternaPct, fila.comisionTotalPct);
  // Externa mayor que total significa que el canal ya no deja nada al equipo.
  const invertido = fila.comisionExternaPct > fila.comisionTotalPct;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-3 rounded px-1 py-1 hover:bg-muted/40 cursor-default">
          <span className="w-36 shrink-0 truncate text-xs" title={etiqueta}>{etiqueta}</span>

          <div className="relative flex-1 h-6 min-w-0">
            {/* Riel de la escala, recesivo: es contexto, no dato. */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border" />

            {/* La brecha = comisión interna. En rojo si la externa se pasó. */}
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 h-1 rounded-full',
                invertido ? 'bg-destructive/60' : 'bg-muted-foreground/40',
              )}
              style={{ left: pos(izq), width: `calc(${pos(der)} - ${pos(izq)})` }}
            />

            {/* Anillo de superficie en cada punto: al solaparse siguen distinguiéndose. */}
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
              style={{
                left: pos(fila.comisionExternaPct),
                backgroundColor: fila.externaEsPropia ? COLOR_EXTERNA : 'transparent',
                border: `2px solid ${COLOR_EXTERNA}`,
              }}
            />
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
              style={{ left: pos(fila.comisionTotalPct), backgroundColor: COLOR_TOTAL }}
            />
          </div>

          {/* Cifras al lado del gráfico: la comparación visual es aproximada,
              el número es el que se audita. */}
          <span className="w-20 shrink-0 text-right font-mono text-xs" style={{ color: COLOR_EXTERNA }}>
            {fmtPct(fila.comisionExternaPct)}
          </span>
          <span className="w-20 shrink-0 text-right font-mono text-xs font-semibold" style={{ color: COLOR_TOTAL }}>
            {fmtPct(fila.comisionTotalPct)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        <p className="font-medium">{fila.canal} · {fila.proyecto}</p>
        <p>Comisión total: {fmtPct(fila.comisionTotalPct)}</p>
        <p>
          Externa: {fmtPct(fila.comisionExternaPct)}
          {fila.externaEsPropia ? ' (propia del proyecto)' : ' (heredada del catálogo)'}
        </p>
        <p className={invertido ? 'text-destructive' : ''}>
          Interna: {fmtPct(fila.comisionInternaPct)}
          {invertido && ' — la externa supera la comisión total'}
        </p>
        {fechaCorta(fila.fechaActualizacion) && (
          <p className="text-muted-foreground mt-1">
            Guardado {fechaCorta(fila.fechaActualizacion)}
            {fila.actualizadoPor ? ` · ${fila.actualizadoPor}` : ''}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
