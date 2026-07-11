import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Pills que marcan el alcance temporal de una sección en los dashboards de
 * cobranza (Inmuebles / Complementos).
 *  - AcumuladoTag: la sección NO depende de Año/Mes (dato acumulado a hoy).
 *  - AnioMesTag:   la sección SÍ responde al filtro Año/Mes.
 * Proyecto y Dueño aplican siempre, en todas las secciones.
 */
export function AcumuladoTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border/70 bg-muted px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-muted-foreground align-middle">
      Acumulado
    </span>
  );
}

export function AnioMesTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-primary align-middle">
      Año/Mes
    </span>
  );
}

/** Icono ℹ (ámbar suave) que abre un popover explicando el alcance de los filtros. */
export function FilterScopeInfo({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Alcance de los filtros"
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-warning/40 bg-warning/10 text-warning transition-colors hover:bg-warning/20',
            className,
          )}
        >
          <Info className="h-4 w-4" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-warning" strokeWidth={2} />
          <p className="text-[12px] font-semibold text-foreground">Alcance de los filtros</p>
        </div>
        <div className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="mt-[1px] inline-flex shrink-0 items-center rounded-full border border-border/70 bg-muted px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-foreground">
              Proyecto · Dueño
            </span>
            <span>Filtran todas las secciones y pestañas.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-[1px]"><AnioMesTag /></span>
            <span>Solo afecta la sección "Por mes" y la gráfica de tendencia.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-[1px]"><AcumuladoTag /></span>
            <span>Dato acumulado a hoy; no depende de Año/Mes.</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
