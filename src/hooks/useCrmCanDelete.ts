import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { useCrmImpersonation } from "@/contexts/CrmImpersonationContext";

// Permiso de "eliminar" (permiso_id 4) para una vista del CRM, respetando el modo
// "Ver como" (impersonación): si se impersona, evalúa el permiso del ROL impersonado
// (y trata como permitido si ese rol es Super Administrador). Sin impersonar, usa el
// permiso real del usuario logueado.
export function useCrmCanDelete(pagePath: string): boolean {
  const { impersonatedCrmUserRolId, isImpersonating } = useCrmImpersonation();
  const { canDelete: realCanDelete } = usePagePermissions(pagePath);

  const { data: impIsSuper } = useQuery({
    queryKey: ["crm-imp-role-super", impersonatedCrmUserRolId],
    enabled: isImpersonating && impersonatedCrmUserRolId != null,
    queryFn: async () => {
      const { data } = await (supabase as any).from("roles").select("nombre").eq("id", impersonatedCrmUserRolId).maybeSingle();
      return data?.nombre === "Super Administrador";
    },
  });

  const { data: impCanDelete } = useQuery({
    queryKey: ["crm-can-delete-imp", pagePath, impersonatedCrmUserRolId],
    enabled: isImpersonating && impersonatedCrmUserRolId != null,
    queryFn: async () => {
      const { data: sub } = await (supabase as any).from("submenus")
        .select("id").eq("vista_front_end", pagePath).eq("activo", true).maybeSingle();
      if (!sub) return false;
      const { data: sp } = await (supabase as any).from("submenus_permisos")
        .select("id").eq("submenu_id", sub.id).eq("rol_id", impersonatedCrmUserRolId).eq("permiso_id", 4).eq("activo", true).maybeSingle();
      return !!sp;
    },
  });

  if (!isImpersonating) return realCanDelete;
  return impIsSuper ? true : (impCanDelete ?? false);
}
