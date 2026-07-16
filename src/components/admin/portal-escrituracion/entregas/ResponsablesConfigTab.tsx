import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, UserCheck, Wrench, Loader2, AlertTriangle, Search,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EntidadRow {
  id: number;
  id_tipo_entidad: number;
  tipo_nombre: string;
  id_proyecto: number | null;
  nombre: string;
  es_supervisor: boolean;
  es_tecnico: boolean;
}

const TIPO_LABEL: Record<number, string> = {
  8:  'Proveedor',
  12: 'Empleado',
  13: 'Contratista',
  22: 'Personal de mantenimiento',
};

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
      <div className="max-w-md w-full bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-700 mb-1">
              Vinculación con catálogo institucional pendiente
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              La administración de responsables está pendiente de vinculación con el
              catálogo institucional de personas. Ejecuta el DDL en{' '}
              <span className="font-semibold font-mono">
                Ejecuciones_manuales/responsables_entregas.md
              </span>{' '}
              (Bloques 1 y 2) para habilitar esta pantalla.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          El checklist y el resto del módulo siguen funcionando con normalidad mientras tanto.
        </p>
      </div>
    </div>
  );
}

// ─── Toggle button ────────────────────────────────────────────────────────────

function RolToggle({ active, label, colorOn, icon: Icon, onClick, saving }: {
  active: boolean; label: string; colorOn: string; icon: React.ElementType;
  onClick: () => void; saving: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
        active
          ? `${colorOn} border-current`
          : 'text-slate-400 border-slate-200 hover:border-slate-300',
        saving && 'opacity-50 cursor-not-allowed',
      )}
    >
      {saving
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : active
          ? <ToggleRight className="w-3.5 h-3.5" />
          : <ToggleLeft  className="w-3.5 h-3.5" />}
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResponsablesConfigTab() {
  const qc = useQueryClient();
  const [ddlApplied, setDdlApplied] = useState<boolean | null>(null);
  const [search, setSearch]         = useState('');
  const [saving, setSaving]         = useState<number | null>(null);

  const { data: entidades = [], isLoading } = useQuery<EntidadRow[]>({
    queryKey: ['entregas-responsables-tab'],
    queryFn: async () => {
      // DDL probe: detectar si los indicadores ya existen en entidades_relacionadas
      const probe = await (supabase as any)
        .from('entidades_relacionadas')
        .select('id, es_supervisor_entregas, es_tecnico_entregas')
        .limit(0);

      if (probe.error) {
        setDdlApplied(false);
        return [];
      }
      setDdlApplied(true);

      // Fetch: tipos 8 y 22 + cualquier entidad ya habilitada
      const { data: ers } = await (supabase as any)
        .from('entidades_relacionadas')
        .select(`
          id, id_tipo_entidad, id_proyecto, activo,
          es_supervisor_entregas, es_tecnico_entregas,
          personas!entidades_relacionadas_id_persona_fkey(nombre_legal, nombre_comercial)
        `)
        .or('id_tipo_entidad.in.(8,22),es_supervisor_entregas.eq.true,es_tecnico_entregas.eq.true')
        .eq('activo', true)
        .order('id');

      if (!ers?.length) return [];

      // Waterfall: labels de tipos
      const tipoIds = [...new Set((ers as any[]).map((e: any) => e.id_tipo_entidad))];
      const { data: tipos } = await (supabase as any)
        .from('tipos_entidad')
        .select('id, nombre')
        .in('id', tipoIds);
      const tipoMap: Record<number, string> = Object.fromEntries(
        (tipos ?? []).map((t: any) => [t.id, t.nombre])
      );

      return (ers as any[]).map((er: any) => ({
        id:              er.id,
        id_tipo_entidad: er.id_tipo_entidad,
        tipo_nombre:     tipoMap[er.id_tipo_entidad] ?? TIPO_LABEL[er.id_tipo_entidad] ?? `Tipo #${er.id_tipo_entidad}`,
        id_proyecto:     er.id_proyecto ?? null,
        nombre:          er.personas?.nombre_legal || er.personas?.nombre_comercial || `Entidad #${er.id}`,
        es_supervisor:   er.es_supervisor_entregas ?? false,
        es_tecnico:      er.es_tecnico_entregas ?? false,
      })) as EntidadRow[];
    },
    staleTime: 30_000,
  });

  const toggle = async (er: EntidadRow, campo: 'es_supervisor_entregas' | 'es_tecnico_entregas') => {
    setSaving(er.id);
    const valor = campo === 'es_supervisor_entregas' ? !er.es_supervisor : !er.es_tecnico;
    const { error } = await (supabase as any)
      .from('entidades_relacionadas')
      .update({ [campo]: valor })
      .eq('id', er.id);
    if (error) {
      toast.error('Error al actualizar');
    } else {
      toast.success(valor ? 'Rol habilitado' : 'Rol deshabilitado');
      qc.invalidateQueries({ queryKey: ['entregas-responsables-tab'] });
      qc.invalidateQueries({ queryKey: ['entregas-responsables-cat'] });
    }
    setSaving(null);
  };

  if (ddlApplied === false) return <DdlBanner />;

  const supervisoresActivos = entidades.filter(e => e.es_supervisor).length;
  const tecnicosActivos     = entidades.filter(e => e.es_tecnico).length;

  const filtered = entidades.filter(e =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.tipo_nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard icon={UserCheck} label="Supervisores habilitados" value={supervisoresActivos} cls="bg-blue-50 text-blue-600" />
        <KpiCard icon={Wrench}    label="Técnicos habilitados"     value={tecnicosActivos}     cls="bg-orange-50 text-orange-600" />
        <KpiCard icon={Users}     label="Entidades en catálogo"    value={entidades.length}    cls="bg-slate-100 text-slate-600" />
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
        <AlertTriangle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Esta pantalla administra los indicadores operativos sobre el catálogo institucional
          existente. Para agregar personas nuevas, darlas de alta primero en{' '}
          <span className="font-semibold">entidades_relacionadas</span> con tipo Proveedor (8)
          o Personal de mantenimiento (22).
        </p>
      </div>

      {/* Búsqueda */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
          <input
            className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            placeholder="Buscar por nombre o tipo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          {search
            ? `Sin resultados para "${search}"`
            : 'Sin entidades en el catálogo para los tipos habilitados (8, 22).'}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Persona / Empresa</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tipo institucional</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Supervisor Entregas</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Técnico Entregas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(er => (
                <tr key={er.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{er.nombre}</p>
                    {er.id_proyecto && (
                      <p className="text-[10px] text-slate-400">Proyecto #{er.id_proyecto}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-medium">
                      {er.tipo_nombre}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RolToggle
                      active={er.es_supervisor}
                      label={er.es_supervisor ? 'Habilitado' : 'Deshab.'}
                      colorOn="text-blue-600 bg-blue-50"
                      icon={UserCheck}
                      saving={saving === er.id}
                      onClick={() => toggle(er, 'es_supervisor_entregas')}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RolToggle
                      active={er.es_tecnico}
                      label={er.es_tecnico ? 'Habilitado' : 'Deshab.'}
                      colorOn="text-orange-600 bg-orange-50"
                      icon={Wrench}
                      saving={saving === er.id}
                      onClick={() => toggle(er, 'es_tecnico_entregas')}
                    />
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
