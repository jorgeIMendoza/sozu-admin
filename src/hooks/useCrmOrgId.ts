import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCrmOrgId(): string | null {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["crm-org-id", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: uo } = await (supabase as any)
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (uo?.organization_id) return uo.organization_id as string;
      // Fallback: first org in the table (e.g. Super Admin with no user_organization row)
      const { data: org } = await (supabase as any)
        .from("organizations")
        .select("id")
        .limit(1)
        .maybeSingle();
      return (org?.id ?? null) as string | null;
    },
  });

  return data ?? null;
}
