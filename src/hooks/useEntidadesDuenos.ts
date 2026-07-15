import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProyectosCobranza } from './useCobranzaDashboard';

export interface EntidadDueno {
  nombre_legal: string;  // display name: COALESCE(nombre_comercial, nombre_legal)
  er_ids: number[];
}

/**
 * Entidades legales (personas morales con rol de negocio padre='p') asociadas
 * a los proyectos accesibles por el usuario/impersonación activa.
 * Equivale a: WHERE tipo_persona = 'pm' AND tipos_entidad.padre = 'p'
 */
export function useEntidadesDuenos() {
  const { data: proyectos } = useProyectosCobranza();
  const proyectoIds = (proyectos ?? []).map((p: any) => p.id as number);

  return useQuery({
    queryKey: ['entidades-duenos-proyectos', proyectoIds.sort().join(',')],
    enabled: proyectoIds.length > 0,
    queryFn: async (): Promise<EntidadDueno[]> => {
      // tipos_entidad.padre='p' (business roles): 3,4,5,6,8,9,10,13,15,20
      const TIPOS_NEGOCIO = [3, 4, 5, 6, 8, 9, 10, 13, 15, 20];

      // Step 1: entidades_relacionadas para los proyectos en scope
      const { data: erData, error: erErr } = await (supabase as any)
        .from('entidades_relacionadas')
        .select('id, id_persona, id_proyecto')
        .eq('activo', true)
        .in('id_tipo_entidad', TIPOS_NEGOCIO)
        .in('id_proyecto', proyectoIds);
      if (erErr) throw erErr;
      if (!erData?.length) return [];

      const personaIds = [...new Set((erData as any[]).map((er) => er.id_persona as number))];

      // Step 2: solo personas morales
      const { data: personasData, error: perErr } = await (supabase as any)
        .from('personas')
        .select('id, nombre_legal, nombre_comercial')
        .in('id', personaIds)
        .eq('tipo_persona', 'pm');
      if (perErr) throw perErr;

      const personaMap = new Map<number, { nombre_legal: string; nombre_comercial: string | null }>();
      for (const per of ((personasData ?? []) as any[])) {
        personaMap.set(per.id, { nombre_legal: per.nombre_legal, nombre_comercial: per.nombre_comercial });
      }

      // Step 3: agrupar por nombre display, colectar er_ids
      const map = new Map<string, Set<number>>();
      for (const er of (erData as any[])) {
        const per = personaMap.get(er.id_persona);
        if (!per) continue;
        const display = per.nombre_comercial || per.nombre_legal;
        if (!display) continue;
        if (!map.has(display)) map.set(display, new Set());
        map.get(display)!.add(er.id);
      }

      return Array.from(map.entries())
        .map(([nombre_legal, ids]) => ({ nombre_legal, er_ids: Array.from(ids) }))
        .sort((a, b) => a.nombre_legal.localeCompare(b.nombre_legal));
    },
    staleTime: 30 * 60 * 1000,
  });
}
