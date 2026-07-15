import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";

export type FacturaDocInfo = {
  cuentaId: string;
  pdf?: string;
  xml?: string;
};

export function useFacturasDocumentos() {
  const { profile } = useAuth();
  const { isImpersonating, impersonatedClientePersonaId } = useClienteImpersonation();
  const personaId = isImpersonating ? impersonatedClientePersonaId : profile?.id_persona;

  return useQuery<FacturaDocInfo[]>({
    queryKey: ["facturas-documentos", personaId],
    queryFn: async () => {
      if (!personaId) return [];
      const { data, error } = await supabase
        .from("documentos")
        .select("id_cuenta_cobranza, id_tipo_documento, url")
        .eq("id_persona", personaId)
        .in("id_tipo_documento", [21, 22])
        .eq("activo", true)
        .eq("es_draft", false)
        .not("id_cuenta_cobranza", "is", null);
      if (error || !data?.length) return [];

      const map: Record<string, FacturaDocInfo> = {};
      for (const doc of data) {
        const cuentaId = String(doc.id_cuenta_cobranza);
        if (!map[cuentaId]) map[cuentaId] = { cuentaId };
        if (Number(doc.id_tipo_documento) === 22) {
          map[cuentaId].pdf = String(doc.url);
        } else if (Number(doc.id_tipo_documento) === 21) {
          map[cuentaId].xml = String(doc.url);
        }
      }
      return Object.values(map).filter((f) => f.pdf || f.xml);
    },
    enabled: !!personaId,
    staleTime: 5 * 60_000,
  });
}
