import { type ObservacionRow, PRIORIDAD_META, fmtDt } from './EntregaTypes';

interface ObservacionCardProps {
  obs: ObservacionRow;
}

export function ObservacionCard({ obs }: ObservacionCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-slate-900 leading-snug">{obs.descripcion}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORIDAD_META[obs.prioridad]?.cls ?? 'bg-slate-100 text-slate-600'}`}>
            {PRIORIDAD_META[obs.prioridad]?.label ?? obs.prioridad}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
            {obs.estatus}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-end text-xs text-slate-400">
        <span>{fmtDt(obs.fecha_creacion)}</span>
      </div>
    </div>
  );
}
