import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Resolves the inmobiliaria persona ID for the current user.
 * Strategy:
 * 1. Use profile.id_persona directly if available
 * 2. Resolve via entidades_relacionadas type 5 (Inmobiliaria) linked through
 *    proyectos_acceso.id_entidad_relacionada_dueno
 * 3. Fallback: find a primary Inmobiliaria (role 4) user sharing project access
 *    who has id_persona set
 */
export function useInmobiliariaPersonaId() {
  const { profile } = useAuth();
  const directId = profile?.id_persona;
  const email = profile?.email;
  const isInmobRole = profile?.rol_nombre === "Inmobiliaria";

  const { data: resolvedId, isLoading } = useQuery({
    queryKey: ["inmob-persona-id-resolve", email],
    queryFn: async (): Promise<number | null> => {
      if (!email) return null;

      // Strategy 1: via proyectos_acceso → entidades_relacionadas
      const { data: accesos } = await (supabase as any)
        .from("proyectos_acceso")
        .select("id_entidad_relacionada_dueno")
        .eq("usuario_id", email)
        .not("id_entidad_relacionada_dueno", "is", null)
        .limit(1);

      if (accesos && accesos.length > 0) {
        const erDueno = accesos[0].id_entidad_relacionada_dueno;
        const { data: er } = await (supabase as any)
          .from("entidades_relacionadas")
          .select("id_persona")
          .eq("id", erDueno)
          .single();
        if (er?.id_persona) return er.id_persona;
      }

      // Strategy 2: find primary inmob user sharing project access
      const { data: myProjects } = await (supabase as any)
        .from("proyectos_acceso")
        .select("proyecto_id")
        .eq("usuario_id", email);

      if (myProjects && myProjects.length > 0) {
        const projIds = myProjects.map((p: any) => p.proyecto_id);
        const { data: sharedAccess } = await (supabase as any)
          .from("proyectos_acceso")
          .select("usuario_id")
          .in("proyecto_id", projIds)
          .neq("usuario_id", email);

        if (sharedAccess && sharedAccess.length > 0) {
          const otherEmails = [...new Set(sharedAccess.map((s: any) => s.usuario_id))] as string[];
          const { data: primaryUsers } = await (supabase as any)
            .from("usuarios")
            .select("id_persona")
            .in("email", otherEmails)
            .eq("rol_id", 4)
            .not("id_persona", "is", null)
            .limit(1);

          if (primaryUsers && primaryUsers.length > 0) {
            return primaryUsers[0].id_persona;
          }
        }
      }

      return null;
    },
    enabled: isInmobRole && !directId && !!email,
    staleTime: 10 * 60_000,
  });

  return {
    personaId: directId ?? resolvedId ?? null,
    isLoading: isInmobRole && !directId ? isLoading : false,
  };
}
