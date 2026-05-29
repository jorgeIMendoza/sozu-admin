import { motion } from 'framer-motion';
import {
  Briefcase, Clock, PenTool, CheckCircle2, AlertTriangle, FileSearch, ArrowRight,
} from 'lucide-react';
import { mockMetrics } from '@/data/legalFlow/mockData';

const fade = (i: number) => ({
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
});

interface KpiCardsProps {
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

const kpis = [
  { key: 'active', label: 'Expedientes activos', value: mockMetrics.totalActive, delta: '+3 vs mes anterior', deltaUp: true, icon: Briefcase, cta: 'Ver expedientes' },
  { key: 'review', label: 'Pendientes de revisión', value: mockMetrics.pendingReview, delta: '-2 esta semana', deltaUp: false, icon: Clock, cta: 'Ver pendientes' },
  { key: 'validation', label: 'En validación', value: 6, icon: FileSearch, cta: 'Ver validaciones' },
  { key: 'signature', label: 'En firma', value: mockMetrics.inSignature, icon: PenTool, cta: 'Ver firmas' },
  { key: 'completed', label: 'Firmados este mes', value: mockMetrics.completedThisMonth, icon: CheckCircle2, cta: 'Ver completados' },
  { key: 'urgent', label: 'Urgentes', value: mockMetrics.urgentCases, icon: AlertTriangle, cta: 'Ver urgentes' },
];

export default function KpiCards({ activeFilter, onFilterChange }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi, i) => {
        const isActive = activeFilter === kpi.key;
        return (
          <motion.button
            key={kpi.key}
            onClick={() => onFilterChange(isActive ? null : kpi.key)}
            className={`kpi-card group text-left relative cursor-pointer ${isActive ? 'ring-2 ring-primary ring-offset-1' : ''}`}
            initial="hidden"
            animate="visible"
            variants={fade(i)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/8 text-primary transition-transform group-hover:scale-105">
                <kpi.icon className="h-[20px] w-[20px]" strokeWidth={1.75} />
              </div>
              {isActive && (
                <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Activo</span>
              )}
            </div>
            <p className="text-[28px] font-bold tabular-nums leading-none tracking-tight">{kpi.value}</p>
            <p className="text-[12px] text-muted-foreground mt-1.5 font-medium">{kpi.label}</p>
            {kpi.delta && (
              <p className={`text-[11px] mt-1 font-medium ${kpi.deltaUp ? 'text-primary' : 'text-muted-foreground'}`}>
                {kpi.delta}
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-border/40">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary group-hover:text-primary/80 transition-colors">
                {kpi.cta} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
