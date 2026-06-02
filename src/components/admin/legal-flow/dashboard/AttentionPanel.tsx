import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { mockRequests, STATUS_CONFIG } from '@/data/legalFlow/mockData';

const ATTENTION_REASONS: Record<string, string> = {
  'Información faltante': 'Información incompleta',
  'En revisión legal': 'Revisión pendiente',
  'Firma titular': 'Firma titular pendiente',
  'En firma': 'Firma en proceso',
  'Parcialmente firmado': 'Firma parcial',
};

const NEXT_ACTION: Record<string, string> = {
  'Solicitud recibida': 'Revisar solicitud',
  'Información faltante': 'Completar información',
  'En revisión legal': 'Aprobar generación',
  'Aprobado': 'Generar documento',
  'Firma titular': 'Enviar a firma del titular',
  'En firma': 'Seguimiento de firma',
  'Parcialmente firmado': 'Seguimiento de firma',
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

export default function AttentionPanel() {
  const cases = mockRequests.filter(
    (r) => r.priority === 'Alto' && !['Firmado', 'Cancelado', 'Archivado', 'Rechazado'].includes(r.status)
  );

  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
    >
      <div className="panel-header">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-warning))]" />
          Requieren atención hoy
        </h2>
        <Link to="/admin/legal-flow/requests" className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors">
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {cases.length === 0 ? (
        <div className="panel-body text-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/8 mx-auto mb-3">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">No hay expedientes con retraso</p>
          <p className="text-[13px] text-muted-foreground mt-1">Todos los expedientes prioritarios están al día.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b">
                <th className="table-head">Expediente</th>
                <th className="table-head">Etapa actual</th>
                <th className="table-head">Problema / Bloqueo</th>
                <th className="table-head w-[100px]">Fecha límite</th>
                <th className="table-head">Responsable</th>
                <th className="table-head">Próxima acción</th>
              </tr>
            </thead>
            <tbody>
              {cases.slice(0, 6).map((r) => (
                <tr key={r.id} className="border-t border-border/50 table-row-hover group">
                  <td className="table-cell">
                    <Link to={`/admin/legal-flow/cases/${r.id}`} className="font-medium text-[13px] text-foreground hover:text-primary transition-colors cursor-pointer">
                      {r.title}
                    </Link>
                    <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">{r.id}</p>
                  </td>
                  <td className="table-cell">
                    <span className={`status-badge ${STATUS_CONFIG[r.status].style}`}>
                      {STATUS_CONFIG[r.status].label}
                    </span>
                  </td>
                  <td className="table-cell text-[12px] text-[hsl(var(--status-warning))] font-medium">
                    {ATTENTION_REASONS[r.status] || 'Requiere acción'}
                  </td>
                  <td className="table-cell text-[12px] font-mono text-muted-foreground tabular-nums">
                    {formatDate(r.dueDate)}
                  </td>
                  <td className="table-cell text-[12px] text-muted-foreground">{r.assignedTo || '—'}</td>
                  <td className="table-cell">
                    <Link
                      to={`/admin/legal-flow/cases/${r.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {NEXT_ACTION[r.status] || 'Ver detalle'}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
