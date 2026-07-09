import { supabase } from "@/integrations/supabase/client";

/** Tipo de documento "Factura de comisión externa" en `tipos_documento`. */
export const TIPO_DOC_FACTURA_COMISION_EXTERNA = 46;

/**
 * Sincroniza en `cuentas_cobranza` la factura de comisión al subir la factura
 * del comisionista externo.
 *
 * La bandeja "Cobros por gestionar" (y por consecuencia el botón
 * "Ejecutar pago" de Pagos a externos) exige:
 *   - es_draft_factura_comision = false
 *   - url_factura_comision NOT NULL
 * Sin esta sincronización la cuenta nunca entra al pipeline de cobro al
 * desarrollador y el pago al externo queda bloqueado.
 *
 * No pisa URLs ya existentes (p.ej. factura SOZU generada como draft por
 * `generar-factura-comision-sozu`): solo llena los campos vacíos.
 */
export async function sincronizarFacturaComisionEnCuenta(
  idCuentaCobranza: number,
  urls: { pdf?: string | null; xml?: string | null },
): Promise<void> {
  const { data: cuenta, error: readError } = await (supabase as any)
    .from("cuentas_cobranza")
    .select("url_factura_comision, url_factura_xml_comision")
    .eq("id", idCuentaCobranza)
    .maybeSingle();

  if (readError) throw readError;

  const payload: Record<string, unknown> = {
    es_draft_factura_comision: false,
    fecha_actualizacion: new Date().toISOString(),
  };
  if (urls.pdf && !cuenta?.url_factura_comision) {
    payload.url_factura_comision = urls.pdf;
  }
  if (urls.xml && !cuenta?.url_factura_xml_comision) {
    payload.url_factura_xml_comision = urls.xml;
  }

  const { error: updateError } = await (supabase as any)
    .from("cuentas_cobranza")
    .update(payload)
    .eq("id", idCuentaCobranza);

  if (updateError) throw updateError;
}
