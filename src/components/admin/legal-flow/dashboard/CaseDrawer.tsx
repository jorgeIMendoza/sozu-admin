import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Building2, User, AlertTriangle, ExternalLink } from 'lucide-react';
import { STATUS_CONFIG, REQUEST_TYPE_LABELS } from '@/data/mockData';
import type { LegalRequest } from '@/types/legal';

const NEXT_ACTION: Record<string, string> = {
  request_received: 'Revisar solicitud',
  missing_information: 'Completar información',
  in_legal_review: 'Aprobar generación',
  approved_for_generation: 'Generar documento',
  client_signature: 'Ver firma de cliente',
  in_validation: 'Enviar a firma del titular',
  in_signature_process: 'Seguimiento de firma',
  partially_signed: 'Seguimiento de firma',
  fully_signed: 'Archivar expediente',
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
const isOverdue = (d: string) => new Date(d) < new Date();

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  cases: LegalRequest[];
}

export default function CaseDrawer({ open, onOpenChange, title, subtitle, cases }: Props) {
  const responsables = [...new Set(cases.map(c => c.assignedTo).filter(Boolean))];
  const projects = [...new Set(cases.map(c => c.project).filter(Boolean))];
  const overdueCount = cases.filter(c => isOverdue(c.dueDate) && !['fully_signed', 'archived', 'cancelled'].includes(c.status)).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-lg font-semibold">{title || 'Expedientes'}</SheetTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </SheetHeader>

        <div className="grid grid-cols-3 gap-3 py-5 border-b">
          <div className="text-center">
            <p className="text-[28px] font-bold tabular-nums">{cases.length}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total</p>
          </div>
          <div className="text-center">
            <p className="text-[28px] font-bold tabular-nums">{responsables.length}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Responsables</p>
          </div>
          <div className="text-center">
            <p className={`text-[28px] font-bold tabular-nums ${overdueCount > 0 ? 'text-destructive' : ''}`}>{overdueCount}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Vencidos</p>
          </div>
        </div>

        {projects.length > 0 && (
          <div className="py-4 border-b">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Proyectos relacionados</p>
            <div className="flex flex-wrap gap-1.5">
              {projects.slice(0, 5).map(p => (
                <span key={p} className="text-[12px] bg-muted px-2.5 py-0.5 rounded-md">{p}</span>
              ))}
            </div>
          </div>
        )}

        <div className="divide-y">
          {cases.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">No hay expedientes para este filtro</p>
              <button onClick={() => onOpenChange(false)} className="text-sm text-primary mt-2 hover:underline cursor-pointer">Limpiar filtros</button>
            </div>
          ) : (
            cases.map(c => {
              const overdue = isOverdue(c.dueDate) && !['fully_signed', 'archived', 'cancelled'].includes(c.status);
              const action = NEXT_ACTION[c.status];
              return (
                <div key={c.id} className="py-4 group hover:bg-accent/30 -mx-6 px-6 transition-colors">
                  <Link
                    to={`/cases/${c.id}`}
                    onClick={() => onOpenChange(false)}
                    className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors leading-snug inline-flex items-center gap-1"
                  >
                    {c.title}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                  </Link>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`status-badge ${STATUS_CONFIG[c.status].style}`}>{STATUS_CONFIG[c.status].label}</span>
                    <span className="text-[11px] text-muted-foreground">{REQUEST_TYPE_LABELS[c.type]}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[12px] text-muted-foreground">
                    {c.assignedTo && (
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{c.assignedTo}</span>
                    )}
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{c.company}</span>
                    <span className={`flex items-center gap-1 ${overdue ? 'text-destructive font-semibold' : ''}`}>
                      <Calendar className="h-3 w-3" />{formatDate(c.dueDate)}
                      {overdue && <AlertTriangle className="h-3 w-3" />}
                    </span>
                  </div>
                  {action && (
                    <Link
                      to={`/cases/${c.id}`}
                      onClick={() => onOpenChange(false)}
                      className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-bold text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {action} <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>

        {cases.length > 0 && (
          <div className="pt-5 border-t mt-5">
            <Link
              to="/requests"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Ver todos los expedientes <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
