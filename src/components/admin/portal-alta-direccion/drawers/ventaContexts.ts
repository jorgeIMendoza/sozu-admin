import type { VentaContext } from "./types";

/* ──────────────────────────────────────────────────────────
   Catálogo canónico de VentaContext por folio COB.
   Los 6 casos del Ciclo de Venta están completos; las ventas
   históricas (COB-1015, 1019, etc.) caen al fallback con
   datos mínimos.
   ────────────────────────────────────────────────────────── */

const VENTAS: Record<string, VentaContext> = {
  "COB-1041": {
    folio: "COB-1041",
    propiedad: "Daiku · A-201",
    cliente: "María García López",
    cliente_rfc: "GALM850712ABC",
    precio_venta: 1890000,
    comision_total_sozu: 94500,
    porcentaje_comision: 5.0,
    estado_venta: "Vendida",
    dias_desde_apartado: 23,
  },
  "COB-1042": {
    folio: "COB-1042",
    propiedad: "Bottura · PH-3",
    cliente: "Juan Pérez Silva",
    cliente_rfc: "PESJ720430XYZ",
    precio_venta: 2400000,
    comision_total_sozu: 120000,
    porcentaje_comision: 5.0,
    estado_venta: "Vendida",
    dias_desde_apartado: 19,
  },
  "COB-1043": {
    folio: "COB-1043",
    propiedad: "Monócolo · B-1",
    cliente: "Sofía Rivera Mendoza",
    cliente_rfc: "RIMS900218QWE",
    precio_venta: 1180000,
    comision_total_sozu: 53100,
    porcentaje_comision: 4.5,
    estado_venta: "En firma",
    dias_desde_apartado: 12,
  },
  "COB-1044": {
    folio: "COB-1044",
    propiedad: "Daiku · C-402",
    cliente: "Familia López-Núñez (copropietarios)",
    precio_venta: 1650000,
    comision_total_sozu: 82500,
    porcentaje_comision: 5.0,
    estado_venta: "En apartado",
    dias_desde_apartado: 8,
  },
  "COB-1045": {
    folio: "COB-1045",
    propiedad: "Daiku · A-205",
    cliente: "Carlos Mendoza Cliente",
    precio_venta: 1520000,
    comision_total_sozu: 76000,
    porcentaje_comision: 5.0,
    estado_venta: "En oferta",
    dias_desde_apartado: 6,
  },
  "COB-1046": {
    folio: "COB-1046",
    propiedad: "Bottura · PH-2",
    cliente: "Empresa Constructora ABC SA",
    precio_venta: 3800000,
    comision_total_sozu: 190000,
    porcentaje_comision: 5.0,
    estado_venta: "Liquidada",
    dias_desde_apartado: 87,
  },
};

/** Mapa de "Propiedad" (texto suelto en mocks viejos) → COB. */
const PROPIEDAD_TO_COB: Record<string, string> = {
  "Daiku A-201": "COB-1041",
  "Bottura PH-3": "COB-1042",
  "Monócolo B-1": "COB-1043",
  "Daiku C-402": "COB-1044",
  "Daiku A-205": "COB-1045",
  "Bottura PH-2": "COB-1046",
};

/**
 * Resuelve el folio de la cuenta de cobranza a partir de una referencia
 * arbitraria. Acepta:
 *   - "CC-001750", "CCP-001758"           ← formato real actual
 *   - "CC-001750 · Daiku 204"
 *   - "COB-1041", "COB-1041 · Daiku A-201" ← legacy
 *   - "Daiku A-201"                        ← fallback por nombre de propiedad
 */
export function resolveCobFolio(ventaReferencia: string | null | undefined): string {
  if (!ventaReferencia) return "COB-0000";
  // Acepta CC-, CCP- o COB- seguido de dígitos (con o sin zero-padding)
  const match = ventaReferencia.match(/(?:CCP|CC|COB)-\d{4,}/i);
  if (match) return match[0];
  for (const [propiedad, folio] of Object.entries(PROPIEDAD_TO_COB)) {
    if (ventaReferencia.includes(propiedad)) return folio;
  }
  return "COB-0000";
}

/**
 * Devuelve el VentaContext canónico. Si el folio no está catalogado,
 * regresa un contexto mínimo con etiqueta "Venta histórica" para que el
 * drawer siga rendereando sin romperse.
 */
export function getVentaContext(folio: string): VentaContext {
  return (
    VENTAS[folio] ?? {
      folio: folio || "COB-?",
      propiedad: "Venta histórica",
      cliente: "Información no disponible en demo",
      precio_venta: 0,
      comision_total_sozu: 0,
      porcentaje_comision: 0,
      estado_venta: "Liquidada",
      dias_desde_apartado: 0,
    }
  );
}
