import { Loader2, CheckCircle2, Wrench, CheckCheck, X } from 'lucide-react';
import { type ChecklistItem, ESTATUS_CHECKLIST, ITEM_CLS } from './EntregaTypes';

interface ChecklistConceptoProps {
  item: ChecklistItem;
  isLoading: boolean;
  getEstatusNombre: (id: number) => string;
  onActualizarEstatus: (itemId: number, estatus: number) => void;
  onOpenNoCumple: (itemId: number, nombre: string) => void;
}

export function ChecklistConcepto({
  item,
  isLoading,
  getEstatusNombre,
  onActualizarEstatus,
  onOpenNoCumple,
}: ChecklistConceptoProps) {
  return (
    <tr className="bg-slate-50/60 hover:bg-slate-50">
      <td className="pl-12 pr-4 py-2" colSpan={4}>
        <div className="flex items-center justify-between gap-3">
          {/* Nombre + ícono de estatus */}
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${ITEM_CLS[item.id_estatus_checklist] ?? 'text-slate-400'}`} />
            <span className="text-xs text-slate-700 truncate">{item.nombre}</span>
          </div>

          {/* Estatus label + acciones */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] font-medium ${ITEM_CLS[item.id_estatus_checklist] ?? 'text-slate-400'}`}>
              {getEstatusNombre(item.id_estatus_checklist)}
            </span>
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
            ) : (
              <div className="flex items-center gap-1">
                {item.id_estatus_checklist === ESTATUS_CHECKLIST.PENDIENTE && (<>
                  <button
                    onClick={() => onActualizarEstatus(item.id, ESTATUS_CHECKLIST.CUMPLE)}
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 border border-emerald-200 transition-colors">
                    Cumple
                  </button>
                  <button
                    onClick={() => onOpenNoCumple(item.id, item.nombre)}
                    className="px-2 py-0.5 rounded-lg bg-red-50 text-red-700 text-[11px] font-medium hover:bg-red-100 border border-red-200 transition-colors">
                    No cumple
                  </button>
                  <button
                    onClick={() => onActualizarEstatus(item.id, ESTATUS_CHECKLIST.NO_APLICA)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-medium hover:bg-slate-200 transition-colors">
                    N/A
                  </button>
                </>)}

                {item.id_estatus_checklist === ESTATUS_CHECKLIST.NO_CUMPLE && (
                  <button
                    onClick={() => onActualizarEstatus(item.id, ESTATUS_CHECKLIST.EN_REPARACION)}
                    className="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-700 text-[11px] font-medium hover:bg-orange-100 border border-orange-200 transition-colors flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Enviar a reparación
                  </button>
                )}

                {item.id_estatus_checklist === ESTATUS_CHECKLIST.EN_REPARACION && (
                  <button
                    onClick={() => onActualizarEstatus(item.id, ESTATUS_CHECKLIST.REPARADO_PENDIENTE_VOBO)}
                    className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-medium hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Reparación terminada
                  </button>
                )}

                {item.id_estatus_checklist === ESTATUS_CHECKLIST.REPARADO_PENDIENTE_VOBO && (<>
                  <button
                    onClick={() => onActualizarEstatus(item.id, ESTATUS_CHECKLIST.VOBO_APROBADO)}
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1">
                    <CheckCheck className="w-3 h-3" /> Aprobar VoBo
                  </button>
                  <button
                    onClick={() => onActualizarEstatus(item.id, ESTATUS_CHECKLIST.VOBO_RECHAZADO)}
                    className="px-2 py-0.5 rounded-lg bg-red-50 text-red-700 text-[11px] font-medium hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1">
                    <X className="w-3 h-3" /> Rechazar VoBo
                  </button>
                </>)}
              </div>
            )}
          </div>
        </div>

        {item.observacion && (
          <p className="ml-5 mt-1 text-[11px] text-slate-400 italic truncate">
            Obs: {item.observacion}
          </p>
        )}
      </td>
    </tr>
  );
}
