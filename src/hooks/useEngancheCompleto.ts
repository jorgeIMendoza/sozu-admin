import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Determina si el ENGANCHE de una cuenta de cobranza está pagado por completo.
 *
 * Misma lógica que el menú Admin · Finanzas → Comisiones Sozu (`Comisiones.tsx`):
 * la cuenta debe tener al menos un acuerdo de enganche (`id_concepto = 2`,
 * `activo = true`) y NINGUNO de esos acuerdos debe estar pendiente
 * (`pago_completado = false`). En este negocio el "enganche" engloba el
 * apartado + enganche, reflejado en el acuerdo de concepto 2.
 *
 * Solo así se puede generar la Factura de Comisión SOZU.
 */
export function useEngancheCompleto(idCuentaCobranza?: number | null) {
  return useQuery({
    queryKey: ["enganche-completo", idCuentaCobranza],
    enabled: idCuentaCobranza != null,
    staleTime: 60_000,
    queryFn: async (): Promise<{ engancheCompleto: boolean; tieneEnganche: boolean }> => {
      if (idCuentaCobranza == null) return { engancheCompleto: false, tieneEnganche: false };
      const { data, error } = await (supabase as any)
        .from("acuerdos_pago")
        .select("id, pago_completado")
        .eq("id_cuenta_cobranza", idCuentaCobranza)
        .eq("id_concepto", 2) // Enganche
        .eq("activo", true);
      if (error || !data) return { engancheCompleto: false, tieneEnganche: false };
      const rows = data as Array<{ pago_completado: boolean }>;
      const tieneEnganche = rows.length > 0;
      const engancheCompleto = tieneEnganche && rows.every((r) => !!r.pago_completado);
      return { engancheCompleto, tieneEnganche };
    },
  });
}
