import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FacturaComisionInfo = {
  pdf?: string;
  xml?: string;
};

export function useFacturasComision(pagoIds: number[]) {
  const sortedKey = pagoIds.slice().sort((a, b) => a - b).join(",");
  return useQuery<Record<number, FacturaComisionInfo>>({
    queryKey: ["facturas-comision", sortedKey],
    queryFn: async () => {
      if (!pagoIds.length) return {};
      const { data, error } = await (supabase as any)
        .from("facturas_comision")
        .select("id_pago, url_factura_pdf, url_factura_xml")
        .in("id_pago", pagoIds);
      if (error) return {};
      const map: Record<number, FacturaComisionInfo> = {};
      for (const f of (data ?? [])) {
        const hasPdf = !!f.url_factura_pdf;
        const hasXml = !!f.url_factura_xml;
        if (hasPdf || hasXml) {
          map[Number(f.id_pago)] = {
            pdf: hasPdf ? String(f.url_factura_pdf) : undefined,
            xml: hasXml ? String(f.url_factura_xml) : undefined,
          };
        }
      }
      return map;
    },
    enabled: pagoIds.length > 0,
    staleTime: 5 * 60_000,
  });
}
