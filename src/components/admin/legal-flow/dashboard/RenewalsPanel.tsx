import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { mockRequests, STATUS_CONFIG } from '@/data/mockData';

const formatDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

const RENEWAL_ACTION: Record<string, string> = {
  renewal: 'Iniciar renovación',
  in_signature_process: 'Seguimiento de firma',
  in_legal_review: 'Revisar expediente',
  in_validation: 'Enviar a firma del titular',
  request_received: 'Revisar solicitud',
  missing_information: 'Completar información',
  approved_for_generation: 'Generar documento',
};

export default function RenewalsPanel() {
  const upcoming = mockRequests
    .filter(r => !['fully_signed', 'cancelled', 'rejected', 'archived'].includes(r.status))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <div className="panel-header">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
          Próximos vencimientos
        </h2>
      </div>
      <div className="divide-y divide-border/50">
        {upcoming.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No hay vencimientos próximos para este filtro</p>
          </div>
        ) : (
          upcoming.map((r) => {
            const days = daysUntil(r.dueDate);
            const isOverdue = days < 0;
            const isUrgent = days >= 0 && days <= 7;
            const action = RENEWAL_ACTION[r.type] || RENEWAL_ACTION[r.status] || 'Ver detalle';
            return (
              <Link
                key={r.id}
                to={`/cases/${r.id}`}
                className="flex items-center justify-between px-5 py-3.5 table-row-hover group cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate group-hover:text-primary transition-colors">{r.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-muted-foreground/60">{r.company}</span>
                    <span className={`status-badge ${STATUS_CONFIG[r.status].style}`}>
                      {STATUS_CONFIG[r.status].label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <div className="text-right">
                    <span className={`text-[12px] font-mono tabular-nums font-semibold ${isOverdue ? 'text-destructive' : isUrgent ? 'text-[hsl(var(--status-warning))]' : 'text-muted-foreground'}`}>
                      {isOverdue ? `Vencido hace ${Math.abs(days)}d` : days === 0 ? 'Hoy' : `${days}d restantes`}
                    </span>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{formatDate(r.dueDate)}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-primary bg-primary/8 px-2.5 py-1 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors whitespace-nowrap inline-flex items-center gap-1">
                    {action} <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
