import { ChevronDown, ChevronUp, CheckCircle2, Clock } from 'lucide-react';
import { type ChecklistCategoria as ChecklistCategoriaType, type EntidadER, ESTATUS_CHECKLIST } from './EntregaTypes';
import { ChecklistConcepto } from './ChecklistConcepto';

interface ChecklistCategoriaRowProps {
  cat: ChecklistCategoriaType;
  isExpanded: boolean;
  isSelected: boolean;
  itemsLoading: Set<number>;
  supervisores: EntidadER[];
  tecnicos: EntidadER[];
  getEstatusNombre: (id: number) => string;
  onToggle: () => void;
  onSelect: () => void;
  onActualizarEstatus: (itemId: number, estatus: number) => void;
  onOpenNoCumple: (itemId: number, nombre: string) => void;
  onAsignarSupervisor: (itemId: number, entidadId: number | null) => void;
  onAsignarTecnico: (itemId: number, entidadId: number | null) => void;
  onOpenEvidencia: (itemId: number, nombre: string) => void;
}

export function ChecklistCategoriaRow({
  cat,
  isExpanded,
  isSelected,
  itemsLoading,
  supervisores,
  tecnicos,
  getEstatusNombre,
  onToggle,
  onSelect,
  onActualizarEstatus,
  onOpenNoCumple,
  onAsignarSupervisor,
  onAsignarTecnico,
  onOpenEvidencia,
}: ChecklistCategoriaRowProps) {
  const catApl = cat.items.filter(i => i.id_estatus_checklist !== ESTATUS_CHECKLIST.NO_APLICA);
  const catCum = catApl.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.CUMPLE);
  const catPct = catApl.length > 0 ? Math.round((catCum.length / catApl.length) * 100) : 0;

  return (
    <>
      <tr
        onClick={() => { onToggle(); onSelect(); }}
        className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {isExpanded
              ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            <div>
              <p className="font-semibold text-slate-900 text-xs">{cat.nombre}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${catPct}%` }} />
                </div>
                <span className="text-[10px] text-slate-500">{catCum.length}/{catApl.length}</span>
              </div>
            </div>
          </div>
        </td>

        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            cat.estatus === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-700' :
            cat.estatus === 'NO_CUMPLE'  ? 'bg-red-50 text-red-700' :
            'bg-amber-50 text-amber-700'
          }`}>
            {cat.estatus === 'COMPLETADO' && <CheckCircle2 className="w-3 h-3" />}
            {cat.estatus === 'COMPLETADO' ? 'Completado' : cat.estatus === 'NO_CUMPLE' ? 'Con observación' : 'Pendiente'}
          </span>
        </td>

        <td className="px-4 py-3">
          {cat.estatus === 'COMPLETADO'
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : <Clock className="w-4 h-4 text-amber-400" />}
        </td>

        <td className="px-4 py-3">
          {cat.responsable
            ? <>
                <p className="text-xs font-medium text-slate-700">{cat.responsable}</p>
                {cat.cargo && <p className="text-[10px] text-slate-400">{cat.cargo}</p>}
              </>
            : <span className="text-xs text-slate-400">—</span>}
        </td>
      </tr>

      {isExpanded && cat.items.map(item => (
        <ChecklistConcepto
          key={item.id}
          item={item}
          isLoading={itemsLoading.has(item.id)}
          supervisores={supervisores}
          tecnicos={tecnicos}
          getEstatusNombre={getEstatusNombre}
          onActualizarEstatus={onActualizarEstatus}
          onOpenNoCumple={onOpenNoCumple}
          onAsignarSupervisor={onAsignarSupervisor}
          onAsignarTecnico={onAsignarTecnico}
          onOpenEvidencia={onOpenEvidencia}
        />
      ))}
    </>
  );
}
