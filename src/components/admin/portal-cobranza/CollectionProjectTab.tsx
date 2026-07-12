import { Building2, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/components/admin/portal-cobranza/StatusBadges';
import { AnioMesTag } from '@/components/admin/portal-cobranza/FilterScopeHints';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Pestaña "Cobranza por Proyecto" — DISEÑO compartido (manda Inmuebles).
// Tabla + gráfica de barras. Data por props; mismo diseño en ambos menús.

export interface ProjectRow { proyecto: string; proyecto_id: number; cobrado: number; pendiente: number; vencido: number }

export function CobranzaPorProyecto({ rows, onSelectProject }: {
  rows: ProjectRow[];
  onSelectProject?: (proyectoId: number) => void;
}) {
  const sorted = [...rows].sort((a, b) => b.cobrado - a.cobrado);
  return (
    <div className="space-y-10">
      {/* Tabla por proyecto */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          Cobranza por proyecto
          <AnioMesTag />
        </h3>
        <div className="sozu-kpi-card !p-0 overflow-hidden">
          <Table className="text-sm">
            <TableHeader className="sozu-thead">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 !text-center">Proyecto</TableHead>
                <TableHead className="!text-center">Cobrado</TableHead>
                <TableHead className="!text-center">Por cobrar</TableHead>
                <TableHead className="!text-center pr-5">Vencido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length > 0 ? sorted.map(p => (
                <TableRow key={p.proyecto_id}
                  {...(onSelectProject ? { onClick: () => onSelectProject(p.proyecto_id) } : {})}
                  className={cn('h-[48px] group', onSelectProject && 'cursor-pointer')}>
                  <TableCell className={cn('pl-5 pr-4 text-center text-[13px] font-medium text-foreground transition-colors', onSelectProject && 'group-hover:text-primary')}>{p.proyecto}</TableCell>
                  <TableCell className="px-4 text-center text-[13px] text-success font-medium tabular-nums">{formatCurrency(p.cobrado)}</TableCell>
                  <TableCell className="px-4 text-center text-[13px] text-muted-foreground tabular-nums">{formatCurrency(p.pendiente)}</TableCell>
                  <TableCell className="pl-4 pr-5 text-center text-[13px] tabular-nums">
                    {p.vencido > 0
                      ? <span className="text-danger font-semibold">{formatCurrency(p.vencido)}</span>
                      : <span className="text-muted-foreground/40">-</span>}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="h-[64px] text-center text-[13px] text-muted-foreground">Sin datos de cobranza para los filtros seleccionados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Gráfica cobrado por proyecto */}
      {sorted.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.75} />
            Cobrado por proyecto <AnioMesTag />
          </h3>
          <div className="sozu-kpi-card">
            <ResponsiveContainer width="100%" height={Math.max(160, sorted.length * 44)}>
              <BarChart data={sorted} barSize={22} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="1 5" strokeLinecap="round" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#697280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                <YAxis type="category" dataKey="proyecto" tick={{ fontSize: 11, fill: '#0f1219' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="cobrado" fill="#3068db" radius={[0, 4, 4, 0]} name="Cobrado" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
