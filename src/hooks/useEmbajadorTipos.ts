import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EmbajadorTipo {
  id: number;
  etiqueta: string;
}

// Fallback solo por si la tabla queda vacía (nunca debería, pero evita un selector en blanco)
const FALLBACK_TIPOS: EmbajadorTipo[] = [
  { id: 1, etiqueta: 'Cliente' },
  { id: 2, etiqueta: 'Socio' },
  { id: 3, etiqueta: 'Aliado' },
  { id: 4, etiqueta: 'Referidor externo' },
  { id: 5, etiqueta: 'Colaborador' },
  { id: 6, etiqueta: 'Otro' },
];

export function useEmbajadorTipos(): EmbajadorTipo[] {
  const [tipos, setTipos] = useState<EmbajadorTipo[]>([]);

  useEffect(() => {
    supabase
      .from('tipos_embajador')
      .select('id, etiqueta')
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTipos(data);
        } else {
          setTipos(FALLBACK_TIPOS);
        }
      });
  }, []);

  return tipos;
}
