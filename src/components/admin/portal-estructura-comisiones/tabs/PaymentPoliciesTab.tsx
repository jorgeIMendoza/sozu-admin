import { Wallet, Calendar, KeyRound, Layers, ShieldCheck, Info } from 'lucide-react';
import CommercialPoliciesPanel from '../shared/CommercialPoliciesPanel';

const policyCards = [
  {
    icon: Wallet,
    title: 'Enganche',
    desc: '% del precio cobrado al firmar. Liquidez inmediata para arranque de obra.',
    tag: 'Inicial',
  },
  {
    icon: Calendar,
    title: 'Parcialidades',
    desc: '% diferido en mensualidades durante la construcción. Facilita el cierre.',
    tag: 'Diferido',
  },
  {
    icon: KeyRound,
    title: 'Contra-entrega',
    desc: '% liquidado al entregar la unidad, normalmente vía crédito hipotecario.',
    tag: 'Final',
  },
  {
    icon: Layers,
    title: 'Mix de uso',
    desc: 'Define qué proporción del inventario usa cada esquema. Debe sumar 100%.',
    tag: 'Ponderación',
  },
];

export default function PaymentPoliciesTab() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Políticas de Pago</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
              Define los esquemas de cobro autorizados (enganche, parcialidades, contra-entrega) y
              su mix de uso. Estas políticas alimentan el flujo financiero, los KPIs de cobro y la
              meta de recaudación del proyecto.
            </p>
          </div>
        </div>
      </div>

      {/* Reference cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {policyCards.map((c) => (
          <div key={c.title} className="rounded-lg border bg-card p-4 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="rounded-md bg-secondary p-2">
                <c.icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.tag}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/5 px-4 py-3">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <div className="text-xs text-foreground leading-relaxed">
          <strong>Regla:</strong> en cada política, los porcentajes de enganche + parcialidades +
          contra-entrega deben sumar <strong>100%</strong>. El mix de uso entre políticas también
          debe sumar <strong>100%</strong> para considerarse válido y aplicar a los escenarios.
        </div>
      </div>

      {/* Editor */}
      <CommercialPoliciesPanel />
    </div>
  );
}
