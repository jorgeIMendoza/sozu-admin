import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import { mockRequests, STATUS_CONFIG } from '@/data/legalFlow/mockData';

const NEXT_ACTION: Record<string, string> = {
  request_received: 'Revisar',
  missing_information: 'Completar',
  in_legal_review: 'Aprobar',
  approved_for_generation: 'Generar',
  in_validation: 'Firma titular',
  in_signature_process: 'Firmar',
  partially_signed: 'Firmar',
  fully_signed: 'Archivar',
};

export default function ActivityFeed() {
  const recent = [...mockRequests]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <div className="panel-header">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" strokeWidth={1.75} />
          Actividad reciente
        </h2>
      </div>
      <div className="divide-y divide-border/50">
        {recent.map((r) => {
          const action = NEXT_ACTION[r.status];
          return (
            <Link key={r.id} to={`/admin/legal-flow/cases/${r.id}`} className="flex items-center justify-between px-5 py-3.5 table-row-hover group cursor-pointer">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate group-hover:text-primary transition-colors">{r.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono text-muted-foreground/50">{r.id}</span>
                  <span className={`status-badge ${STATUS_CONFIG[r.status].style}`}>
                    {STATUS_CONFIG[r.status].label}
                  </span>
                  {r.assignedTo && (
                    <span className="text-[11px] text-muted-foreground/50">· {r.assignedTo}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className="text-[11px] text-muted-foreground/60">
                  {new Date(r.updatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </span>
                {action && (
                  <span className="text-[11px] font-semibold text-primary bg-primary/8 px-2.5 py-1 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors whitespace-nowrap inline-flex items-center gap-1">
                    {action} <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
