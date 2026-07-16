import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, UserCheck, Wrench, Plus, Pencil, X, Loader2,
  AlertTriangle, Search, Check, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const ESPECIALIDADES = [
  'Pintura', 'Carpintería', 'Herrería', 'Electricidad', 'Hidrosanitario',
  'Cancelería', 'Aluminio', 'Pisos', 'Acabados', 'Limpieza', 'General',
];

interface EntregaResponsable {
  id: number;
  id_entidad: number;
  nombre: string;
  es_supervisor: boolean;
  es_tecnico: boolean;
  especialidades: string[];
  activo: boolean;
}

interface EntidadOpcion {
  id: number;
  nombre: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tipoLabel(r: EntregaResponsable) {
  if (r.es_supervisor && r.es_tecnico) return 'Sup. + Téc.';
  if (r.es_supervisor) return 'Supervisor';
  return 'Técnico';
}

function tipoCls(r: EntregaResponsable) {
  if (r.es_supervisor && r.es_tecnico) return 'bg-violet-50 text-violet-700';
  if (r.es_supervisor) return 'bg-blue-50 text-blue-700';
  return 'bg-orange-50 text-orange-700';
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, cls }: {
  icon: React.ElementType; label: string; value: number; cls: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cls)}>
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-slate-800 leading-none">{value}</p>
      </div>
    </div>
  );
}

// ─── DDL Pending Banner ───────────────────────────────────────────────────────

function DdlBanner() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900 mb-1">DDL pendiente de ejecución</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              La tabla <code className="font-mono bg-amber-100 px-1 rounded">entregas_responsables</code> aún
              no existe en la base de datos. Ejecuta el DDL en{' '}
              <span className="font-semibold">Ejecuciones_manuales/responsables_entregas.md</span> antes
              de usar esta pantalla.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-amber-600 mt-2">
          El checklist y el resto del módulo siguen funcionando con normalidad mientras tanto.
        </p>
      </div>
    </div>
  );
}

// ─── Modal de Alta / Edición ──────────────────────────────────────────────────

interface ModalProps {
  editTarget: EntregaResponsable | null;
  existingIds: number[];
  onClose: () => void;
  onSaved: () => void;
}

function ResponsableModal({ editTarget, existingIds, onClose, onSaved }: ModalProps) {
  const isEdit = editTarget !== null;

  // Persona selection (create only)
  const [entitySearch, setEntitySearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<EntidadOpcion | null>(null);
  const [entidades, setEntidades] = useState<EntidadOpcion[]>([]);
  const [loadingEnt, setLoadingEnt] = useState(false);

  // Role config
  const [esSupervisor, setEsSupervisor] = useState(editTarget?.es_supervisor ?? false);
  const [esTecnico, setEsTecnico]       = useState(editTarget?.es_tecnico ?? true);
  const [especialidades, setEspecialidades] = useState<string[]>(editTarget?.especialidades ?? []);
  const [activo, setActivo]             = useState(editTarget?.activo ?? true);
  const [saving, setSaving]             = useState(false);

  // Load entities for create mode
  useEffect(() => {
    if (isEdit) return;
    setLoadingEnt(true);
    (supabase as any)
      .from('entidades_relacionadas')
      .select('id, personas!entidades_relacionadas_id_persona_fkey(nombre_legal, nombre_comercial)')
      .in('id_tipo_entidad', [8, 9, 22])
      .eq('activo', true)
      .order('id')
      .limit(200)
      .then(({ data }: { data: any[] | null }) => {
        setEntidades(
          (data ?? [])
            .filter((er: any) => !existingIds.includes(er.id))
            .map((er: any) => ({
              id: er.id,
              nombre: er.personas?.nombre_legal || er.personas?.nombre_comercial || `Entidad #${er.id}`,
            }))
        );
        setLoadingEnt(false);
      });
  }, [isEdit, existingIds]);

  const filteredEnt = entidades.filter(e =>
    e.nombre.toLowerCase().includes(entitySearch.toLowerCase())
  ).slice(0, 10);

  const toggleEsp = (esp: string) =>
    setEspecialidades(prev =>
      prev.includes(esp) ? prev.filter(e => e !== esp) : [...prev, esp]
    );

  const canSave = isEdit
    ? (esSupervisor || esTecnico)
    : !!selectedEntity && (esSupervisor || esTecnico);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await (supabase as any)
          .from('entregas_responsables')
          .update({
            es_supervisor: esSupervisor,
            es_tecnico:    esTecnico,
            especialidades,
            activo,
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq('id', editTarget!.id);
        if (error) throw error;
        toast.success('Responsable actualizado');
      } else {
        const { error } = await (supabase as any)
          .from('entregas_responsables')
          .insert({
            id_entidad_relacionada: selectedEntity!.id,
            es_supervisor: esSupervisor,
            es_tecnico:    esTecnico,
            especialidades,
            activo: true,
          });
        if (error) throw error;
        toast.success('Responsable agregado');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-900">
            {isEdit ? 'Editar responsable' : 'Agregar responsable'}
          </p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Persona (create only) */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Persona <span className="text-red-500">*</span>
              </label>
              {selectedEntity ? (
                <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-sm font-medium text-blue-800">{selectedEntity.nombre}</span>
                  <button
                    onClick={() => { setSelectedEntity(null); setEntitySearch(''); }}
                    className="text-blue-400 hover:text-blue-600 ml-2">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                    <input
                      className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Buscar persona en entidades relacionadas..."
                      value={entitySearch}
                      onChange={e => setEntitySearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {loadingEnt ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                    </div>
                  ) : (
                    <div className="mt-1 border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm max-h-40 overflow-y-auto">
                      {filteredEnt.length === 0 ? (
                        <p className="text-xs text-slate-400 px-3 py-2">
                          {entitySearch ? 'Sin resultados' : 'Sin personas disponibles'}
                        </p>
                      ) : filteredEnt.map(e => (
                        <button
                          key={e.id}
                          onClick={() => { setSelectedEntity(e); setEntitySearch(''); }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                        >
                          {e.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Edit: persona name (read-only) */}
          {isEdit && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Persona</p>
              <p className="text-sm font-medium text-slate-800">{editTarget!.nombre}</p>
            </div>
          )}

          {/* Roles */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Rol en Entregas <span className="text-red-500">*</span>
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600"
                  checked={esSupervisor}
                  onChange={e => setEsSupervisor(e.target.checked)}
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Supervisor Responsable</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Aprueba trabajos, revisa reparaciones, realiza VoBo, cierra observaciones.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-orange-500"
                  checked={esTecnico}
                  onChange={e => setEsTecnico(e.target.checked)}
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Técnico Responsable</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ejecuta la reparación, carga evidencias, actualiza avances.
                  </p>
                </div>
              </label>
            </div>
            {!esSupervisor && !esTecnico && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Debe tener al menos un rol
              </p>
            )}
          </div>

          {/* Especialidades (técnico) */}
          {esTecnico && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Especialidades</p>
              <div className="flex flex-wrap gap-2">
                {ESPECIALIDADES.map(esp => (
                  <button
                    key={esp}
                    onClick={() => toggleEsp(esp)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      especialidades.includes(esp)
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'border-slate-200 text-slate-600 hover:border-orange-300'
                    )}
                  >
                    {esp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Activo toggle (edit only) */}
          {isEdit && (
            <div className="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2.5">
              <span className="text-sm text-slate-700">Estatus</span>
              <button
                onClick={() => setActivo(v => !v)}
                className="flex items-center gap-2 text-xs font-medium"
              >
                {activo
                  ? <><ToggleRight className="w-5 h-5 text-emerald-500" /><span className="text-emerald-600">Activo</span></>
                  : <><ToggleLeft  className="w-5 h-5 text-slate-400"   /><span className="text-slate-500">Inactivo</span></>}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEdit ? 'Guardar cambios' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResponsablesConfigTab() {
  const qc = useQueryClient();
  const [ddlPending, setDdlPending] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [editTarget, setEditTarget] = useState<EntregaResponsable | null>(null);
  const [search, setSearch]         = useState('');

  const { data: responsables = [], isLoading, refetch } = useQuery<EntregaResponsable[]>({
    queryKey: ['entregas-responsables-cfg'],
    queryFn: async () => {
      // DDL probe
      const probe = await (supabase as any).from('entregas_responsables').select('id').limit(0);
      if (probe.error) {
        setDdlPending(true);
        return [];
      }
      setDdlPending(false);

      // Fetch configs
      const { data: configs } = await (supabase as any)
        .from('entregas_responsables')
        .select('id, id_entidad_relacionada, es_supervisor, es_tecnico, especialidades, activo')
        .order('id');
      if (!configs?.length) return [];

      const erIds = (configs as any[]).map((c: any) => c.id_entidad_relacionada);

      // Waterfall: fetch personas
      const { data: entidades } = await supabase
        .from('entidades_relacionadas')
        .select('id, personas!entidades_relacionadas_id_persona_fkey(nombre_legal, nombre_comercial)')
        .in('id', erIds);

      const nombreMap: Record<number, string> = Object.fromEntries(
        (entidades ?? []).map((er: any) => [
          er.id,
          er.personas?.nombre_legal || er.personas?.nombre_comercial || `Entidad #${er.id}`,
        ])
      );

      return (configs as any[]).map((c: any) => ({
        id:            c.id,
        id_entidad:    c.id_entidad_relacionada,
        nombre:        nombreMap[c.id_entidad_relacionada] ?? `Entidad #${c.id_entidad_relacionada}`,
        es_supervisor: c.es_supervisor,
        es_tecnico:    c.es_tecnico,
        especialidades: c.especialidades ?? [],
        activo:        c.activo,
      })) as EntregaResponsable[];
    },
    staleTime: 30_000,
  });

  if (ddlPending) return <DdlBanner />;

  const supervisoresActivos = responsables.filter(r => r.activo && r.es_supervisor).length;
  const tecnicosActivos     = responsables.filter(r => r.activo && r.es_tecnico).length;

  const filtered = responsables.filter(r =>
    r.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const existingIds = responsables.map(r => r.id_entidad);

  const openAdd = () => { setEditTarget(null); setShowModal(true); };
  const openEdit = (r: EntregaResponsable) => { setEditTarget(r); setShowModal(true); };
  const handleSaved = () => qc.invalidateQueries({ queryKey: ['entregas-responsables-cfg'] });

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
      {showModal && (
        <ResponsableModal
          editTarget={editTarget}
          existingIds={existingIds}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard icon={UserCheck} label="Supervisores activos" value={supervisoresActivos} cls="bg-blue-50 text-blue-600" />
        <KpiCard icon={Wrench}    label="Técnicos activos"     value={tecnicosActivos}     cls="bg-orange-50 text-orange-600" />
        <KpiCard icon={Users}     label="Responsables totales" value={responsables.length}  cls="bg-slate-100 text-slate-600" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
          <input
            className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar responsable
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          {search ? `Sin resultados para "${search}"` : 'Sin responsables configurados. Agrega el primero.'}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Especialidades</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Estatus</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <tr key={r.id} className={cn('hover:bg-slate-50/60 transition-colors', !r.activo && 'opacity-50')}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{r.nombre}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', tipoCls(r))}>
                      {tipoLabel(r)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.especialidades.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : r.especialidades.slice(0, 3).map(esp => (
                        <span key={esp} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                          {esp}
                        </span>
                      ))}
                      {r.especialidades.length > 3 && (
                        <span className="text-[10px] text-slate-400">+{r.especialidades.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      r.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', r.activo ? 'bg-emerald-500' : 'bg-slate-400')} />
                      {r.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
