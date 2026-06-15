import { motion } from 'framer-motion';
import { Users, Loader2 } from 'lucide-react';
import { useLegalFlowCargaResponsable } from '@/hooks/useLegalFlowCargaResponsable';
import type { LegalRequest } from '@/types/legal-flow';

interface Props {
  openDrawer?: (title: string, cases: LegalRequest[]) => void;
}

export default function WorkloadPanel({ openDrawer }: Props) {
  const { data: responsables, isLoading } = useLegalFlowCargaResponsable();
  // Escala de la barra relativa al responsable con más carga (mín. 1).
  const maxActive = responsables.reduce((m, l) => Math.max(m, l.active), 0) || 1;

  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
    >
      <div className="panel-header">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" strokeWidth={1.75} />
          Carga por responsable
        </h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando carga de trabajo…
        </div>
      ) : responsables.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[13px] font-medium text-foreground/70">Sin responsables asignados</p>
          <p className="text-[12px] text-muted-foreground/60 mt-1">
            No hay expedientes activos con abogado asignado.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {responsables.map((l) => (
            <button
              key={l.name}
              onClick={() => openDrawer?.(`Expedientes de ${l.name}`, l.cases)}
              className="flex items-center justify-between px-5 py-4 w-full text-left hover:bg-accent transition-colors cursor-pointer group"
            >
              <div>
                <p className="text-[13px] font-medium group-hover:text-primary transition-colors">{l.name}</p>
                <p className="text-[12px] text-muted-foreground/60 mt-0.5">Abogado responsable</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[14px] tabular-nums font-semibold">{l.active}</span>
                  <span className="text-[12px] text-muted-foreground ml-1">activos</span>
                </div>
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${(l.active / maxActive) * 100}%` }}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
