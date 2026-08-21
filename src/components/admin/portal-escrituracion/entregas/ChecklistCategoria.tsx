import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Clock, Loader2, UserCheck, Wrench, X } from 'lucide-react';
import { type ChecklistCategoria as ChecklistCategoriaType, type EntidadER, ESTATUS_CHECKLIST } from './EntregaTypes';
import { ChecklistConcepto } from './ChecklistConcepto';

interface ChecklistCategoriaRowProps {
  cat: ChecklistCategoriaType;
  isExpanded: boolean;
  isSelected: boolean;
  itemsLoading: Set<number>;
  catLoading: boolean;
  supervisores: EntidadER[];
  tecnicos: EntidadER[];
  // Indica si el DDL de defaults de categoría (id_tecnico_default_er /
  // id_supervisor_default_er) ya fue ejecutado en este ambiente. Si es
  // false, las acciones de asignación de categoría se ocultan (en vez de
  // fallar silenciosamente contra columnas inexistentes).
  categoriaDefaultsDisponibles: boolean;
  getEstatusNombre: (id: number) => string;
  onToggle: () => void;
  onSelect: () => void;
  onActualizarEstatus: (itemId: number, estatus: number) => void;
  onOpenNoCumple: (itemId: number, nombre: string) => void;
  onAsignarSupervisor: (itemId: number, entidadId: number | null) => void;
  onAsignarTecnico: (itemId: number, entidadId: number | null) => void;
  onAsignarTecnicoCategoria: (catId: number, entidadId: number | null) => void;
  onAsignarSupervisorCategoria: (catId: number, entidadId: number | null) => void;
  onOpenEvidencia: (itemId: number, nombre: string) => void;
}

type PanelMode = 'supervisor' | 'tecnico' | null;

export function ChecklistCategoriaRow({
  cat,
  isExpanded,
  isSelected,
  itemsLoading,
  catLoading,
  supervisores,
  tecnicos,
  categoriaDefaultsDisponibles,
  getEstatusNombre,
  onToggle,
  onSelect,
  onActualizarEstatus,
  onOpenNoCumple,
  onAsignarSupervisor,
  onAsignarTecnico,
  onAsignarTecnicoCategoria,
  onAsignarSupervisorCategoria,
  onOpenEvidencia,
}: ChecklistCategoriaRowProps) {
  const [panel, setPanel] = useState<PanelMode>(null);
  const [search, setSearch] = useState('');

  const catApl = cat.items.filter(i => i.id_estatus_checklist !== ESTATUS_CHECKLIST.NO_APLICA);
  const catCum = catApl.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.CUMPLE);
  const catPct = catApl.length > 0 ? Math.round((catCum.length / catApl.length) * 100) : 0;

  const tecnicoDefault    = tecnicos.find(e => e.id === cat.id_tecnico_default_er) ?? null;
  const supervisorDefault = supervisores.find(e => e.id === cat.id_supervisor_default_er) ?? null;

  const activeList   = panel === 'supervisor' ? supervisores : tecnicos;
  const filteredList = activeList.filter(e => e.nombre.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const currentId    = panel === 'supervisor' ? cat.id_supervisor_default_er : cat.id_tecnico_default_er;
  const onSelectEntidad = panel === 'supervisor' ? onAsignarSupervisorCategoria : onAsignarTecnicoCategoria;

  const togglePanel = (mode: PanelMode) => {
    setPanel(prev => (prev === mode ? null : mode));
    setSearch('');
  };

  const handleSelect = (id: number | null) => {
    onSelectEntidad(cat.id, id);
    setPanel(null);
    setSearch('');
  };

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
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {tecnicoDefault && (
                <div className="flex items-center gap-1 text-[11px] text-orange-600">
                  <Wrench className="w-3 h-3 shrink-0" />
                  <span className="truncate font-medium">{tecnicoDefault.nombre}</span>
                </div>
              )}
              {supervisorDefault && (
                <div className="flex items-center gap-1 text-[11px] text-blue-600 mt-0.5">
                  <UserCheck className="w-3 h-3 shrink-0" />
                  <span className="truncate font-medium">{supervisorDefault.nombre}</span>
                </div>
              )}
              {!tecnicoDefault && !supervisorDefault && (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>

            {categoriaDefaultsDisponibles && (
              <div className="flex items-center gap-1 shrink-0">
                {catLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                ) : (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); togglePanel('tecnico'); }}
                      title={tecnicoDefault ? `Técnico de categoría: ${tecnicoDefault.nombre}` : 'Asignar técnico de categoría'}
                      className="p-0.5 rounded transition-colors">
                      <Wrench className={`w-3.5 h-3.5 ${tecnicoDefault ? 'text-orange-500' : 'text-slate-300 hover:text-orange-400'}`} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); togglePanel('supervisor'); }}
                      title={supervisorDefault ? `Supervisor de categoría: ${supervisorDefault.nombre}` : 'Asignar supervisor de categoría'}
                      className="p-0.5 rounded transition-colors">
                      <UserCheck className={`w-3.5 h-3.5 ${supervisorDefault ? 'text-blue-500' : 'text-slate-300 hover:text-blue-400'}`} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* ── Popover de asignación de técnico/supervisor DEFAULT de categoría ── */}
      {panel !== null && (
        <tr onClick={e => e.stopPropagation()} className="bg-slate-50/40">
          <td colSpan={4} className="px-4 pb-3 pt-0">
            <div className="ml-5 space-y-1.5 max-w-xs" onClick={e => e.stopPropagation()}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {panel === 'supervisor' ? `Supervisor default — ${cat.nombre}` : `Técnico default — ${cat.nombre}`}
              </p>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={panel === 'supervisor' ? 'Buscar supervisor…' : 'Buscar técnico…'}
                autoFocus
                onClick={e => e.stopPropagation()}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="max-h-36 overflow-y-auto space-y-0.5 rounded-xl border border-slate-100 bg-white shadow-sm">
                {currentId !== null && (
                  <button
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleSelect(null)}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1">
                    <X className="w-3 h-3" /> Quitar {panel === 'supervisor' ? 'supervisor' : 'técnico'} default
                  </button>
                )}
                {filteredList.length === 0 ? (
                  <p className="text-[11px] text-slate-400 px-2.5 py-1.5">
                    {search
                      ? 'Sin resultados'
                      : panel === 'supervisor'
                        ? 'Sin supervisores disponibles'
                        : 'Sin técnicos disponibles'}
                  </p>
                ) : filteredList.map(er => (
                  <button
                    key={er.id}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleSelect(er.id)}
                    className={`w-full text-left px-2.5 py-1.5 text-[11px] transition-colors ${
                      currentId === er.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}>
                    {er.nombre}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                Se aplica como default a todos los ítems sin asignación individual.
              </p>
            </div>
          </td>
        </tr>
      )}

      {isExpanded && cat.items.map(item => (
        <ChecklistConcepto
          key={item.id}
          item={item}
          categoria={cat}
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
