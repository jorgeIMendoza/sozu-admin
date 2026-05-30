import { Bell, Download, ChevronDown, Loader2 } from 'lucide-react';
import { EscrituracionDashboardProvider, useEscrituracionDashboard, ProyectoActivo } from '@/contexts/EscrituracionDashboardContext';
import { KpisSection } from '@/components/admin/portal-escrituracion/dashboard/KpisSection';
import { PipelineNotarial } from '@/components/admin/portal-escrituracion/dashboard/PipelineNotarial';
import { ExpedientesTable } from '@/components/admin/portal-escrituracion/dashboard/ExpedientesTable';
import { RightDetailPanel } from '@/components/admin/portal-escrituracion/dashboard/RightDetailPanel';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface DashboardKpis {
  inventario: number;
  escriturados: number;
  expedientesDocumentos: number;
  relacionPagos: number;
  alertasPld: number;
  enProceso: number;
  recursosPropios: number;
  creditoHipotecario: number;
  citas: number;
  demandas: number;
  entregas: number;
  postventa: number;
}

const KPIS_ZERO: DashboardKpis = {
  inventario: 0, escriturados: 0, expedientesDocumentos: 0, relacionPagos: 0,
  alertasPld: 0, enProceso: 0, recursosPropios: 0, creditoHipotecario: 0,
  citas: 0, demandas: 0, entregas: 0, postventa: 0,
};

function DashboardHeader() {
  const {
    proyectoActivo, setProyectoActivo,
    setInventarioActivo, setEscrituradosActivo, setExpedientesDocumentosActivo,
    setRelacionPagosActivo, setAlertasPldActivo, setEnProcesoActivo,
    setRecursosPropiosActivo, setCreditoHipotecarioActivo, setCitasActivo,
    setDemandasActivo, setEntregasActivo, setPostventaActivo,
  } = useEscrituracionDashboard();

  // 1. Proyectos SOZU publicados (carga única, no depende del proyecto activo)
  const { data: proyectos, isLoading: isLoadingProyectos } = useQuery({
    queryKey: ['proyectos-escrituracion-sozu'],
    queryFn: async () => {
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

  // 2. Query consolidada de KPIs — waterfall obligatorio
  const { data: allKpis } = useQuery({
    queryKey: ['dashboard-kpis', proyectoActivo?.id],
    queryFn: async (): Promise<DashboardKpis> => {
      if (!proyectoActivo?.id) return KPIS_ZERO;

      // Waterfall: edificios → modelos
      const { data: edificios } = await supabase
        .from('edificios').select('id')
        .eq('id_proyecto', proyectoActivo.id).eq('activo', true);
      if (!edificios?.length) return KPIS_ZERO;

      const { data: modelos } = await supabase
        .from('edificios_modelos').select('id')
        .in('id_edificio', edificios.map(e => e.id));
      if (!modelos?.length) return KPIS_ZERO;
      const modeloIds = modelos.map(m => m.id);

      // Propiedades del proyecto
      const { data: propiedades } = await supabase
        .from('propiedades').select('id, id_estatus_disponibilidad')
        .in('id_edificio_modelo', modeloIds).eq('activo', true);
      const allProps = propiedades || [];
      if (!allProps.length) return KPIS_ZERO;

      const allPropIds = allProps.map(p => p.id);
      const propStatusMap: Record<number, number> = {};
      for (const p of allProps) propStatusMap[p.id] = p.id_estatus_disponibilidad;

      // Cuentas de cobranza del proyecto
      const { data: cuentas } = await supabase
        .from('cuentas_cobranza').select('id, id_propiedad, id_notario, numero_escritura')
        .in('id_propiedad', allPropIds);
      const allCuentas = cuentas || [];
      const allCuentaIds = allCuentas.map(c => c.id);

      // Queries paralelas (todas sobre cuentaIds ya conocidos)
      const [
        pagosRes,
        demandasRes,
        docsExpRes,
        docsPvRes,
        creditosRes,
        tiposCitaRes,
        reservasCitasRes,
      ] = await Promise.allSettled([
        allCuentaIds.length
          ? supabase.from('pagos').select('id_cuenta_cobranza, clave_rastreo')
              .in('id_cuenta_cobranza', allCuentaIds)
          : Promise.resolve({ data: [] as any[], error: null }),

        allCuentaIds.length
          ? supabase.from('demandas').select('id_cuenta_cobranza')
              .in('id_cuenta_cobranza', allCuentaIds)
          : Promise.resolve({ data: [] as any[], error: null }),

        allCuentaIds.length
          ? supabase.from('documentos').select('id_cuenta_cobranza')
              .in('id_cuenta_cobranza', allCuentaIds)
              .gte('id_estatus_verificacion', 2).eq('activo', true)
          : Promise.resolve({ data: [] as any[], error: null }),

        allCuentaIds.length
          ? supabase.from('documentos').select('id_cuenta_cobranza')
              .in('id_cuenta_cobranza', allCuentaIds)
              .eq('id_tipo_documento', 24).eq('activo', true)
          : Promise.resolve({ data: [] as any[], error: null }),

        // creditos_hipotecarios: tabla post-DDL, graceful fallback
        allCuentaIds.length
          ? (supabase as any).from('creditos_hipotecarios').select('id_cuenta_cobranza')
              .in('id_cuenta_cobranza', allCuentaIds)
          : Promise.resolve({ data: [] as any[], error: null }),

        supabase.from('tipos_cita').select('id, nombre').eq('activo', true),

        supabase.from('reservas_citas').select('id_tipo_cita')
          .eq('id_proyecto', proyectoActivo.id).eq('activo', true),
      ]);

      // ── Inventario / Escriturados / Entregas (solo propiedades) ──
      const inventario = allProps.length;
      const escriturados = allProps.filter(
        p => p.id_estatus_disponibilidad === 7 || p.id_estatus_disponibilidad === 8
      ).length;
      const entregas = allProps.filter(p => p.id_estatus_disponibilidad === 8).length;

      // ── Relación Pagos / Alertas PLD ──
      const pagos: any[] = pagosRes.status === 'fulfilled' ? (pagosRes.value as any)?.data ?? [] : [];
      const pagoCuentaSet = new Set(pagos.map(p => p.id_cuenta_cobranza));
      const alertaCuentaSet = new Set(pagos.filter(p => !p.clave_rastreo).map(p => p.id_cuenta_cobranza));
      const relacionPagos = pagoCuentaSet.size;
      const alertasPld = alertaCuentaSet.size;

      // ── Demandas (dual-source: prop estatus 11 OR registro en tabla demandas) ──
      const demandasRows: any[] = demandasRes.status === 'fulfilled' ? (demandasRes.value as any)?.data ?? [] : [];
      const demandaCuentaSet = new Set(demandasRows.map(d => d.id_cuenta_cobranza));
      const prop11CuentaSet = new Set(
        allCuentas
          .filter(c => c.id_propiedad != null && propStatusMap[c.id_propiedad] === 11)
          .map(c => c.id)
      );
      const demandas = new Set([...prop11CuentaSet, ...demandaCuentaSet]).size;

      // ── Expedientes Documentos ──
      const docsExp: any[] = docsExpRes.status === 'fulfilled' ? (docsExpRes.value as any)?.data ?? [] : [];
      const expedientesDocumentos = new Set(docsExp.map(d => d.id_cuenta_cobranza)).size;

      // ── Postventa ──
      const docsPv: any[] = docsPvRes.status === 'fulfilled' ? (docsPvRes.value as any)?.data ?? [] : [];
      const postventaSet = new Set(docsPv.map(d => d.id_cuenta_cobranza));
      const postventa = postventaSet.size || entregas;

      // ── En Proceso (tiene notario asignado pero sin escritura) ──
      const enProceso = allCuentas.filter(c => c.id_notario && !c.numero_escritura).length;

      // ── Crédito Hipotecario (post-DDL, graceful fallback) ──
      const creditosRows: any[] = creditosRes.status === 'fulfilled' ? (creditosRes.value as any)?.data ?? [] : [];
      const cuentasConCreditoSet = new Set(creditosRows.map(c => c.id_cuenta_cobranza));
      const creditoHipotecario = cuentasConCreditoSet.size;

      // ── Recursos Propios (tienen notario pero no crédito hipotecario) ──
      const recursosPropios = allCuentas
        .filter(c => c.id_notario && !cuentasConCreditoSet.has(c.id))
        .length;

      // ── Citas de escrituración ──
      const tiposCita: any[] = tiposCitaRes.status === 'fulfilled' ? (tiposCitaRes.value as any)?.data ?? [] : [];
      const tiposCitaEscrituracionIds = new Set(
        tiposCita
          .filter(t => /escritur|firm|notari/i.test(t.nombre || ''))
          .map(t => t.id)
      );
      const reservasCitas: any[] = reservasCitasRes.status === 'fulfilled' ? (reservasCitasRes.value as any)?.data ?? [] : [];
      const citas = reservasCitas.filter(r => tiposCitaEscrituracionIds.has(r.id_tipo_cita)).length;

      return {
        inventario, escriturados, expedientesDocumentos, relacionPagos,
        alertasPld, enProceso, recursosPropios, creditoHipotecario,
        citas, demandas, entregas, postventa,
      };
    },
    enabled: !!proyectoActivo?.id,
  });

  // Propagar todos los KPIs al contexto en un solo efecto
  useEffect(() => {
    if (!allKpis) return;
    setInventarioActivo(allKpis.inventario);
    setEscrituradosActivo(allKpis.escriturados);
    setExpedientesDocumentosActivo(allKpis.expedientesDocumentos);
    setRelacionPagosActivo(allKpis.relacionPagos);
    setAlertasPldActivo(allKpis.alertasPld);
    setEnProcesoActivo(allKpis.enProceso);
    setRecursosPropiosActivo(allKpis.recursosPropios);
    setCreditoHipotecarioActivo(allKpis.creditoHipotecario);
    setCitasActivo(allKpis.citas);
    setDemandasActivo(allKpis.demandas);
    setEntregasActivo(allKpis.entregas);
    setPostventaActivo(allKpis.postventa);
  }, [allKpis]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        {/* Título con tokens del design system */}
        <h1 style={{ fontSize: 'var(--sz-text-2xl)', fontWeight: 700, color: 'var(--sz-text-primary)', margin: 0, lineHeight: 1.2 }}>
          Dashboard de Escrituración
        </h1>
        <p style={{ fontSize: 'var(--sz-text-sm)', color: 'var(--sz-text-muted)', marginTop: 3 }}>
          Seguimiento del proceso notarial y escrituración
        </p>

        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 'var(--sz-text-sm)', fontWeight: 500, color: 'var(--sz-text-secondary)' }}>Proyecto</span>
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
                    style={{
                      height: 'var(--sz-input-h)',
                      padding: '0 32px 0 12px',
                      border: '1px solid var(--sz-border)',
                      borderRadius: 'var(--sz-radius-md)',
                      fontSize: 'var(--sz-text-base)',
                      fontWeight: 500,
                      color: 'var(--sz-text-primary)',
                      background: 'var(--sz-surface)',
                      outline: 'none',
                      appearance: 'none',
                      cursor: 'pointer',
                      boxShadow: 'var(--sz-shadow-sm)',
                      transition: 'var(--sz-transition)',
                    }}
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
