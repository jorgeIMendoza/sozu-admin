import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/components/admin/portal-cobranza/StatusBadges';

// Gráfica de líneas Cobrado vs Programado por mes — DISEÑO compartido por los
// menús espejo (Inmuebles y Complementos). La data y las líneas cambian por menú,
// el diseño (ejes, grid, tooltip, leyenda, alto, encabezado) es idéntico.

const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'] as const;
const fmtMes = (m: string) => {
  const [y, mm] = String(m).split('-');
  const i = Number(mm) - 1;
  return i >= 0 && i < 12 ? `${MONTH_ABBR[i]} ${y.slice(2)}` : String(m);
};

export interface TrendLine {
  key: string;      // dataKey en cada punto (cobrado / programado / programado_sin_ce)
  name: string;     // etiqueta de la leyenda
  color: string;    // color de la línea
  dashed?: boolean; // línea punteada (para "programado")
}

export function TrendChart({ data, lines }: {
  data: Record<string, unknown>[];
  lines: TrendLine[];
}) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.75} />
        Cobrado vs programado por mes
      </h3>
      <div className="sozu-kpi-card">
        {data.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-8 text-center">Sin datos para los filtros seleccionados.</p>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 12, right: 20, left: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="1 5" strokeLinecap="round" />
                <XAxis dataKey="month" tickFormatter={fmtMes} tick={{ fontSize: 10.5, fill: '#697280' }} axisLine={false} tickLine={false} minTickGap={16} tickMargin={10} />
                <YAxis tick={{ fontSize: 10.5, fill: '#697280' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={fmtMes} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="plainline"
                  iconSize={14}
                  formatter={(value) => <span style={{ marginRight: 16, marginLeft: 4, color: '#475569' }}>{value}</span>}
                />
                {lines.map(l => (
                  <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color}
                    strokeWidth={2} strokeDasharray={l.dashed ? '4 4' : undefined} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
