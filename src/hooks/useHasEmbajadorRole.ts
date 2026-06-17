import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_EMBAJADOR_ID = 25;

export function useHasEmbajadorRole(): boolean | null {
  const { profile } = useAuth();
  const [hasRole, setHasRole] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profile?.email) { setHasRole(false); return; }
    if (profile.rol_id === ROLE_EMBAJADOR_ID) { setHasRole(true); return; }
    (supabase as any)
      .from('user_roles')
      .select('id')
      .eq('email', profile.email.toLowerCase())
      .eq('rol_id', ROLE_EMBAJADOR_ID)
      .eq('activo', true)
      .maybeSingle()
      .then(({ data }: any) => setHasRole(!!data));
  }, [profile?.email, profile?.rol_id]);

  return hasRole;
}
