import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCobranzaImpersonation } from '@/contexts/CobranzaImpersonationContext';

export interface DashboardKPIs {
  cobrado_total: number;
  vencido_total: number;
  vencido_total_sin_ce: number;
  pendiente_total: number;
  cobrado_mes: number;
  programado_mes: number;
  programado_mes_sin_ce: number;
  por_cobrar_mes: number;
  por_cobrar_mes_sin_ce: number;
  recovery_rate: number;
  aging: { rango: string; monto: number; monto_sin_ce: number; cantidad: number }[] | null;
  morosidad: { grupo: string; cuentas: number }[] | null;
  por_proyecto: { proyecto: string; proyecto_id: number; cobrado: number; vencido: number; pendiente: number }[] | null;
  cobrado_mensual: { mes: string; cobrado: number }[] | null;
  programado_mensual: { mes: string; programado: number; programado_sin_ce: number }[] | null;
}

export function useCobranzaDashboard(
  proyectoId?: number | null,
  fechaInicio?: string | null,
  fechaFin?: string | null,
  entidadIds?: number[] | null,
) {
  return useQuery({
    queryKey: ['cobranza-dashboard-kpis', proyectoId, fechaInicio, fechaFin, entidadIds],
    queryFn: async (): Promise<DashboardKPIs> => {
      const { data, error } = await supabase.rpc('get_dashboard_cobranza_kpis', {
        p_proyecto_id: proyectoId ?? null,
        p_fecha_inicio: fechaInicio ?? null,
        p_fecha_fin: fechaFin ?? null,
        p_entidad_ids: entidadIds && entidadIds.length > 0 ? entidadIds : null,
      } as any);
      if (error) throw error;
      return data as unknown as DashboardKPIs;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Returns only projects the current user has access to via proyectos_acceso.
 * Super Admins (rol_id 1) and Admins (rol_id 2) see all active projects.
 */
export function useProyectosCobranza() {
  const { user, profile } = useAuth();
  const { impersonatedEmail, impersonatedRoleId, isImpersonating } = useCobranzaImpersonation();
  const effectiveEmail = isImpersonating ? impersonatedEmail : user?.email;
  const effectiveRoleId = isImpersonating ? impersonatedRoleId : profile?.rol_id;
  const hasFullProjectAccess = effectiveRoleId === 1 || effectiveRoleId === 2;

  return useQuery({
    queryKey: ['cobranza-proyectos-filtro', effectiveEmail, effectiveRoleId, isImpersonating],
    queryFn: async () => {
      if (!effectiveEmail && !hasFullProjectAccess) return [];

      if (hasFullProjectAccess) {
        // Step 1: proyectos con cuenta_madre_stp configurada (operan con SOZU)
        const { data: erData, error: erErr } = await (supabase as any)
          .from('entidades_relacionadas')
          .select('id_proyecto')
          .not('cuenta_madre_stp', 'is', null)
          .eq('activo', true);
        if (erErr) throw erErr;
        const erpIds = [...new Set(((erData ?? []) as any[]).map((r) => r.id_proyecto as number))];
        if (!erpIds.length) return [];

        // Step 2: solo proyectos con edificios (desarrollos reales, no cubetas)
        const { data: edifData, error: edifErr } = await (supabase as any)
          .from('edificios')
          .select('id_proyecto')
          .in('id_proyecto', erpIds);
        if (edifErr) throw edifErr;
        const validIds = [...new Set(((edifData ?? []) as any[]).map((e) => e.id_proyecto as number))];
        if (!validIds.length) return [];

        // Step 3: datos del proyecto
        const { data, error } = await supabase
          .from('proyectos')
          .select('id, nombre')
          .in('id', validIds)
          .order('nombre');
        if (error) throw error;
        return data ?? [];
      }

      // Other roles: filter by proyectos_acceso
      const { data: accesos, error: accError } = await supabase
        .from('proyectos_acceso')
        .select('proyecto_id, proyectos!proyectos_acceso_proyecto_id_fkey(id, nombre)')
        .eq('usuario_id', effectiveEmail)
        .eq('activo', true) as any;

      if (accError) throw accError;
      if (!accesos) return [];

      return accesos
        .filter((a: any) => a.proyectos)
        .map((a: any) => ({ id: a.proyectos.id, nombre: a.proyectos.nombre }))
        .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    },
    enabled: hasFullProjectAccess || !!effectiveEmail,
    staleTime: 30 * 60 * 1000,
  });
}

export interface PipelineKPIs {
  vendidas: number;
  listas_escrituracion: number;
  en_escrituracion: number;
  entregadas: number;
  pagadas_completamente: number;
  ceps_faltantes: number;
}

const EMPTY_PIPELINE: PipelineKPIs = { vendidas: 0, listas_escrituracion: 0, en_escrituracion: 0, entregadas: 0, pagadas_completamente: 0, ceps_faltantes: 0 };

export function useCobranzaPipelineKPIs(proyectoId?: number | null, accessibleProjectIds?: number[] | null) {
  return useQuery({
    queryKey: ['cobranza-pipeline-kpis', proyectoId, accessibleProjectIds?.join(',')],
    queryFn: async (): Promise<PipelineKPIs> => {
      // Step 1: get prop ids by estatus (5=Vendida, 7=Escrituración, 8=Entregada, 9=Pagada)
      // .limit(10000) avoids default 1000-row truncation across ~8k+ propiedades vendidas
      let propQuery = (supabase as any)
        .from('propiedades')
        .select('id, id_estatus_disponibilidad')
        .in('id_estatus_disponibilidad', [5, 7, 8, 9])
        .eq('activo', true)
        .limit(10000);

      const scopeIds = proyectoId ? [proyectoId] : (accessibleProjectIds ?? []);
      let modIds: number[] = [];
      if (scopeIds.length > 0) {
        const { data: edifs } = await supabase
          .from('edificios')
          .select('id')
          .in('id_proyecto', scopeIds)
          .eq('activo', true);
        if (!edifs?.length) return EMPTY_PIPELINE;

        const { data: mods } = await supabase
          .from('edificios_modelos')
          .select('id')
          .in('id_edificio', edifs.map((e: any) => e.id));
        if (!mods?.length) return EMPTY_PIPELINE;

        modIds = mods.map((m: any) => m.id as number);
        propQuery = propQuery.in('id_edificio_modelo', modIds);
      }

      const { data: props } = await propQuery;
      if (!props?.length) return EMPTY_PIPELINE;

      const byEstatus: Record<number, number[]> = {};
      for (const p of props) {
        if (!byEstatus[p.id_estatus_disponibilidad]) byEstatus[p.id_estatus_disponibilidad] = [];
        byEstatus[p.id_estatus_disponibilidad].push(p.id);
      }

      const allPropIds = Object.values(byEstatus).flat();

      // Conteos por propiedad (no por cuenta_cobranza — una prop puede tener varias cuentas)
      const vendidas = byEstatus[5]?.length ?? 0;
      const en_escrituracion = byEstatus[7]?.length ?? 0;
      const entregadas = byEstatus[8]?.length ?? 0;
      const pagadas_completamente = byEstatus[9]?.length ?? 0;

      // Step 3: listas = propiedades vendidas donde bool_and(acuerdos_pago.pago_completado) = true
      // para TODAS sus cuentas_cobranza activas (excl. canceladas).
      // Equivale al query SQL provisto por usuario (bool_and sobre todas las cuentas de la prop).
      let listas_escrituracion = 0;
      // Candidatas = todas las propiedades en scope que NO han sido promovidas aún
      // El estatus manda: excluir 7 (escrituración), 8 (entregada), 9 (pagada)
      const yaPromovidas = new Set([
        ...(byEstatus[7] ?? []),
        ...(byEstatus[8] ?? []),
        ...(byEstatus[9] ?? []),
      ]);
      const propCandidatas = allPropIds.filter(pid => !yaPromovidas.has(pid));
      if (propCandidatas.length) {
        // 3a: cuentas para propiedades candidatas, sin cancelación
        const { data: cvData } = await (supabase as any)
          .from('cuentas_cobranza')
          .select('id, id_propiedad, precio_final')
          .in('id_propiedad', propCandidatas)
          .is('id_tipo_cancelacion', null)
          .eq('activo', true)
          .limit(50000);

        // prop → cuentaIds + max precio_final
        const propCuentas = new Map<number, number[]>();
        const propMaxPrecio = new Map<number, number>();
        for (const c of ((cvData ?? []) as any[])) {
          const pid = c.id_propiedad as number;
          if (!propCuentas.has(pid)) propCuentas.set(pid, []);
          propCuentas.get(pid)!.push(c.id as number);
          const prev = propMaxPrecio.get(pid) ?? 0;
          if (Number(c.precio_final) > prev) propMaxPrecio.set(pid, Number(c.precio_final));
        }

        // Excluir apartados ($29k): max precio_final > 100000
        const propsValidas = propCandidatas.filter(pid => (propMaxPrecio.get(pid) ?? 0) > 100000);
        const cuentasValidas = propsValidas.flatMap(pid => propCuentas.get(pid) ?? []);

        if (cuentasValidas.length) {
          // 3b: todos los acuerdos para esas cuentas (no filtrar por pago_completado)
          // Necesitamos saber: (a) cuáles cuentas tienen al menos 1 acuerdo,
          //                    (b) cuáles tienen algún acuerdo pendiente (pago_completado=false)
          // Equivale al INNER JOIN del SQL: si no hay acuerdos, propiedad NO aparece
          const { data: allAcuerdos } = await (supabase as any)
            .from('acuerdos_pago')
            .select('id_cuenta_cobranza, pago_completado')
            .in('id_cuenta_cobranza', cuentasValidas)
            .limit(100000);

          const cuentaConAcuerdos = new Set<number>();
          const cuentasConPend = new Set<number>();
          for (const a of ((allAcuerdos ?? []) as any[])) {
            cuentaConAcuerdos.add(a.id_cuenta_cobranza as number);
            if (!a.pago_completado) cuentasConPend.add(a.id_cuenta_cobranza as number);
          }

          // Escriturable = todas sus cuentas tienen acuerdos Y ninguna tiene pendientes
          // bool_and(pago_completado) del SQL — si una cuenta no tiene acuerdos, no escriturable
          listas_escrituracion = propsValidas.filter(pid => {
            const cuentas = propCuentas.get(pid) ?? [];
            return (
              cuentas.length > 0 &&
              cuentas.every(cId => cuentaConAcuerdos.has(cId)) &&
              !cuentas.some(cId => cuentasConPend.has(cId))
            );
          }).length;
        }
      }


      return {
        vendidas,
        listas_escrituracion,
        en_escrituracion,
        entregadas,
        pagadas_completamente,
        ceps_faltantes: 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
