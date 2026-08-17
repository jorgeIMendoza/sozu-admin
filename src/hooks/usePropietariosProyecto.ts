import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PropietarioOption {
  id: number;
  nombre: string;
}

/**
 * Propietarios (entidades_relacionadas) distintos entre las propiedades activas
 * de un proyecto — para el filtro "Propietario" en Relación de Pagos.
 * Join propiedades.id_entidad_relacionada_dueno → entidades_relacionadas → personas,
 * igual patrón que legalFlowEnrich.ts.
 */
export function usePropietariosProyecto(proyectoId: number | null) {
  return useQuery({
    queryKey: ['propietarios-proyecto', proyectoId],
    enabled: !!proyectoId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PropietarioOption[]> => {
      const { data: edificios } = await supabase
        .from('edificios')
        .select('id')
        .eq('id_proyecto', proyectoId!)
        .eq('activo', true);
      const edificioIds = (edificios ?? []).map((e) => e.id);
      if (!edificioIds.length) return [];

      // Listas .in() más grandes se truncan/fallan silenciosamente contra PostgREST
      // (URL demasiado larga) — mismo tamaño de lote que PldDashboard.tsx.
      const BATCH = 30;
      const modelos: { id: number }[] = [];
      for (let i = 0; i < edificioIds.length; i += BATCH) {
        const { data } = await supabase
          .from('edificios_modelos')
          .select('id')
          .in('id_edificio', edificioIds.slice(i, i + BATCH));
        modelos.push(...(data ?? []));
      }
      const modeloIds = modelos.map((m) => m.id);
      if (!modeloIds.length) return [];

      const propiedades: { id_entidad_relacionada_dueno: number | null }[] = [];
      for (let i = 0; i < modeloIds.length; i += BATCH) {
        const { data } = await supabase
          .from('propiedades')
          .select('id_entidad_relacionada_dueno')
          .in('id_edificio_modelo', modeloIds.slice(i, i + BATCH))
          .eq('activo', true);
        propiedades.push(...(data ?? []));
      }

      const entIds = [...new Set(
        propiedades.map((p) => p.id_entidad_relacionada_dueno).filter((v): v is number => v != null),
      )];
      if (!entIds.length) return [];

       
      const { data: ents } = await (supabase as any)
        .from('entidades_relacionadas')
        .select('id, personas!fk_entrel_persona(nombre_legal, nombre_comercial)')
        .in('id', entIds);

      return (ents ?? [])
         
        .map((e: any) => ({
          id: e.id as number,
          nombre: (e.personas?.nombre_comercial ?? e.personas?.nombre_legal ?? `Propietario ${e.id}`) as string,
        }))
        .sort((a: PropietarioOption, b: PropietarioOption) => a.nombre.localeCompare(b.nombre, 'es'));
    },
  });
}
