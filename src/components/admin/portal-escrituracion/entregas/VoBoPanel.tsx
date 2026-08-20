import { X, UserCheck, Wrench, Clock } from 'lucide-react';
import {
  type ChecklistCategoria, type EntidadER, ESTATUS_CHECKLIST, ITEM_CLS, fmtDt,
  resolverTecnicoEfectivo, resolverSupervisorEfectivo,
} from './EntregaTypes';

interface VoBoPanelProps {
  selectedCat: ChecklistCategoria;
  onClose: () => void;
  getEstatusNombre: (id: number) => string;
  supervisores: EntidadER[];
  tecnicos: EntidadER[];
}

export function VoBoPanel({ selectedCat, onClose, getEstatusNombre, supervisores, tecnicos }: VoBoPanelProps) {
  const panelApl = selectedCat.items.filter(i => i.id_estatus_checklist !== ESTATUS_CHECKLIST.NO_APLICA);
  const panelCum = panelApl.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.CUMPLE);
  const panelPct = panelApl.length > 0 ? Math.round((panelCum.length / panelApl.length) * 100) : 0;

  // Defaults de categoría — reemplaza a los campos legacy selectedCat.responsable/cargo
  // (TEXT libre, sin FK, nunca escritos por la UI actual — ver auditoría 2026-08-19).
  const tecnicoDefault    = tecnicos.find(e => e.id === selectedCat.id_tecnico_default_er) ?? null;
  const supervisorDefault = supervisores.find(e => e.id === selectedCat.id_supervisor_default_er) ?? null;

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

        {tecnicoDefault || supervisorDefault ? (
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            {tecnicoDefault && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <Wrench className="w-3.5 h-3.5 text-orange-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Técnico de categoría</p>
                  <p className="text-xs font-semibold text-slate-800">{tecnicoDefault.nombre}</p>
                </div>
              </div>
            )}
            {supervisorDefault && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Supervisor de categoría</p>
                  <p className="text-xs font-semibold text-slate-800">{supervisorDefault.nombre}</p>
                </div>
              </div>
            )}
            {selectedCat.fecha_vobo && (
              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                <Clock className="w-3 h-3" /> {fmtDt(selectedCat.fecha_vobo)}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Sin técnico ni supervisor default asignado a esta categoría.</p>
        )}

        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Ítems ({selectedCat.items.length})
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {selectedCat.items.map(item => {
              const tec = resolverTecnicoEfectivo(item, selectedCat, tecnicos);
              const sup = resolverSupervisorEfectivo(item, selectedCat, supervisores);
              return (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs text-slate-700 leading-tight">{item.nombre}</span>
                    {(tec.entidad || sup.entidad) && (
                      <p className="text-[10px] text-slate-400 truncate">
                        {tec.entidad && `Téc: ${tec.entidad.nombre}${tec.origen === 'HEREDADO' ? ' (heredado)' : ''}`}
                        {tec.entidad && sup.entidad && ' · '}
                        {sup.entidad && `Sup: ${sup.entidad.nombre}${sup.origen === 'HEREDADO' ? ' (heredado)' : ''}`}
                      </p>
                    )}
                  </div>
                  <span className={`text-[11px] font-medium shrink-0 ${ITEM_CLS[item.id_estatus_checklist] ?? 'text-slate-400'}`}>
                    {getEstatusNombre(item.id_estatus_checklist)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
