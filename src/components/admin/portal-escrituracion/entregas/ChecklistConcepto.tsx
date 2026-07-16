import { useState } from 'react';
import { Loader2, CheckCircle2, Wrench, CheckCheck, X, RotateCcw, Camera, User, UserCheck } from 'lucide-react';
import { type ChecklistItem, type EntidadER, ESTATUS_CHECKLIST, ITEM_CLS } from './EntregaTypes';

interface ChecklistConceptoProps {
  item: ChecklistItem;
  isLoading: boolean;
  supervisores: EntidadER[];
  tecnicos: EntidadER[];
  getEstatusNombre: (id: number) => string;
  onActualizarEstatus: (itemId: number, estatus: number) => void;
  onOpenNoCumple: (itemId: number, nombre: string) => void;
  onAsignarSupervisor: (itemId: number, entidadId: number | null) => void;
  onAsignarTecnico: (itemId: number, entidadId: number | null) => void;
  onOpenEvidencia: (itemId: number, nombre: string) => void;
}

type PanelMode = 'supervisor' | 'tecnico' | null;

export function ChecklistConcepto({
  item,
  isLoading,
  supervisores,
  tecnicos,
  getEstatusNombre,
  onActualizarEstatus,
  onOpenNoCumple,
  onAsignarSupervisor,
  onAsignarTecnico,
  onOpenEvidencia,
}: ChecklistConceptoProps) {
  const [panel, setPanel]     = useState<PanelMode>(null);
  const [search, setSearch]   = useState('');

  const supervisorAsignado = supervisores.find(e => e.id === item.id_supervisor_er) ?? null;
  const tecnicoAsignado    = tecnicos.find(e => e.id === item.id_tecnico_er) ?? null;

  // Legacy: fallback display cuando no hay nuevas cols pero sí la antigua
  const legacyNombre = !supervisorAsignado && !tecnicoAsignado && item.id_responsable_er
    ? (supervisores.find(e => e.id === item.id_responsable_er) ?? tecnicos.find(e => e.id === item.id_responsable_er))?.nombre ?? null
    : null;

  const isPendiente = item.id_estatus_checklist === ESTATUS_CHECKLIST.PENDIENTE;

  const activeList   = panel === 'supervisor' ? supervisores : tecnicos;
  const filteredList = activeList.filter(e => e.nombre.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const currentId    = panel === 'supervisor' ? item.id_supervisor_er : item.id_tecnico_er;
  const onSelect     = panel === 'supervisor' ? onAsignarSupervisor : onAsignarTecnico;

  const togglePanel = (mode: PanelMode) => {
    if (panel === mode) { setPanel(null); setSearch(''); }
    else { setPanel(mode); setSearch(''); }
  };

  const handleSelect = (id: number | null) => {
    onSelect(item.id, id);
    setPanel(null);
    setSearch('');
  };

  return (
    <tr className="bg-slate-50/60 hover:bg-slate-50">
      <td className="pl-12 pr-4 py-2" colSpan={4}>

        {/* ── Fila principal ── */}
        <div className="flex items-start justify-between gap-3">

          {/* Izquierda: ícono + nombre + responsables asignados */}
          <div className="flex items-start gap-2 min-w-0">
            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${ITEM_CLS[item.id_estatus_checklist] ?? 'text-slate-400'}`} />
            <div className="min-w-0">
              <span className="text-xs text-slate-700 leading-tight">{item.nombre}</span>

              {/* Supervisor asignado */}
              {supervisorAsignado && (
                <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-blue-500">
                  <UserCheck className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">Sup: {supervisorAsignado.nombre}</span>
                </div>
              )}
              {/* Técnico asignado */}
              {tecnicoAsignado && (
                <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-orange-500">
                  <Wrench className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">Téc: {tecnicoAsignado.nombre}</span>
                </div>
              )}
              {/* Legacy fallback */}
              {legacyNombre && !supervisorAsignado && !tecnicoAsignado && (
                <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-slate-400">
                  <User className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{legacyNombre}</span>
                </div>
              )}
            </div>
          </div>

          {/* Derecha: estatus + acciones */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[11px] font-medium ${ITEM_CLS[item.id_estatus_checklist] ?? 'text-slate-400'}`}>
              {getEstatusNombre(item.id_estatus_checklist)}
            </span>

            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
            ) : (
              <div className="flex items-center gap-1">
                {isPendiente && (<>
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

                {item.id_estatus_checklist === ESTATUS_CHECKLIST.VOBO_RECHAZADO && (
                  <button
                    onClick={() => onActualizarEstatus(item.id, ESTATUS_CHECKLIST.EN_REPARACION)}
                    className="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-700 text-[11px] font-medium hover:bg-orange-100 border border-orange-200 transition-colors flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Reenviar a reparación
                  </button>
                )}

                {!isPendiente && (
                  <button
                    onClick={() => onActualizarEstatus(item.id, ESTATUS_CHECKLIST.PENDIENTE)}
                    title="Revertir a Pendiente"
                    className="p-0.5 rounded text-slate-300 hover:text-amber-500 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Evidencia */}
            <button
              onClick={() => onOpenEvidencia(item.id, item.nombre)}
              title="Cargar evidencia"
              className="p-0.5 rounded text-slate-300 hover:text-blue-500 transition-colors">
              <Camera className="w-3.5 h-3.5" />
            </button>

            {/* Supervisor */}
            <button
              onClick={() => togglePanel('supervisor')}
              title={supervisorAsignado ? `Supervisor: ${supervisorAsignado.nombre}` : 'Asignar supervisor'}
              className="p-0.5 rounded transition-colors">
              <UserCheck className={`w-3.5 h-3.5 ${supervisorAsignado ? 'text-blue-500' : 'text-slate-300 hover:text-blue-400'}`} />
            </button>

            {/* Técnico */}
            <button
              onClick={() => togglePanel('tecnico')}
              title={tecnicoAsignado ? `Técnico: ${tecnicoAsignado.nombre}` : 'Asignar técnico'}
              className="p-0.5 rounded transition-colors">
              <Wrench className={`w-3.5 h-3.5 ${tecnicoAsignado ? 'text-orange-500' : 'text-slate-300 hover:text-orange-400'}`} />
            </button>
          </div>
        </div>

        {/* Observación existente */}
        {item.observacion && (
          <p className="ml-5 mt-1 text-[11px] text-slate-400 italic truncate">
            Obs: {item.observacion}
          </p>
        )}

        {/* ── Panel de asignación (supervisor o técnico) ── */}
        {panel !== null && (
          <div className="ml-5 mt-2 space-y-1.5 max-w-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {panel === 'supervisor' ? 'Asignar Supervisor Responsable' : 'Asignar Técnico Responsable'}
            </p>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={panel === 'supervisor' ? 'Buscar supervisor…' : 'Buscar técnico…'}
              autoFocus
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="max-h-36 overflow-y-auto space-y-0.5 rounded-xl border border-slate-100 bg-white shadow-sm">
              {currentId !== null && (
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSelect(null)}
                  className="w-full text-left px-2.5 py-1.5 text-[11px] text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" /> Quitar {panel === 'supervisor' ? 'supervisor' : 'técnico'}
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
          </div>
        )}
      </td>
    </tr>
  );
}
