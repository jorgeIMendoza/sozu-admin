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
  monto: number;
  fecha: string;
  referencia: string;
  concepto: string;
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
  unidades: UnidadCondominio[];
  cargos: CargoCondominio[];
  pagos: PagoCondominio[];
  morosos: MorosoCondominio[];
  amenidades: AmenidadCondominio[];
  kpis: CondominioKPIs;
  tendenciaMensual: TendenciaMes[];
  antiguedad: AntiguedadBucket[];
}
