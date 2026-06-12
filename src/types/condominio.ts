// Tipos del Portal Condominio — datos reales (Margot y futuros proyectos entregados).
// "Condominio" = proyecto entregado con cuentas de cobranza de mantenimiento.

export interface CondominioRef {
  id: number;
  nombre: string;
}

export type EstatusUnidad = "ocupado" | "renta_corta";

export interface UnidadCondominio {
  id: string; // = String(cuentaMantId)
  cuentaMantId: number;
  cuentaPadreId: number;
  propiedadId: number;
  /** Folio formateado de la cuenta de mantenimiento (CM-XXXXXX). */
  folio_mant: string;
  numero: string; // numero_propiedad
  piso: string; // numero_piso
  tipo: string; // tipos_propiedad.nombre
  area_m2: number; // m2_interiores + m2_exteriores
  estatus: EstatusUnidad;
  propietario: string;
  residente: string; // "—" si no hay residente registrado
  clabe: string; // clabe_stp de la cuenta de mantenimiento
  referencia_pago: string;
  cuota_mensual: number; // monto del acuerdo de mantenimiento más reciente
  saldo_actual: number; // suma de acuerdos pendientes (no completados)
  saldo_vencido: number; // suma de acuerdos pendientes con fecha < hoy
  ultimo_pago: string | null;
  /** Nombre del edificio del proyecto. */
  edificio_nombre: string;
  /** Nombre del modelo arquitectónico. */
  modelo_nombre: string;
  /** Σ monto de acuerdos devengados a la fecha (cuotas con fecha_pago ≤ hoy,
   *  estén pagados o no). Es lo que la unidad debería haber pagado al día. */
  pago_acumulado: number;
  /** Σ monto de pagos efectivamente recibidos sobre la cuenta. */
  total_pagado: number;
  /** Diferencia pago_acumulado − total_pagado.
   *  Positivo = pendiente · Negativo = a favor del residente. */
  saldo_balance: number;
  /** Próximo acuerdo no completado con fecha > hoy (ISO YYYY-MM-DD), si existe. */
  proxima_fecha_pago: string | null;
  /** Cuentas hermanas (bodega/estacionamiento) asociadas a la misma propiedad
   *  vía cuenta_cobranza_padre. Cada string es el folio CC-XXXXXX. */
  complementos: string[];
}

export type CategoriaCargo = "mantenimiento" | "multa";
export type EstatusCargo = "pendiente" | "pagado" | "vencido";

export interface CargoCondominio {
  id: string;
  unidad_id: string;
  unidad_numero: string;
  concepto: string;
  categoria: CategoriaCargo;
  monto: number;
  fecha_generacion: string | null;
  fecha_vencimiento: string;
  estatus: EstatusCargo;
}

export type EstatusConciliacion = "conciliado" | "excepcion" | "pendiente";

export interface PagoCondominio {
  id: string;
  unidad_id: string;
  unidad_numero: string;
  /** Folio CM-XXXXXX de la cuenta de mantenimiento. */
  folio_mant: string;
  /** Propietario(s) de la propiedad. */
  propietario: string;
  /** Residente actual (o "—" si no hay). */
  residente: string;
  monto: number;
  fecha: string;
  referencia: string;
  concepto: string;
  /** "mantenimiento" o "multa" — categoría del cargo que pagó. */
  categoria: CategoriaCargo;
  /** URL pública del comprobante (STP → url_cep, transferencia/efectivo → url_recibo). */
  url_comprobante: string | null;
  /** Etiqueta del método de pago (Efectivo, STP, Transferencia…). */
  metodo_pago: string;
  estatus_conciliacion: EstatusConciliacion;
  nota_conciliacion?: string;
}

export type BucketAntiguedad = "1-30" | "31-60" | "61-90" | "90+";

export interface MorosoCondominio {
  id: string;
  unidad_id: string;
  unidad_numero: string;
  propietario: string;
  monto_vencido: number;
  antiguedad: BucketAntiguedad;
  ultimo_pago: string | null;
}

export interface AmenidadCondominio {
  id: string;
  nombre: string;
  url: string | null;
}

export interface CondominioKPIs {
  totalEsperado: number;
  totalCobrado: number;
  tasaCobranza: number;
  totalVencido: number;
  saldoPendiente: number;
  morosos: number;
  excepciones: number;
  numUnidades: number;
}

export interface TendenciaMes {
  mes: string;
  esperado: number;
  cobrado: number;
}

export interface AntiguedadBucket {
  rango: string;
  monto: number;
  cuentas: number;
}

export interface CondominioDataset {
  /** Nombre del proyecto (constante en todo el dataset). */
  proyecto_nombre: string;
  unidades: UnidadCondominio[];
  cargos: CargoCondominio[];
  pagos: PagoCondominio[];
  morosos: MorosoCondominio[];
  amenidades: AmenidadCondominio[];
  kpis: CondominioKPIs;
  tendenciaMensual: TendenciaMes[];
  antiguedad: AntiguedadBucket[];
}
