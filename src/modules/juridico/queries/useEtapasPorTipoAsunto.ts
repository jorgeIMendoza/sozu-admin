import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { JURIDICO_QUERY_KEYS } from '../hooks/useRegistrarActuacion';

export interface EtapaOption {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  esTerminal: boolean;
}

export function useEtapasPorTipoAsunto(idTipoAsunto: string | null | undefined) {
  return useQuery<EtapaOption[]>({
    queryKey: JURIDICO_QUERY_KEYS.catEtapas(idTipoAsunto ?? ''),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cat_etapas_procesales')
        .select('id, codigo, nombre, orden, es_terminal')
        .eq('id_tipo_asunto', idTipoAsunto)
        .eq('activo', true)
        .order('orden');

      if (error) throw error;

      return (data ?? []).map((e: any) => ({
        id: String(e.id),
        codigo: e.codigo,
        nombre: e.nombre,
        orden: e.orden,
        esTerminal: e.es_terminal,
      }));
    },
    enabled: !!idTipoAsunto,
    staleTime: 10 * 60_000,
  });
}
