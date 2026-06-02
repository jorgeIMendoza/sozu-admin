import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { CaseStatus } from '@/types/legal-flow';

const COLORS = ['hsl(145, 35%, 51%)', 'hsl(217, 91%, 60%)', 'hsl(38, 92%, 50%)', 'hsl(258, 56%, 52%)', 'hsl(220, 9%, 60%)'];

const data: { name: string; value: number; color: string; status: CaseStatus }[] = [
  { name: 'En revisión', value: 12, color: COLORS[1], status: 'En revisión legal' },
  { name: 'En firma', value: 8, color: COLORS[3], status: 'En firma' },
  { name: 'Completados', value: 23, color: COLORS[0], status: 'Firmado' },
  { name: 'Pendientes', value: 4, color: COLORS[4], status: 'Solicitud recibida' },
];

interface Props {
  onStatusClick?: (status: CaseStatus) => void;
}

export default function StatusDistribution({ onStatusClick }: Props) {
  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <div className="panel-header">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Distribución por estatus
        </h2>
      </div>
      <div className="p-5 flex items-center gap-6">
        <div className="w-[96px] h-[96px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2} dataKey="value" strokeWidth={0}>
                {data.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2.5 flex-1">
          {data.map((s) => (
            <button
              key={s.name}
              onClick={() => onStatusClick?.(s.status)}
              className="flex items-center gap-2.5 text-[13px] w-full hover:bg-accent -mx-1 px-1 py-1 rounded-lg transition-colors cursor-pointer group"
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-muted-foreground flex-1 text-left group-hover:text-foreground transition-colors">{s.name}</span>
              <span className="font-semibold tabular-nums text-foreground">{s.value}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
