import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIERS = [
  { key: 'green', label: 'Al Corriente', range: '0 días', bg: 'bg-success-bg', text: 'text-success', border: 'border-success/30' },
  { key: 'yellow', label: 'Vencida 1', range: '1-29 días', bg: 'bg-warning-bg', text: 'text-warning', border: 'border-warning/30' },
  { key: 'red', label: 'Vencida 2', range: '30-59 días', bg: 'bg-danger-bg', text: 'text-danger', border: 'border-danger/30' },
  { key: 'red_dark', label: 'Vencida 3+', range: '60-89 días', bg: 'bg-danger-bg', text: 'text-danger', border: 'border-danger/50' },
  { key: 'purple', label: 'Prelegal', range: '90+ días', bg: 'bg-priority-purple/15', text: 'text-priority-purple', border: 'border-priority-purple/30' },
];

const SPECIALS = [
  { label: 'Conciliación', desc: 'Pago en revisión → superpone otros estatus', bg: 'bg-info-bg', text: 'text-info', border: 'border-info/30' },
  { label: 'Doc. incompleta', desc: 'Paraliza operación → máxima prioridad', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
];

export function PriorityLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
          <span className="text-[13px] font-medium text-foreground">¿Cómo se calcula la prioridad?</span>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="px-4 py-4 border-t border-border space-y-4">
          {/* Timeline tiers */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5 px-1">
              <span>Hoy (0)</span>
              <span>15 días</span>
              <span>30 días</span>
              <span>60 días</span>
              <span>90 días</span>
              <span>120 días</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {TIERS.map((t) => (
                <div key={t.key} className={cn('rounded-md border-2 p-2 text-center', t.bg, t.border)}>
                  <div className={cn('text-[11px] font-semibold leading-tight', t.text)}>{t.label}</div>
                  <div className={cn('text-[10px] mt-0.5 opacity-80', t.text)}>{t.range}</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5 italic">
              Días desde el último pago aplicado · Flujo de escalamiento automático
            </p>
          </div>

          {/* Special states */}
          <div>
            <p className="text-[11px] font-semibold text-foreground mb-1.5">Estados especiales (superponen el flujo anterior)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SPECIALS.map((s) => (
                <div key={s.label} className={cn('rounded-md border p-2', s.bg, s.border)}>
                  <div className={cn('text-[11px] font-semibold', s.text)}>{s.label}</div>
                  <div className={cn('text-[10px] mt-0.5 opacity-80', s.text)}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Calc order */}
          <div>
            <p className="text-[11px] font-semibold text-foreground mb-1.5">Lógica de cálculo (orden de prioridad)</p>
            <ol className="space-y-1 text-[11px] text-muted-foreground">
              <li className="flex gap-2"><span className="font-semibold text-foreground">1.</span> Si documentación crítica está incompleta → <span className="font-medium text-muted-foreground">DOC_INCOMPLETA</span> (paraliza todo)</li>
              <li className="flex gap-2"><span className="font-semibold text-foreground">2.</span> Si hay pago en revisión → <span className="font-medium text-info">CONCILIACIÓN</span> (superpone otros estatus)</li>
              <li className="flex gap-2"><span className="font-semibold text-foreground">3.</span> Si no, se calcula por días sin pagar (verde → amarillo → rojo → rojo oscuro → morado)</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
