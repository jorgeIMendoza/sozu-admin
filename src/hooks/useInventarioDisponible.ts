import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectAccess } from '@/hooks/useProjectAccess';

export interface InventarioPropiedad {
  id: number;
  numero_propiedad: string;
  numero_piso: string | null;
  precio_lista: number;
  m2_interiores: number;
  m2_exteriores: number;
  proyecto_id: number;
  proyecto_nombre: string;
  edificio_nombre: string;
  modelo_id: number;
  modelo_nombre: string;
  numero_recamaras: number;
  numero_completo_banos: number;
  numero_medio_bano: number;
  bodegas_count: number;
  estacionamientos_count: number;
  estacionamientos_tipos: string[];
  propiedad_imagenes: { id: number; url: string }[];
  modelo_imagenes: { id: number; url: string }[];
  esquemas_pago: {
    id: number;
    nombre: string;
    id_proyecto: number;
    porcentaje_enganche: number;
    porcentaje_mensualidades: number;
    porcentaje_entrega: number;
    numero_mensualidades: number;
    porcentaje_descuento_aumento: number;
  }[];
}

export function useInventarioDisponible() {
  const { accessibleProjectIds, hasUnrestrictedAccess, isLoading: isLoadingAccess, hasNoAccess } = useProjectAccess();

  const { data: propiedades = [], isLoading: isLoadingData } = useQuery({
    queryKey: ['inventario-disponible', hasUnrestrictedAccess ? 'all' : accessibleProjectIds],
    queryFn: async () => {
      if (hasNoAccess) return [];

      const params: { p_accessible_project_ids?: number[] } = {};
      if (!hasUnrestrictedAccess && accessibleProjectIds.length > 0) {
        params.p_accessible_project_ids = accessibleProjectIds;
      }

      const { data, error } = await supabase.rpc(
        'get_inventario_disponible' as any,
        params as any
      );

      if (error) {
        console.error('Error fetching inventario disponible:', error);
        return [];
      }

      // The RPC now returns { propiedades, modelo_imagenes, esquemas_pago_proyecto }
      const result = data as any;
      
      // Handle both old format (flat array) and new format (object with separate maps)
      if (Array.isArray(result)) {
        // Old format - return as-is
        return (result as unknown as InventarioPropiedad[]) || [];
      }

      const rawProps = (result?.propiedades || []) as any[];
      const modeloImagenesMap = (result?.modelo_imagenes || {}) as Record<string, { id: number; url: string }[]>;
      const esquemasPagoMap = (result?.esquemas_pago_proyecto || {}) as Record<string, any[]>;

      // Assemble: attach modelo_imagenes and esquemas_pago from the deduplicated maps
      return rawProps.map((p: any): InventarioPropiedad => ({
        id: p.id,
        numero_propiedad: p.numero_propiedad,
        numero_piso: p.numero_piso,
        precio_lista: p.precio_lista,
        m2_interiores: p.m2_interiores,
        m2_exteriores: p.m2_exteriores,
        proyecto_id: p.proyecto_id,
        proyecto_nombre: p.proyecto_nombre,
        edificio_nombre: p.edificio_nombre,
        modelo_id: p.modelo_id,
        modelo_nombre: p.modelo_nombre,
        numero_recamaras: p.numero_recamaras,
        numero_completo_banos: p.numero_completo_banos,
        numero_medio_bano: p.numero_medio_bano,
        bodegas_count: p.bodegas_count,
        estacionamientos_count: p.estacionamientos_count,
        estacionamientos_tipos: p.estacionamientos_tipos || [],
        propiedad_imagenes: p.propiedad_imagenes || [],
        modelo_imagenes: modeloImagenesMap[String(p.modelo_id)] || [],
        esquemas_pago: esquemasPagoMap[String(p.proyecto_id)] || [],
      }));
    },
    enabled: !isLoadingAccess,
  });

  return {
    propiedades,
    isLoading: isLoadingAccess || isLoadingData,
    hasNoAccess,
  };
}
