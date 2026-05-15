import { Bell, Download, ChevronDown, Loader2 } from 'lucide-react';
import { EscrituracionDashboardProvider, useEscrituracionDashboard, ProyectoActivo } from '@/contexts/EscrituracionDashboardContext';
import { KpisSection } from '@/components/admin/portal-escrituracion/dashboard/KpisSection';
import { PipelineNotarial } from '@/components/admin/portal-escrituracion/dashboard/PipelineNotarial';
import { ExpedientesTable } from '@/components/admin/portal-escrituracion/dashboard/ExpedientesTable';
import { RightDetailPanel } from '@/components/admin/portal-escrituracion/dashboard/RightDetailPanel';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

function DashboardHeader() {
  const { proyectoActivo, setProyectoActivo, setInventarioActivo, setEscrituradosActivo, setDemandasActivo, setEntregasActivo } = useEscrituracionDashboard();

  // 1. Obtener proyectos SOZU publicados
  const { data: proyectos, isLoading: isLoadingProyectos } = useQuery({
    queryKey: ['proyectos-escrituracion-sozu'],
    queryFn: async () => {
      // Proyectos vinculados a inmobiliaria (id_tipo_entidad = 5)
      const { data: sozuRels } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);
        
      const sozuIds = sozuRels?.map(r => r.id_proyecto).filter(Boolean) || [];
      if (sozuIds.length === 0) return [];

      const { data: proys } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .in('id', sozuIds)
        .eq('publicar', true)
        .eq('activo', true)
        .order('nombre');

      return (proys || []) as ProyectoActivo[];
    }
  });

  // Autoseleccionar el primer proyecto si no hay ninguno activo
  useEffect(() => {
    if (proyectos && proyectos.length > 0 && !proyectoActivo) {
      setProyectoActivo(proyectos[0]);
    }
  }, [proyectos, proyectoActivo, setProyectoActivo]);

  // 2. Obtener los IDs de modelos del proyecto activo (base para los conteos de KPIs)
  const { data: modeloIds } = useQuery({
    queryKey: ['modelo-ids', proyectoActivo?.id],
    queryFn: async () => {
      if (!proyectoActivo?.id) return [];

      const { data: edificios } = await supabase
        .from('edificios')
        .select('id')
        .eq('id_proyecto', proyectoActivo.id)
        .eq('activo', true);

      if (!edificios?.length) return [];

      const { data: modelos } = await supabase
        .from('edificios_modelos')
        .select('id')
        .in('id_edificio', edificios.map(e => e.id));

      return modelos?.map(m => m.id) ?? [];
    },
    enabled: !!proyectoActivo?.id,
  });

  // 3. Inventario: total de unidades activas
  const { data: inventarioCount } = useQuery({
    queryKey: ['inventario-activo', proyectoActivo?.id],
    queryFn: async () => {
      if (!modeloIds?.length) return 0;
      const { count, error } = await supabase
        .from('propiedades')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)
        .in('id_edificio_modelo', modeloIds);
      if (error) { console.error('Error fetching inventario:', error); return 0; }
      return count || 0;
    },
    enabled: !!modeloIds?.length,
  });

  // 4. Escriturados: unidades escrituradas y/o entregadas (estatus 7, 8, 9)
  const { data: escrituradosCount } = useQuery({
    queryKey: ['escriturados-activo', proyectoActivo?.id],
    queryFn: async () => {
      if (!modeloIds?.length) return 0;
      const { count, error } = await supabase
        .from('propiedades')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)
        .in('id_estatus_disponibilidad', [7, 8])
        .in('id_edificio_modelo', modeloIds);
      if (error) { console.error('Error fetching escriturados:', error); return 0; }
      return count || 0;
    },
    enabled: !!modeloIds?.length,
  });

  // 5. Demandas: unidades con estatus "En demanda" (id 11)
  const { data: demandasCount } = useQuery({
    queryKey: ['demandas-activo', proyectoActivo?.id],
    queryFn: async () => {
      if (!modeloIds?.length) return 0;
      const { count, error } = await supabase
        .from('propiedades')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)
        .eq('id_estatus_disponibilidad', 11)
        .in('id_edificio_modelo', modeloIds);
      if (error) { console.error('Error fetching demandas:', error); return 0; }
      return count || 0;
    },
    enabled: !!modeloIds?.length,
  });

  // 6. Entregas: unidades con estatus "Entregado" (id 8)
  const { data: entregasCount } = useQuery({
    queryKey: ['entregas-activo', proyectoActivo?.id],
    queryFn: async () => {
      if (!modeloIds?.length) return 0;
      const { count, error } = await supabase
        .from('propiedades')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)
        .eq('id_estatus_disponibilidad', 8)
        .in('id_edificio_modelo', modeloIds);
      if (error) { console.error('Error fetching entregas:', error); return 0; }
      return count || 0;
    },
    enabled: !!modeloIds?.length,
  });

  // Actualizar contexto cuando se cargan los conteos
  useEffect(() => {
    if (inventarioCount !== undefined) setInventarioActivo(inventarioCount);
  }, [inventarioCount, setInventarioActivo]);

  useEffect(() => {
    if (escrituradosCount !== undefined) setEscrituradosActivo(escrituradosCount);
  }, [escrituradosCount, setEscrituradosActivo]);

  useEffect(() => {
    if (demandasCount !== undefined) setDemandasActivo(demandasCount);
  }, [demandasCount, setDemandasActivo]);

  useEffect(() => {
    if (entregasCount !== undefined) setEntregasActivo(entregasCount);
  }, [entregasCount, setEntregasActivo]);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Dashboard de Escrituración</h1>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Proyecto</span>
            <div className="relative">
              {isLoadingProyectos ? (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-sm font-medium text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
                </div>
              ) : (
                <>
                  <select
                    value={proyectoActivo?.id || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const p = proyectos?.find(x => x.id === id);
                      if (p) setProyectoActivo(p);
                    }}
                    className="appearance-none bg-white border border-slate-200 rounded-lg py-1.5 pl-3 pr-8 text-sm font-medium text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    {proyectos?.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs text-slate-400 hidden sm:inline-block">Última actualización: 23 May 2026, 11:30 a.m.</span>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors shadow-sm">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          
          <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardContent() {
  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 font-sans bg-slate-50/50 min-h-screen">
      <DashboardHeader />
      <KpisSection />
      <PipelineNotarial />
      
      <div className="flex flex-col lg:flex-row gap-6 relative">
        <ExpedientesTable />
        <RightDetailPanel />
      </div>
    </div>
  );
}

export function DashboardEscrituracion() {
  return (
    <EscrituracionDashboardProvider>
      <DashboardContent />
    </EscrituracionDashboardProvider>
  );
}
