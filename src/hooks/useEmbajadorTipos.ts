import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EmbajadorTipo {
  id: number;
  etiqueta: string;
}

export function useEmbajadorTipos(): EmbajadorTipo[] {
  const [tipos, setTipos] = useState<EmbajadorTipo[]>([]);

  useEffect(() => {
    (supabase as any)
      .from('embajador_tipos')
      .select('id, etiqueta')
      .eq('activo', true)
      .order('orden')
      .then(({ data }: any) => {
        if (data) setTipos(data);
      });
  }, []);

  return tipos;
}
