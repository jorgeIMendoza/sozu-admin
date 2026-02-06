import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectAccess } from "@/hooks/useProjectAccess";

interface Comprador {
  nombre_legal: string;
  rfc: string | null;
  porcentaje_copropiedad: number;
  id_persona?: number;
}

interface Residente {
  id_persona: number;
  nombre_legal: string;
  activo: boolean;
}

interface BodegaDetalle {
  nombre: string;
  m2: number;
  ubicacion?: string;
  es_incluido: boolean;
}

interface EstacionamientoDetalle {
  nombre: string;
  tipo: string;
  m2: number;
  ubicacion?: string;
  es_incluido: boolean;
}

interface ProductoDetalle {
  nombre: string;
  categoria: string;
  precio: number;
}

export interface CuentaMantenimiento {
  id: number;
  clabe_stp: string | null;
  precio_final: number;
  pagado: number;
  total_pagos: number;
  restante: number;
  compradores: Comprador[];
  residentes: Residente[];
  dueno: string;
  proyecto: string;
  edificio: string;
  numero_propiedad: string;
  modelo: string;
  clave_catastral: string | null;
  activo: boolean;
  id_oferta: number;
  tiene_multas_pendientes?: boolean;
  id_propiedad?: number;
  bodegas?: BodegaDetalle[];
  estacionamientos?: EstacionamientoDetalle[];
  productos?: ProductoDetalle[];
  proxima_fecha_pago?: string | null;
}

interface UseCuentasMantenimientoParams {
  page: number;
  perPage?: number;
  idCuenta?: string;
  propietarios?: string;
  clabe?: string;
  proyecto?: string;
  noPropiedad?: string;
  modelo?: string;
  claveCatastral?: string;
  search?: string;
  enabled?: boolean;
}

interface CuentaMantenimientoRPCResult {
  id: number;
  clabe_stp: string | null;
  activo: boolean;
  id_oferta: number;
  id_cuenta_cobranza_padre: number;
  numero_propiedad: string | null;
  clave_catastral: string | null;
  id_propiedad: number | null;
  proyecto: string | null;
  id_proyecto: number | null;
  edificio: string | null;
  modelo: string | null;
  dueno: string | null;
  pago_acumulado: number | null;
  total_pagado: number | null;
  saldo_pendiente: number | null;
  compradores_json: Array<{ id_persona: number; nombre_legal: string; rfc: string | null; porcentaje_copropiedad: number }> | null;
  residentes_json: Array<{ id_persona: number; nombre_legal: string; activo: boolean }> | null;
  proxima_fecha_pago: string | null;
  tiene_multas_pendientes: boolean | null;
  bodegas_json: BodegaDetalle[] | null;
  estacionamientos_json: EstacionamientoDetalle[] | null;
  productos_json: ProductoDetalle[] | null;
  total_count: number;
}

export function useCuentasMantenimientoPaginadas({
  page,
  perPage = 50,
  idCuenta,
  propietarios,
  clabe,
  proyecto,
  noPropiedad,
  modelo,
  claveCatastral,
  search,
  enabled = true,
}: UseCuentasMantenimientoParams) {
  const {
    accessibleProjectIds,
    hasUnrestrictedAccess,
    isLoading: isLoadingAccess,
    isRepresentanteEmpresaDuena,
    ownershipEntityIds,
  } = useProjectAccess();

  return useQuery({
    queryKey: [
      "cuentas_mantenimiento_paginadas",
      page,
      perPage,
      idCuenta,
      propietarios,
      clabe,
      proyecto,
      noPropiedad,
      modelo,
      claveCatastral,
      search,
      hasUnrestrictedAccess,
      accessibleProjectIds,
      ownershipEntityIds,
    ],
    enabled: enabled && !isLoadingAccess,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cuentas_mantenimiento_paginadas' as any, {
        p_page: page,
        p_per_page: perPage,
        p_id_cuenta: idCuenta || null,
        p_propietarios: propietarios || null,
        p_clabe: clabe || null,
        p_proyecto: proyecto || null,
        p_no_propiedad: noPropiedad || null,
        p_modelo: modelo || null,
        p_clave_catastral: claveCatastral || null,
        p_search: search || null,
        p_proyecto_ids: hasUnrestrictedAccess ? null : (accessibleProjectIds.length > 0 ? accessibleProjectIds : null),
        p_dueno_entity_ids: isRepresentanteEmpresaDuena && ownershipEntityIds.length > 0 ? ownershipEntityIds : null,
      });

      if (error) {
        console.error('Error fetching cuentas mantenimiento:', error);
        throw error;
      }

      const result = (data as unknown as CuentaMantenimientoRPCResult[]) || [];
      const totalCount = result.length > 0 ? result[0].total_count : 0;

      const cuentas: CuentaMantenimiento[] = result.map(row => {
        const pagoAcumulado = Number(row.pago_acumulado) || 0;
        const totalPagado = Number(row.total_pagado) || 0;
        let saldo = pagoAcumulado - totalPagado;
        saldo = Math.round(saldo * 100) / 100;
        if (Math.abs(saldo) < 0.01) saldo = 0;
        saldo = +saldo.toFixed(2);

        const compradores = (row.compradores_json || []).map(c => ({
          nombre_legal: c.nombre_legal,
          rfc: c.rfc,
          porcentaje_copropiedad: c.porcentaje_copropiedad,
          id_persona: c.id_persona,
        }));

        const residentes = (row.residentes_json || []).map(r => ({
          id_persona: r.id_persona,
          nombre_legal: r.nombre_legal,
          activo: r.activo,
        }));

        return {
          id: row.id,
          clabe_stp: row.clabe_stp,
          precio_final: pagoAcumulado,
          pagado: totalPagado,
          total_pagos: totalPagado,
          restante: saldo,
          compradores,
          residentes,
          dueno: row.dueno || 'Sin dueño',
          proyecto: row.proyecto || 'Sin proyecto',
          edificio: row.edificio || 'Sin edificio',
          numero_propiedad: row.numero_propiedad || 'Sin número',
          modelo: row.modelo || 'Sin modelo',
          clave_catastral: row.clave_catastral,
          activo: row.activo,
          id_oferta: row.id_oferta,
          tiene_multas_pendientes: row.tiene_multas_pendientes || false,
          id_propiedad: row.id_propiedad || undefined,
          proxima_fecha_pago: row.proxima_fecha_pago,
          bodegas: (row.bodegas_json || []).map(b => ({
            nombre: b.nombre,
            m2: b.m2,
            ubicacion: b.ubicacion,
            es_incluido: b.es_incluido,
          })),
          estacionamientos: (row.estacionamientos_json || []).map(e => ({
            nombre: e.nombre,
            tipo: e.tipo,
            m2: e.m2,
            ubicacion: e.ubicacion,
            es_incluido: e.es_incluido,
          })),
          productos: (row.productos_json || []).map(p => ({
            nombre: p.nombre,
            categoria: p.categoria,
            precio: p.precio,
          })),
        };
      });

      return {
        cuentas,
        totalCount,
        totalPages: Math.ceil(totalCount / perPage),
      };
    },
  });
}
