import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Pills que marcan el alcance temporal de una sección en los dashboards de
 * cobranza (Inmuebles / Complementos).
 *  - AcumuladoTag: la sección NO depende de Año/Mes (dato acumulado a hoy).
 *  - AnioMesTag:   la sección SÍ responde al filtro Año/Mes.
 * Proyecto y Dueño aplican siempre, en todas las secciones.
 */
export function AcumuladoTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-border/70 bg-muted px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-muted-foreground align-middle">
      Acumulado
    </span>
  );
}

export function AnioMesTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-primary align-middle">
      Año/Mes
    </span>
  );
}

/** Icono ℹ que abre un popover explicando el alcance de los filtros. */
export function FilterScopeInfo({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Alcance de los filtros"
          className={
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-primary ' +
            (className ?? '')
          }
        >
          <Info className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-[12px] leading-relaxed">
        <p className="mb-2 font-semibold text-foreground">Alcance de los filtros</p>
        <ul className="space-y-1.5 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Proyecto y Dueño:</span> filtran
            todas las secciones y pestañas.
          </li>
          <li>
            <AnioMesTag /> el filtro Año/Mes solo afecta la sección "Por mes" y la gráfica de tendencia.
          </li>
          <li>
            <AcumuladoTag /> secciones acumuladas a hoy; no dependen de Año/Mes.
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
