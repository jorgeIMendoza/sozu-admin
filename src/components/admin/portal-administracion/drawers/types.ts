/* ──────────────────────────────────────────────────────────
   Tipos compartidos del sistema de drawers del Portal Alta
   Dirección. Mantener slim — todos los drawers usan estos.
   ────────────────────────────────────────────────────────── */

export type EstadoVenta =
  | "En oferta"
  | "En apartado"
  | "En firma"
  | "Vendida"
  | "Liquidada";

export type VentaContext = {
  folio: string;
  propiedad: string;
  cliente: string;
  cliente_rfc?: string;
  precio_venta: number;
  comision_total_sozu: number;
  porcentaje_comision: number;
  estado_venta: EstadoVenta;
  dias_desde_apartado: number;
};

export type EntityType =
  | "venta_para_facturar"
  | "pago_externo"
  | "comision_interna"
  | "excepcion"
  | "factura_por_cobrar"
  | "comision_externa"
  // Ejecución (Portal de Administración) — autorizadas por Dirección, listas para ejecutar
  | "ejecucion_cobro"
  | "ejecucion_pago_externo"
  | "ejecucion_dispersion"
  | "ejecucion_excepcion";

export const ENTITY_LABEL: Record<EntityType, string> = {
  venta_para_facturar: "Venta para facturar",
  pago_externo: "Pago a externo",
  comision_interna: "Comisión interna",
  excepcion: "Excepción",
  factura_por_cobrar: "Factura por cobrar",
  comision_externa: "Comisión externa",
  ejecucion_cobro: "Cobro por gestionar",
  ejecucion_pago_externo: "Pago a externo por ejecutar",
  ejecucion_dispersion: "Dispersión interna",
  ejecucion_excepcion: "Excepción por aplicar",
};

export const ENTITY_TONE: Record<EntityType, string> = {
  venta_para_facturar: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  pago_externo: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  comision_interna: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  excepcion: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  factura_por_cobrar: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  comision_externa: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  ejecucion_cobro: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ejecucion_pago_externo: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ejecucion_dispersion: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ejecucion_excepcion: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

export const ENTITY_SUBTITLE: Record<EntityType, string> = {
  venta_para_facturar: "Venta lista para facturar al desarrollador",
  pago_externo: "Factura recibida de un externo — pendiente de validar pago",
  comision_interna: "Comisión interna SOZU — pendiente autorización de dispersión",
  excepcion: "Decisión fuera de política — requiere VoBo Dirección",
  factura_por_cobrar: "CFDI emitido por SOZU al desarrollador",
  comision_externa: "Obligación de SOZU con colaborador externo",
  ejecucion_cobro: "Venta con factura autorizada por Dirección — pendiente de emisión o cobro",
  ejecucion_pago_externo: "Pago a externo autorizado por Dirección y con cobro previo confirmado",
  ejecucion_dispersion: "Comisión interna autorizada por Dirección — lista para dispersar",
  ejecucion_excepcion: "Excepción a política aprobada por Dirección — pendiente de aplicar en sistema",
};

/* ──────────────────────────────────────────────────────────
   Datos contractuales por content component
   (cada calling page mapea sus mocks a estos shapes)
   ────────────────────────────────────────────────────────── */

export type VentaParaFacturarEntity = {
  folio_cuenta: string;
  fecha_venta: string;
  dias_esperando: number;
  monto_factura_desarrollador: number;
  comprador_principal: string;
  rfc_comprador: string;
  desarrollador_nombre: string;
};

export type PagoExternoEntity = {
  folio_cfdi: string;
  uuid_sat?: string;
  beneficiario_nombre: string;
  beneficiario_rfc?: string;
  beneficiario_tipo: "inmobiliaria" | "broker" | "aliado_comercial" | "agente_externo";
  monto: number;
  fecha_emision: string;
  dias_desde_emision: number;
  ya_se_cobro_al_desarrollador: boolean;
  factura_cobrar_referencia?: string;
  factura_cobrar_emitida_dias?: number;
  /** ID Cuenta vinculada (formato CC-/CCP-). Permite cargar el expediente. */
  folio_cuenta?: string;
  /** URL del PDF de la factura del externo (documentos tipo=46). */
  url_factura_externa?: string | null;
  /** Estatus del pago al externo. */
  estatus_pago?: "espera_autorizacion" | "autorizada" | "pagada" | "rechazada";
  /** Fecha en que se ejecutó el pago al externo (cuando estatus_pago = pagada). */
  fecha_pago?: string | null;
  /** ID numérico de cuentas_cobranza — necesario para persistir autorización. */
  id_cuenta_cobranza?: number;
};

export type ComisionInternaEntity = {
  folio: string;
  comisionista_nombre: string;
  comisionista_rol: string;
  comisionista_email?: string;
  porcentaje_comision: number;
  monto: number;
  fecha_devengo?: string;
  fecha_aprobacion?: string;
  dias_esperando_director: number;
  estado: "aprobada" | "autorizada" | "dispersada" | "devengada" | "cancelada";
};

export type ExcepcionEntity = {
  id_excepcion: number;
  tipo: "descuento_fuera_politica" | "pago_parcial_fuera_esquema" | "ajuste_manual" | "otro";
  descripcion_corta: string;
  solicitante: string;
  monto_impactado: number;
  delta: number;
};

export type FacturaPorCobrarEntity = {
  folio_cfdi: string;
  uuid_sat: string;
  desarrollador_nombre: string;
  desarrollador_rfc: string;
  concepto: string;
  monto_subtotal: number;
  iva: number;
  monto_total: number;
  monto_cobrado: number;
  fecha_emision: string;
  fecha_pago_esperada: string;
  fecha_pago_real?: string;
  dias_desde_emision: number;
  dias_para_vencer: number;
  estado: "timbrada_pendiente" | "cobro_parcial" | "cobrada" | "vencida" | "cancelada";
};

export type ComisionExternaEntity = {
  folio: string;
  beneficiario_nombre: string;
  beneficiario_rfc: string;
  beneficiario_tipo: "inmobiliaria" | "broker" | "aliado_comercial" | "agente_externo";
  porcentaje_comision: number;
  monto: number;
  fecha_devengo: string;
  fecha_aprobacion?: string;
  fecha_pago?: string;
  dias_desde_devengo: number;
  factura_referencia?: string;
  ya_se_cobro_al_desarrollador: boolean;
  estado: "devengada" | "aprobada" | "facturada" | "pagada" | "cancelada";
};
