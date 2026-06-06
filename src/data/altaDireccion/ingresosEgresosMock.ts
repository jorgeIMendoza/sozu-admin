/**
 * Mock data shape-aligned con las fuentes reales esperadas para el
 * módulo "Ingresos y Egresos" (Portal Alta Dirección · Real Estate
 * Ventures, S.A. de C.V.).
 *
 * Fecha demo (TODAY): 2026-06-05.
 *
 * Mapeo a fuentes reales (para el wiring posterior — no implementar
 * ahora, sólo dejar el tipado alineado):
 *
 *   • Ingresos (comisión SOZU):
 *       cuentas_cobranza.url_factura_comision /
 *       es_draft_factura_comision; futura tabla `facturas_emitidas_sozu`.
 *       Monto = `Comisión Total` (precio_final × pct).
 *   • Egresos externos:
 *       `comisionistas` filtrado a externos (cruce email_usuario ↔
 *       usuarios.email, roles.es_rol_interno = false). Flags:
 *       aprobada, pagada, fecha_pago_comision.
 *   • Egresos internos:
 *       `comisionistas` filtrado a internos (roles.es_rol_interno = true).
 *   • Flag cobro previo:
 *       función `ya_se_cobro_al_desarrollador(cuenta_cobranza_id)`.
 *   • Devengado vs caja:
 *       devengado = monto causado en el período;
 *       caja = sólo registros con pagada/cobrada = true + fecha.
 */

export type BaseContable = "devengado" | "caja";

export type TipoIngresoSozu = "Propiedad" | "Producto" | "Servicio";

export type ProyectoSozu = "Daiku" | "Margot" | "Monócolo" | "Bottura";

export type EstadoMovimiento =
  | "facturada"
  | "cobrada"
  | "draft"
  | "comprometida"
  | "pagada"
  | "rechazada";

/**
 * Fila unificada del ledger consolidado. Una sola entidad para Ingresos
 * (factura SOZU al desarrollador) y Egresos (comisión a externo/interno).
 */
export interface IngresoEgresoMovimiento {
  id: string;
  /** ISO date `YYYY-MM-DD` — fecha de causación (devengado) o de
   *  cobro/pago (caja). Cuando ambas existen, el frontend filtra por la
   *  que aplica según el toggle activo. */
  fecha_causacion: string;
  fecha_cobro_pago: string | null;
  /** Folio operativo:
   *  - Ingreso  → `F-S2026-XXXX` (factura SOZU al desarrollador)
   *  - Externo  → `COM-EXT-XXXX`
   *  - Interno  → `COM-INT-XXXX` */
  folio: string;
  tipo_movimiento: "ingreso" | "egreso";
  /** Sólo aplica a `egreso`: indica si es a externo o interno. */
  origen_egreso?: "externo" | "interno";
  /** Sólo aplica a `ingreso`: clasifica el tipo de comisión. */
  tipo_ingreso?: TipoIngresoSozu;
  /** Concepto humano-leible para mostrar en la tabla. */
  concepto: string;
  proyecto: ProyectoSozu;
  /** Folio del expediente SOZU asociado (CC-XXXXXX o CCP-XXXXXX). */
  folio_cuenta: string;
  /** Para egresos: nombre del beneficiario. Para ingresos: desarrollador. */
  contraparte: string;
  /** Para egresos internos: rol del comisionista. */
  rol?: string;
  subtotal: number;
  iva: number;
  total: number;
  estado: EstadoMovimiento;
  /** Sólo aplica a egresos: indica si ya se cobró al desarrollador. */
  cobro_previo?: boolean;
  /** Días desde la causación hasta hoy (útil para antigüedad). */
  dias_antiguedad: number;
}

/** Estructura de los KPIs hero + waterfall + márgenes. */
export interface ResumenFinanciero {
  base: BaseContable;
  /** Subtotal sin IVA — base para resultado y margen. */
  ingresos_subtotal: number;
  /** Suma de IVA acreditado al desarrollador. */
  ingresos_iva: number;
  ingresos_total_con_iva: number;
  egresos_externos_subtotal: number;
  egresos_internos_subtotal: number;
  egresos_total_subtotal: number;
  resultado_neto: number;
  margen_pct: number;
  /** Sólo aplica a egresos: exposición sin cobro previo. */
  exposicion_subtotal: number;
  exposicion_count: number;
}

/** Una fila de la tabla de exposición (egresos comprometidos sin cobro). */
export interface ExposicionCobroPrevio {
  id: string;
  folio_cuenta: string;
  beneficiario: string;
  tipo: "externo" | "interno";
  proyecto: ProyectoSozu;
  monto_comprometido: number;
  dias_antiguedad: number;
  estado: EstadoMovimiento;
  flag_cobro: boolean;
}

/** Punto de la evolución mensual. */
export interface PuntoEvolucionMensual {
  mes: string; // YYYY-MM-01
  ingresos: number;
  egresos: number;
  resultado: number;
  /** Para el toggle "Por número de operaciones". */
  operaciones_ingreso: number;
  operaciones_egreso: number;
}

/* ──────────────────────────────────────────────────────────
   Mock dataset (TODAY = 2026-06-05)
   ────────────────────────────────────────────────────────── */

const TODAY = "2026-06-05";

function diffDays(iso: string): number {
  const ms = new Date(TODAY).getTime() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

const ivaOf = (subtotal: number) => +(subtotal * 0.16).toFixed(2);
const totalOf = (subtotal: number) => +(subtotal * 1.16).toFixed(2);

/* Helper para emitir un movimiento con IVA calculado. */
function mov(
  base: Omit<IngresoEgresoMovimiento, "iva" | "total" | "dias_antiguedad">,
): IngresoEgresoMovimiento {
  return {
    ...base,
    iva: ivaOf(base.subtotal),
    total: totalOf(base.subtotal),
    dias_antiguedad: diffDays(base.fecha_causacion),
  };
}

/**
 * Mock de movimientos (≈35). Mezcla Ingresos (factura SOZU) +
 * Egresos externos + Egresos internos. Totales cuadran con
 * `RESUMEN_DEVENGADO` y `RESUMEN_CAJA` abajo.
 */
export const MOCK_MOVIMIENTOS: IngresoEgresoMovimiento[] = [
  // ─── INGRESOS (comisión SOZU al desarrollador) ───
  mov({
    id: "ING-001",
    fecha_causacion: "2026-05-28",
    fecha_cobro_pago: "2026-06-03",
    folio: "F-S2026-0142",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Propiedad",
    concepto: "Comisión SOZU · pre-venta Unidad 1202",
    proyecto: "Daiku",
    folio_cuenta: "CC-001762",
    contraparte: "Tallwood",
    subtotal: 412_500,
    estado: "cobrada",
  }),
  mov({
    id: "ING-002",
    fecha_causacion: "2026-05-21",
    fecha_cobro_pago: "2026-05-31",
    folio: "F-S2026-0140",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Propiedad",
    concepto: "Comisión SOZU · pre-venta Unidad 304",
    proyecto: "Daiku",
    folio_cuenta: "CC-001754",
    contraparte: "Tallwood",
    subtotal: 388_750,
    estado: "cobrada",
  }),
  mov({
    id: "ING-003",
    fecha_causacion: "2026-05-17",
    fecha_cobro_pago: "2026-06-01",
    folio: "F-S2026-0138",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Propiedad",
    concepto: "Comisión SOZU · pre-venta Unidad 803",
    proyecto: "Bottura",
    folio_cuenta: "CC-001749",
    contraparte: "Investimento",
    subtotal: 295_400,
    estado: "cobrada",
  }),
  mov({
    id: "ING-004",
    fecha_causacion: "2026-05-12",
    fecha_cobro_pago: null,
    folio: "F-S2026-0136",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Propiedad",
    concepto: "Comisión SOZU · pre-venta Unidad 204",
    proyecto: "Daiku",
    folio_cuenta: "CC-001750",
    contraparte: "Tallwood",
    subtotal: 412_500,
    estado: "facturada",
  }),
  mov({
    id: "ING-005",
    fecha_causacion: "2026-04-30",
    fecha_cobro_pago: "2026-05-22",
    folio: "F-S2026-0125",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Propiedad",
    concepto: "Comisión SOZU · pre-venta Unidad 502",
    proyecto: "Monócolo",
    folio_cuenta: "CC-001722",
    contraparte: "Monócolo SAPI",
    subtotal: 364_200,
    estado: "cobrada",
  }),
  mov({
    id: "ING-006",
    fecha_causacion: "2026-04-18",
    fecha_cobro_pago: "2026-05-09",
    folio: "F-S2026-0118",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Producto",
    concepto: "Comisión SOZU · venta Bodega 12",
    proyecto: "Daiku",
    folio_cuenta: "CCP-001741",
    contraparte: "Tallwood",
    subtotal: 38_400,
    estado: "cobrada",
  }),
  mov({
    id: "ING-007",
    fecha_causacion: "2026-04-09",
    fecha_cobro_pago: "2026-04-29",
    folio: "F-S2026-0110",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Servicio",
    concepto: "Comisión SOZU · servicios post-venta",
    proyecto: "Margot",
    folio_cuenta: "CCP-001703",
    contraparte: "Margot Inmobiliaria",
    subtotal: 24_800,
    estado: "cobrada",
  }),
  mov({
    id: "ING-008",
    fecha_causacion: "2026-03-30",
    fecha_cobro_pago: "2026-04-22",
    folio: "F-S2026-0098",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Propiedad",
    concepto: "Comisión SOZU · pre-venta Unidad 905",
    proyecto: "Bottura",
    folio_cuenta: "CC-001688",
    contraparte: "Investimento",
    subtotal: 332_100,
    estado: "cobrada",
  }),
  mov({
    id: "ING-009",
    fecha_causacion: "2026-03-22",
    fecha_cobro_pago: null,
    folio: "F-S2026-0092",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Propiedad",
    concepto: "Comisión SOZU · pre-venta Unidad 103",
    proyecto: "Daiku",
    folio_cuenta: "CC-001677",
    contraparte: "VIVALTA",
    subtotal: 415_400,
    estado: "facturada",
  }),
  mov({
    id: "ING-010",
    fecha_causacion: "2026-03-10",
    fecha_cobro_pago: "2026-03-28",
    folio: "F-S2026-0084",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Propiedad",
    concepto: "Comisión SOZU · pre-venta Unidad 411",
    proyecto: "Monócolo",
    folio_cuenta: "CC-001640",
    contraparte: "Monócolo SAPI",
    subtotal: 295_950,
    estado: "cobrada",
  }),
  mov({
    id: "ING-011",
    fecha_causacion: "2026-03-04",
    fecha_cobro_pago: "2026-03-26",
    folio: "F-S2026-0080",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Producto",
    concepto: "Comisión SOZU · venta Estacionamiento 08",
    proyecto: "Bottura",
    folio_cuenta: "CCP-001625",
    contraparte: "Investimento",
    subtotal: 28_500,
    estado: "cobrada",
  }),
  mov({
    id: "ING-012",
    fecha_causacion: "2026-03-04",
    fecha_cobro_pago: "2026-03-30",
    folio: "F-S2026-0079",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Servicio",
    concepto: "Comisión SOZU · ingeniería de oferta",
    proyecto: "Daiku",
    folio_cuenta: "CCP-001624",
    contraparte: "Tallwood",
    subtotal: 21_500,
    estado: "cobrada",
  }),
  mov({
    id: "ING-013",
    fecha_causacion: "2026-03-02",
    fecha_cobro_pago: "2026-03-20",
    folio: "F-S2026-0077",
    tipo_movimiento: "ingreso",
    tipo_ingreso: "Propiedad",
    concepto: "Comisión SOZU · pre-venta Unidad 207",
    proyecto: "Margot",
    folio_cuenta: "CC-001619",
    contraparte: "Margot Inmobiliaria",
    subtotal: 150_000,
    estado: "cobrada",
  }),

  // ─── EGRESOS EXTERNOS (a inmobiliarias/agentes) ───
  mov({
    id: "EXT-001",
    fecha_causacion: "2026-05-28",
    fecha_cobro_pago: "2026-06-04",
    folio: "COM-EXT-0312",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · Inmobiliaria Punto Norte",
    proyecto: "Daiku",
    folio_cuenta: "CC-001762",
    contraparte: "Inmobiliaria Punto Norte SA",
    subtotal: 198_000,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "EXT-002",
    fecha_causacion: "2026-05-21",
    fecha_cobro_pago: "2026-06-01",
    folio: "COM-EXT-0308",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · Red Aliados Premium",
    proyecto: "Daiku",
    folio_cuenta: "CC-001754",
    contraparte: "Red Aliados Premium SA",
    subtotal: 186_600,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "EXT-003",
    fecha_causacion: "2026-05-17",
    fecha_cobro_pago: "2026-06-02",
    folio: "COM-EXT-0305",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · IUP Comercializadora",
    proyecto: "Bottura",
    folio_cuenta: "CC-001749",
    contraparte: "Inmuebles Urbanos del Pacífico",
    subtotal: 141_792,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "EXT-004",
    fecha_causacion: "2026-05-12",
    fecha_cobro_pago: null,
    folio: "COM-EXT-0303",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · agente Abel Salazar",
    proyecto: "Daiku",
    folio_cuenta: "CC-001750",
    contraparte: "Abel Salazar García",
    subtotal: 165_000,
    estado: "comprometida",
    cobro_previo: false,
  }),
  mov({
    id: "EXT-005",
    fecha_causacion: "2026-04-30",
    fecha_cobro_pago: "2026-05-23",
    folio: "COM-EXT-0291",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · Monócolo Brokers",
    proyecto: "Monócolo",
    folio_cuenta: "CC-001722",
    contraparte: "Monócolo Brokers",
    subtotal: 174_816,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "EXT-006",
    fecha_causacion: "2026-04-18",
    fecha_cobro_pago: "2026-05-10",
    folio: "COM-EXT-0282",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · referido producto",
    proyecto: "Daiku",
    folio_cuenta: "CCP-001741",
    contraparte: "Patricia Morales Guzmán",
    subtotal: 16_500,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "EXT-007",
    fecha_causacion: "2026-04-09",
    fecha_cobro_pago: "2026-04-30",
    folio: "COM-EXT-0278",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · Margot Asoc.",
    proyecto: "Margot",
    folio_cuenta: "CCP-001703",
    contraparte: "Margot Inmobiliaria",
    subtotal: 12_400,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "EXT-008",
    fecha_causacion: "2026-03-30",
    fecha_cobro_pago: "2026-04-23",
    folio: "COM-EXT-0265",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · Investimento Asoc.",
    proyecto: "Bottura",
    folio_cuenta: "CC-001688",
    contraparte: "Investimento Asoc.",
    subtotal: 159_408,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "EXT-009",
    fecha_causacion: "2026-03-22",
    fecha_cobro_pago: null,
    folio: "COM-EXT-0261",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · VIVALTA Brokers",
    proyecto: "Daiku",
    folio_cuenta: "CC-001677",
    contraparte: "VIVALTA Brokers",
    subtotal: 193_968.63,
    estado: "comprometida",
    cobro_previo: false,
  }),
  mov({
    id: "EXT-010",
    fecha_causacion: "2026-03-10",
    fecha_cobro_pago: "2026-04-02",
    folio: "COM-EXT-0254",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · Monócolo Brokers",
    proyecto: "Monócolo",
    folio_cuenta: "CC-001640",
    contraparte: "Monócolo Brokers",
    subtotal: 142_056,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "EXT-011",
    fecha_causacion: "2026-03-04",
    fecha_cobro_pago: "2026-03-30",
    folio: "COM-EXT-0249",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · Investimento Brokers",
    proyecto: "Bottura",
    folio_cuenta: "CCP-001625",
    contraparte: "Investimento Brokers",
    subtotal: 13_500,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "EXT-012",
    fecha_causacion: "2026-03-02",
    fecha_cobro_pago: "2026-03-22",
    folio: "COM-EXT-0247",
    tipo_movimiento: "egreso",
    origen_egreso: "externo",
    concepto: "Comisión externa · Margot Asoc.",
    proyecto: "Margot",
    folio_cuenta: "CC-001619",
    contraparte: "Margot Inmobiliaria",
    subtotal: 133_000,
    estado: "pagada",
    cobro_previo: true,
  }),

  // ─── EGRESOS INTERNOS (dispersión al equipo SOZU) ───
  mov({
    id: "INT-001",
    fecha_causacion: "2026-05-28",
    fecha_cobro_pago: "2026-06-03",
    folio: "COM-INT-0512",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · cierre comercial",
    proyecto: "Daiku",
    folio_cuenta: "CC-001762",
    contraparte: "Vladimir Huerta",
    rol: "Gerente Comercial",
    subtotal: 78_000,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "INT-002",
    fecha_causacion: "2026-05-21",
    fecha_cobro_pago: "2026-06-01",
    folio: "COM-INT-0508",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · cierre comercial",
    proyecto: "Daiku",
    folio_cuenta: "CC-001754",
    contraparte: "Miguel Ochoa",
    rol: "Vendedor Interno",
    subtotal: 65_400,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "INT-003",
    fecha_causacion: "2026-05-17",
    fecha_cobro_pago: null,
    folio: "COM-INT-0505",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · cierre comercial",
    proyecto: "Bottura",
    folio_cuenta: "CC-001749",
    contraparte: "Andrea López Fuentes",
    rol: "Vendedora Interna",
    subtotal: 52_770,
    estado: "comprometida",
    cobro_previo: true,
  }),
  mov({
    id: "INT-004",
    fecha_causacion: "2026-05-12",
    fecha_cobro_pago: null,
    folio: "COM-INT-0503",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · cierre comercial",
    proyecto: "Daiku",
    folio_cuenta: "CC-001750",
    contraparte: "Vladimir Huerta",
    rol: "Gerente Comercial",
    subtotal: 82_500,
    estado: "comprometida",
    cobro_previo: false,
  }),
  mov({
    id: "INT-005",
    fecha_causacion: "2026-04-30",
    fecha_cobro_pago: "2026-05-25",
    folio: "COM-INT-0491",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · cierre comercial",
    proyecto: "Monócolo",
    folio_cuenta: "CC-001722",
    contraparte: "Miguel Ochoa",
    rol: "Vendedor Interno",
    subtotal: 72_840,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "INT-006",
    fecha_causacion: "2026-04-18",
    fecha_cobro_pago: null,
    folio: "COM-INT-0482",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · producto extra",
    proyecto: "Daiku",
    folio_cuenta: "CCP-001741",
    contraparte: "Patricia Morales Guzmán",
    rol: "Account Manager",
    subtotal: 7_680,
    estado: "comprometida",
    cobro_previo: true,
  }),
  mov({
    id: "INT-007",
    fecha_causacion: "2026-04-09",
    fecha_cobro_pago: "2026-04-29",
    folio: "COM-INT-0478",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · servicios",
    proyecto: "Margot",
    folio_cuenta: "CCP-001703",
    contraparte: "Andrea López Fuentes",
    rol: "Vendedora Interna",
    subtotal: 4_960,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "INT-008",
    fecha_causacion: "2026-03-30",
    fecha_cobro_pago: "2026-04-24",
    folio: "COM-INT-0465",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · cierre comercial",
    proyecto: "Bottura",
    folio_cuenta: "CC-001688",
    contraparte: "Vladimir Huerta",
    rol: "Gerente Comercial",
    subtotal: 66_420,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "INT-009",
    fecha_causacion: "2026-03-22",
    fecha_cobro_pago: null,
    folio: "COM-INT-0461",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · cierre comercial",
    proyecto: "Daiku",
    folio_cuenta: "CC-001677",
    contraparte: "Miguel Ochoa",
    rol: "Vendedor Interno",
    subtotal: 83_080,
    estado: "comprometida",
    cobro_previo: false,
  }),
  mov({
    id: "INT-010",
    fecha_causacion: "2026-03-10",
    fecha_cobro_pago: "2026-04-04",
    folio: "COM-INT-0454",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · cierre comercial",
    proyecto: "Monócolo",
    folio_cuenta: "CC-001640",
    contraparte: "Andrea López Fuentes",
    rol: "Vendedora Interna",
    subtotal: 59_190,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "INT-011",
    fecha_causacion: "2026-03-04",
    fecha_cobro_pago: "2026-04-02",
    folio: "COM-INT-0449",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · producto",
    proyecto: "Bottura",
    folio_cuenta: "CCP-001625",
    contraparte: "Vladimir Huerta",
    rol: "Gerente Comercial",
    subtotal: 5_700,
    estado: "pagada",
    cobro_previo: true,
  }),
  mov({
    id: "INT-012",
    fecha_causacion: "2026-03-02",
    fecha_cobro_pago: "2026-03-26",
    folio: "COM-INT-0447",
    tipo_movimiento: "egreso",
    origen_egreso: "interno",
    concepto: "Dispersión interna · cierre comercial",
    proyecto: "Margot",
    folio_cuenta: "CC-001619",
    contraparte: "Miguel Ochoa",
    rol: "Vendedor Interno",
    subtotal: 30_000,
    estado: "pagada",
    cobro_previo: true,
  }),
];

/** Movimientos en exposición sin cobro previo — derivado del mock. */
export const MOCK_EXPOSICION: ExposicionCobroPrevio[] = MOCK_MOVIMIENTOS
  .filter((m) => m.tipo_movimiento === "egreso" && m.cobro_previo === false)
  .map((m) => ({
    id: m.id,
    folio_cuenta: m.folio_cuenta,
    beneficiario: m.contraparte,
    tipo: m.origen_egreso as "externo" | "interno",
    proyecto: m.proyecto,
    monto_comprometido: m.subtotal,
    dias_antiguedad: m.dias_antiguedad,
    estado: m.estado,
    flag_cobro: false,
  }));

/* ──────────────────────────────────────────────────────────
   Series mock para Evolución mensual (últimos 12 meses).
   Construidas para cuadrar visualmente con los totales arriba.
   ────────────────────────────────────────────────────────── */
export const MOCK_EVOLUCION_DEVENGADO: PuntoEvolucionMensual[] = [
  { mes: "2025-07-01", ingresos: 195_400, egresos: 130_290, resultado: 65_110, operaciones_ingreso: 2, operaciones_egreso: 4 },
  { mes: "2025-08-01", ingresos: 260_100, egresos: 178_482, resultado: 81_618, operaciones_ingreso: 3, operaciones_egreso: 5 },
  { mes: "2025-09-01", ingresos: 312_200, egresos: 214_910, resultado: 97_290, operaciones_ingreso: 3, operaciones_egreso: 6 },
  { mes: "2025-10-01", ingresos: 288_400, egresos: 200_220, resultado: 88_180, operaciones_ingreso: 3, operaciones_egreso: 6 },
  { mes: "2025-11-01", ingresos: 376_500, egresos: 265_080, resultado: 111_420, operaciones_ingreso: 4, operaciones_egreso: 7 },
  { mes: "2025-12-01", ingresos: 412_650, egresos: 285_460, resultado: 127_190, operaciones_ingreso: 4, operaciones_egreso: 8 },
  { mes: "2026-01-01", ingresos: 285_120, egresos: 196_088, resultado: 89_032, operaciones_ingreso: 3, operaciones_egreso: 6 },
  { mes: "2026-02-01", ingresos: 308_580, egresos: 213_092, resultado: 95_488, operaciones_ingreso: 3, operaciones_egreso: 6 },
  { mes: "2026-03-01", ingresos: 1_242_950, egresos: 836_322, resultado: 406_628, operaciones_ingreso: 6, operaciones_egreso: 12 },
  { mes: "2026-04-01", ingresos: 395_400, egresos: 270_544, resultado: 124_856, operaciones_ingreso: 3, operaciones_egreso: 6 },
  { mes: "2026-05-01", ingresos: 1_096_650, egresos: 819_606, resultado: 277_044, operaciones_ingreso: 4, operaciones_egreso: 8 },
  { mes: "2026-06-01", ingresos: 0, egresos: 0, resultado: 0, operaciones_ingreso: 0, operaciones_egreso: 0 },
];

export const MOCK_EVOLUCION_CAJA: PuntoEvolucionMensual[] = [
  { mes: "2025-07-01", ingresos: 175_000, egresos: 110_290, resultado: 64_710, operaciones_ingreso: 2, operaciones_egreso: 4 },
  { mes: "2025-08-01", ingresos: 220_100, egresos: 150_482, resultado: 69_618, operaciones_ingreso: 3, operaciones_egreso: 4 },
  { mes: "2025-09-01", ingresos: 295_200, egresos: 200_910, resultado: 94_290, operaciones_ingreso: 3, operaciones_egreso: 5 },
  { mes: "2025-10-01", ingresos: 270_400, egresos: 178_220, resultado: 92_180, operaciones_ingreso: 3, operaciones_egreso: 5 },
  { mes: "2025-11-01", ingresos: 360_500, egresos: 247_080, resultado: 113_420, operaciones_ingreso: 4, operaciones_egreso: 6 },
  { mes: "2025-12-01", ingresos: 392_650, egresos: 265_460, resultado: 127_190, operaciones_ingreso: 4, operaciones_egreso: 7 },
  { mes: "2026-01-01", ingresos: 245_120, egresos: 156_088, resultado: 89_032, operaciones_ingreso: 3, operaciones_egreso: 5 },
  { mes: "2026-02-01", ingresos: 270_580, egresos: 180_092, resultado: 90_488, operaciones_ingreso: 3, operaciones_egreso: 5 },
  { mes: "2026-03-01", ingresos: 871_550, egresos: 525_322, resultado: 346_228, operaciones_ingreso: 5, operaciones_egreso: 9 },
  { mes: "2026-04-01", ingresos: 395_400, egresos: 220_544, resultado: 174_856, operaciones_ingreso: 3, operaciones_egreso: 5 },
  { mes: "2026-05-01", ingresos: 856_650, egresos: 599_500, resultado: 257_150, operaciones_ingreso: 4, operaciones_egreso: 6 },
  { mes: "2026-06-01", ingresos: 50_400, egresos: 30_544, resultado: 19_856, operaciones_ingreso: 1, operaciones_egreso: 1 },
];
