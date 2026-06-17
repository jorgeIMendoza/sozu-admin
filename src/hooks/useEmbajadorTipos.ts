import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EmbajadorTipo {
  id: number;
  etiqueta: string;
}

// Fallback mientras la tabla embajador_tipos no exista en BD
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
    (supabase as any)
      .from('embajador_tipos')
      .select('id, etiqueta')
      .eq('activo', true)
      .order('orden')
      .then(({ data, error }: any) => {
        if (data && data.length > 0) {
          setTipos(data);
        } else {
          // Tabla aún no existe o vacía — usar fallback hasta ejecutar DDL
          setTipos(FALLBACK_TIPOS);
        }
      });
  }, []);

  return tipos;
}
