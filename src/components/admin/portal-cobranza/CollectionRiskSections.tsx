import { Shield, AlertTriangle, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/components/admin/portal-cobranza/StatusBadges';
import { cn } from '@/lib/utils';

// Secciones compartidas de la pestaña "Riesgo y Cartera" (Inmuebles y Complementos).
// Mismo diseño; la data/labels/acciones llegan por props. Editas aquí → ambos.

const AGING_COLOR = '#e04444';

// ─── Nivel de morosidad (3 cards) ───
export interface MorosidadItem {
  label: string;            // "Alerta temprana" / "Riesgo activo" / "Crítico"
  labelClass: string;       // text-warning / text-danger
  count: number;
  valueClass: string;       // color del número cuando count > 0
  title: string;            // "1 parcialidad vencida" / "1 cargo vencido"
  desc: string;             // descripción
  onClick?: () => void;
  arrowClass?: string;
}

export function NivelMorosidad({ items }: { items: MorosidadItem[] }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5" strokeWidth={1.75} />Nivel de morosidad
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((it, i) => {
          const inner = (
            <>
              {it.onClick ? (
                <div className="flex items-start justify-between mb-3">
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wider', it.labelClass)}>{it.label}</span>
                  <ArrowRight className={cn('w-3.5 h-3.5 text-muted-foreground/25 transition-colors shrink-0', it.arrowClass)} strokeWidth={1.75} />
                </div>
              ) : (
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3', it.labelClass)}>{it.label}</span>
              )}
              <p className={cn('text-[32px] font-bold tabular-nums leading-none mb-1.5', it.count > 0 ? it.valueClass : 'text-foreground')}>{it.count}</p>
              <p className="text-[13px] font-medium text-foreground mb-0.5">{it.title}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{it.desc}</p>
            </>
          );
          return it.onClick
            ? <button key={i} onClick={it.onClick} className="sozu-kpi-card text-left group hover:shadow-sm transition-all duration-200">{inner}</button>
            : <div key={i} className="sozu-kpi-card">{inner}</div>;
        })}
      </div>
    </section>
  );
}

// ─── Antigüedad de cartera + Riesgo por proyecto (grid 2col) ───
export interface RiskProjectRow { proyecto: string; proyecto_id: number; cobrado: number; pendiente: number; vencido: number }

export function AgingYRiesgo({ aging, projectRows, onSelectProject }: {
  aging?: { range: string; amount: number }[] | null;
  projectRows: RiskProjectRow[];
  onSelectProject?: (proyectoId: number) => void;
}) {
  const top = [...projectRows].filter(p => p.vencido > 0).sort((a, b) => b.vencido - a.vencido).slice(0, 3);
  return (
    <section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {aging && aging.length > 0 && (
          <div className="sozu-kpi-card">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Antigüedad de cartera</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={aging} barSize={32}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="1 5" strokeLinecap="round" />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="amount" fill={AGING_COLOR} radius={[4, 4, 0, 0]} name="Vencido" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="sozu-kpi-card">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Riesgo por proyecto</h3>
          {top.length > 0 ? (
            <div className="space-y-1">
              {top.map((p, i) => {
                const total = (p.cobrado ?? 0) + (p.pendiente ?? 0);
                const pct = total > 0 ? Math.round((p.vencido / total) * 100) : 0;
                const RowTag = onSelectProject ? 'button' : 'div';
                return (
                  <RowTag key={p.proyecto_id}
                    {...(onSelectProject ? { onClick: () => onSelectProject(p.proyecto_id) } : {})}
                    className={cn('w-full px-3 py-3 rounded-lg text-left group', onSelectProject && 'hover:bg-muted/50 transition-colors')}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-[18px] h-[18px] rounded-full bg-danger/10 text-danger text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-[13px] font-semibold text-foreground truncate">{p.proyecto}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[13px] font-bold text-danger tabular-nums whitespace-nowrap">{formatCurrency(p.vencido)}</span>
                        {onSelectProject && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-danger transition-colors shrink-0" strokeWidth={1.75} />}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-[5px] bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-danger transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums font-semibold text-danger/70 shrink-0 w-[52px] text-right">{pct}% venc.</span>
                    </div>
                  </RowTag>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground text-center py-6">Sin riesgo por proyecto para los filtros seleccionados.</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Clientes/Cuentas críticas (3 cards) ───
export interface CriticoCard {
  cuentaId: number;
  monto: number;
  cliente: string | null;
  proyecto: string | null;
  unidad: string | null;
  badgeLabel: string;       // tipo/categoría
  badgeClass: string;
  parcLabel: string;        // "3 parc." / "3 venc."
}

export function ClientesCriticos({ title, badgeSuffix, count, accounts, onSelect, onSeeAll }: {
  title: string;            // "Clientes críticos" / "Cuentas críticas"
  badgeSuffix: string;      // "3+ parc." / "3+ cargos"
  count: number;
  accounts: CriticoCard[];
  onSelect?: (card: CriticoCard) => void;
  onSeeAll?: () => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />{title}
        </h3>
        <div className="flex items-center gap-3">
          {count > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20 tabular-nums">
              {count} cuenta{count !== 1 ? 's' : ''} · {badgeSuffix}
            </span>
          )}
          {onSeeAll && (
            <button onClick={onSeeAll} className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium whitespace-nowrap">
              Ver todas <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {accounts.length === 0 ? (
        <div className="sozu-kpi-card flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
          <span className="text-[13px] text-muted-foreground">Sin cuentas críticas para los filtros seleccionados.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {accounts.map(c => {
            const CardTag = onSelect ? 'button' : 'div';
            return (
              <CardTag key={c.cuentaId}
                {...(onSelect ? { onClick: () => onSelect(c) } : {})}
                className={cn('sozu-kpi-card text-left group', onSelect && 'hover:shadow-sm transition-all duration-200')}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">Crítico</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground/60">CC-{String(c.cuentaId).padStart(6, '0')}</span>
                    {onSelect && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-danger shrink-0 transition-colors" strokeWidth={1.75} />}
                  </div>
                </div>
                <p className="text-[20px] font-bold tabular-nums leading-none mb-2 text-danger whitespace-nowrap">{formatCurrency(c.monto)}</p>
                <p className={cn('text-[13px] font-semibold text-foreground mb-0.5 truncate', !c.cliente && 'italic text-muted-foreground/60 font-normal')}>{c.cliente ?? 'Sin registro'}</p>
                <p className="text-[11px] text-muted-foreground mb-3 truncate">{c.proyecto ?? '—'}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', c.badgeClass)}>{c.badgeLabel}</span>
                  {c.unidad && <span className="text-[10px] text-muted-foreground">Unidad {c.unidad}</span>}
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-danger/10 text-danger tabular-nums">{c.parcLabel}</span>
                </div>
              </CardTag>
            );
          })}
        </div>
      )}
    </section>
  );
}
