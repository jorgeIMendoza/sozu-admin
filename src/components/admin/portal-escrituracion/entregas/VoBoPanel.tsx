import { X, User, Clock } from 'lucide-react';
import { type ChecklistCategoria, ESTATUS_CHECKLIST, ITEM_CLS, fmtDt } from './EntregaTypes';

interface VoBoPanelProps {
  selectedCat: ChecklistCategoria;
  onClose: () => void;
  getEstatusNombre: (id: number) => string;
}

export function VoBoPanel({ selectedCat, onClose, getEstatusNombre }: VoBoPanelProps) {
  const panelApl = selectedCat.items.filter(i => i.id_estatus_checklist !== ESTATUS_CHECKLIST.NO_APLICA);
  const panelCum = panelApl.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.CUMPLE);
  const panelPct = panelApl.length > 0 ? Math.round((panelCum.length / panelApl.length) * 100) : 0;

  return (
    <div className="w-[300px] min-w-[300px] bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden self-start sticky top-0">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-900">Detalle del VoBo</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm font-bold text-slate-900">{selectedCat.nombre}</p>
          <div className="flex items-center justify-between mt-2 mb-1">
            <span className="text-xs text-slate-500">Conceptos</span>
            <span className="text-xs font-semibold text-emerald-600">
              {panelCum.length}/{panelApl.length} completos
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${panelPct}%` }}
            />
          </div>
        </div>

        {selectedCat.responsable ? (
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{selectedCat.responsable}</p>
                {selectedCat.cargo && <p className="text-[11px] text-slate-500">{selectedCat.cargo}</p>}
              </div>
            </div>
            {selectedCat.fecha_vobo && (
              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                <Clock className="w-3 h-3" /> {fmtDt(selectedCat.fecha_vobo)}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">VoBo aún no registrado.</p>
        )}

        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Ítems ({selectedCat.items.length})
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {selectedCat.items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-700 leading-tight">{item.nombre}</span>
                <span className={`text-[11px] font-medium shrink-0 ${ITEM_CLS[item.id_estatus_checklist] ?? 'text-slate-400'}`}>
                  {getEstatusNombre(item.id_estatus_checklist)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
