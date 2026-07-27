import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { JURIDICO_QUERY_KEYS } from '../hooks/useRegistrarActuacion';

export interface TipoAsuntoOption {
  id: string;
  codigo: string;
  nombre: string;
}

export function useTiposAsunto() {
  return useQuery<TipoAsuntoOption[]>({
    queryKey: JURIDICO_QUERY_KEYS.catTiposAsunto(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cat_tipos_asunto')
        .select('id, codigo, nombre')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;

      return (data ?? []).map((t: any) => ({
        id: String(t.id),
        codigo: t.codigo,
        nombre: t.nombre,
      }));
    },
    staleTime: 10 * 60_000,
  });
}
