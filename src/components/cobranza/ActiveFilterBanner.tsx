import { X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

/**
 * Shows a subtle banner when filters were applied via navigation (e.g. from dashboard drill-down).
 * Provides a clear "Limpiar filtros" action.
 */
export function ActiveFilterBanner({ onClear }: { onClear: () => void }) {
  const [searchParams] = useSearchParams();
  const source = searchParams.get('from');

  if (!source) return null;

  const sourceLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    'control-tower': 'Control Tower',
    riesgo: 'Riesgo y Cartera',
    cobranza: 'Cobranza por Proyecto',
    operacion: 'Operación y SLA',
    flujo: 'Flujo y Obra',
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/15 text-[12px]">
      <span className="text-primary font-medium">
        Filtro aplicado desde {sourceLabels[source] || source}
      </span>
      <button
        onClick={onClear}
        className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3 h-3" strokeWidth={2} />
        Limpiar filtros
      </button>
    </div>
  );
}
