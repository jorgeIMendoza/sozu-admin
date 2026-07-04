import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// KPI card compartida por los menús espejo (Inmuebles y Complementos).
// Un solo diseño: cambias esto y afecta ambos. La info (valor/labels/colores/
// acción) llega por props.
//
// - Sin onClick → card visual (div).
// - Con onClick → card clickeable (button) con flecha (drill/navegación).
// - variant 'money' (monto en una línea, 15/17px) | 'count' (número grande 32px).

export interface StatCardProps {
  label: string;
  value: React.ReactNode;          // ya formateado (ej. formatCurrency(x)) o un número
  sublabel?: string;
  labelClass?: string;             // color del label (text-danger/success/warning/primary/muted…)
  valueClass?: string;             // color del valor
  variant?: 'money' | 'count';
  onClick?: () => void;            // si viene, la card es clickeable (link)
  arrowClass?: string;             // color del hover de la flecha
}

export function StatCard({
  label,
  value,
  sublabel,
  labelClass = 'text-muted-foreground',
  valueClass = 'text-foreground',
  variant = 'money',
  onClick,
  arrowClass = 'group-hover:text-primary',
}: StatCardProps) {
  const valueCls = cn(
    'font-bold tabular-nums leading-none mb-1.5',
    variant === 'count' ? 'text-[32px]' : 'text-[15px] sm:text-[17px] whitespace-nowrap',
    valueClass,
  );

  const body = (
    <>
      {onClick ? (
        <div className="flex items-start justify-between mb-3">
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider', labelClass)}>{label}</span>
          <ArrowRight className={cn('w-3.5 h-3.5 text-muted-foreground/25 shrink-0 transition-colors', arrowClass)} strokeWidth={1.75} />
        </div>
      ) : (
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3', labelClass)}>{label}</span>
      )}
      <p className={valueCls}>{value}</p>
      {sublabel && <p className="text-[11px] text-muted-foreground leading-snug">{sublabel}</p>}
    </>
  );

  return onClick ? (
    <button onClick={onClick} className="sozu-kpi-card overflow-hidden text-left group hover:shadow-sm transition-all duration-200">
      {body}
    </button>
  ) : (
    <div className="sozu-kpi-card overflow-hidden">{body}</div>
  );
}
