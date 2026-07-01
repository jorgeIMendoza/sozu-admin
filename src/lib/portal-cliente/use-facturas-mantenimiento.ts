import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";

export type FacturaMantenimientoInfo = {
  pagoId: number;
  pdf?: string;
  xml?: string;
  fechaPago?: string;
  monto?: number;
};

/**
 * Facturas CFDI de mantenimiento del cliente.
 *
 * `facturas_mantenimientos` solo enlaza por `id_pago` (sin persona ni cuenta
 * directa). Cadena para scopear al cliente:
 *   personaId → ofertas → cuentas padre → cuentas hijas (mantenimiento)
 *             → pagos → facturas_mantenimientos.id_pago
 *
 * Las cuentas de mantenimiento son `cuentas_cobranza` hijas
 * (`id_cuenta_cobranza_padre NOT NULL`, concepto 11). Incluir todos los pagos
 * del cliente (padre + hijas) es inocuo: `facturas_mantenimientos` solo
 * contiene filas de mantenimiento, así que el `in(id_pago)` filtra solo.
 */
export function useFacturasMantenimiento() {
  const { profile } = useAuth();
  const { isImpersonating, impersonatedClientePersonaId } = useClienteImpersonation();
  const personaId = isImpersonating ? impersonatedClientePersonaId : profile?.id_persona;

  return useQuery<FacturaMantenimientoInfo[]>({
    queryKey: ["facturas-mantenimiento", personaId],
    queryFn: async () => {
      if (!personaId) return [];

      // 1. Ofertas del cliente → cuentas padre
      const { data: offers } = await supabase
        .from("ofertas")
        .select("id")
        .eq("id_persona_lead", personaId)
        .eq("activo", true);
      if (!offers?.length) return [];
      const offerIds = offers.map((o) => o.id as number);

      const { data: cuentas } = await supabase
        .from("cuentas_cobranza")
        .select("id")
        .in("id_oferta", offerIds)
        .eq("activo", true);
      if (!cuentas?.length) return [];
      const parentIds = cuentas.map((c) => c.id as number);

      // 2. Cuentas hijas (incluye mantenimiento)
      const { data: childCuentas } = await supabase
        .from("cuentas_cobranza")
        .select("id")
        .in("id_cuenta_cobranza_padre", parentIds)
        .eq("activo", true);

      const allCuentaIds = [
        ...parentIds,
        ...((childCuentas ?? []).map((c) => c.id as number)),
      ];

      // 3. Pagos de esas cuentas
      const { data: pagos } = await supabase
        .from("pagos")
        .select("id, fecha_pago, monto")
        .in("id_cuenta_cobranza", allCuentaIds)
        .eq("activo", true);
      if (!pagos?.length) return [];

      const pagoMap = new Map<number, { fechaPago?: string; monto?: number }>();
      for (const p of pagos) {
        pagoMap.set(p.id as number, {
          fechaPago: p.fecha_pago ? String(p.fecha_pago) : undefined,
          monto: p.monto != null ? Number(p.monto) : undefined,
        });
      }
      const pagoIds = [...pagoMap.keys()];

      // 4. Facturas de mantenimiento por id_pago.
      // Tabla sin tipos generados aún: cast + degradar a vacío si no existe
      // (patrón CLAUDE.md #6 y #8).
      const { data, error } = await (supabase as any)
        .from("facturas_mantenimientos")
        .select("id_pago, url_factura_pdf, url_factura_xml, facturado")
        .in("id_pago", pagoIds);
      if (error || !data?.length) return [];

      const out: FacturaMantenimientoInfo[] = [];
      for (const f of data as {
        id_pago: number;
        url_factura_pdf: string | null;
        url_factura_xml: string | null;
        facturado: boolean;
      }[]) {
        if (!f.url_factura_pdf && !f.url_factura_xml) continue;
        const pi = pagoMap.get(f.id_pago) ?? {};
        out.push({
          pagoId: f.id_pago,
          pdf: f.url_factura_pdf ?? undefined,
          xml: f.url_factura_xml ?? undefined,
          fechaPago: pi.fechaPago,
          monto: pi.monto,
        });
      }
      return out;
    },
    enabled: !!personaId,
    staleTime: 5 * 60_000,
  });
}
