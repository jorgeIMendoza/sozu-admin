/**
 * Modelo de datos — SOZU · Portal del Personal (Fase 1).
 * Los campos fiscales existen y se persisten, pero NO se renderizan en Fase 1.
 */

export type EstadoCampo = "vacio" | "sugerido" | "confirmado";

/** Modelo campo<T>: valor + estado + procedencia (trazabilidad). */
export type Campo<T> = {
  valor: T | null;
  estado: EstadoCampo;
  procedencia: string | null;
  actualizado_en: string | null;
};

export function campo<T>(
  valor: T | null,
  estado: EstadoCampo = "confirmado",
  procedencia: string | null = "captura_manual",
): Campo<T> {
  return {
    valor,
    estado,
    procedencia,
    actualizado_en: valor === null ? null : "2026-08-10T18:00:00-06:00",
  };
}

export type Auditoria = {
  creado_en: string;
  creado_por: string;
  actualizado_en: string;
  actualizado_por: string;
  /** Soft-disable, nunca hard-delete. */
  deprecado_en: string | null;
  deprecado_por: string | null;
  motivo: string | null;
};

export type TipoColaborador =
  | "EMPLEADO_REV"
  | "COLAB_INVESTIMENTO"
  | "PERSONAL_TALLWOOD";

export type LibroContable = "IVA_EXENTO" | "IVA_GRAVADO";

export type VehiculoPago = "BONO_NOMINA_038" | "COMISION_MERCANTIL";

export type Usuario = {
  id: string;
  nombre: string;
  foto_url: string | null;
  correo: string;
  telefono: string;
  rol: string;
  subrol: string;
  tipo_colaborador: TipoColaborador;
  elegible_referidos: boolean;
  motivo_inelegibilidad: string | null;
  codigo_referido: string;
  rfc: string;
  curp: string;
  clabe: string;
  banco: string;
  titular_clabe: string;
  clabe_valida: boolean;
  reglas_aceptadas_version: string | null;
  conflicto_interes_firmado_en: string | null;
  cuenta_bancaria_confirmada: boolean;
  biografia: string;
  desarrollos_asignados: string[];
  ultimo_acceso: string;
  activacion_pct: number;
  auditoria: Auditoria;
};

export type Desarrollo = {
  id: string;
  slug: string;
  nombre: string;
  direccion: string;
  desarrollador: "Tallwood";
  comercializador: "REV (SOZU)";
  imagen: string;
  precio_desde: number;
  total_unidades: number;
  disponibles: number;
  avance_obra: number;
  entrega_estimada: string;
  auditoria: Auditoria;
};

export type ProductoAdicional = {
  clave: string;
  tipo: "BODEGA" | "ESTACIONAMIENTO";
  monto: number;
  libro: LibroContable;
};

export type Unidad = {
  id: string;
  desarrollo_id: string;
  numero: string;
  modelo: string;
  nivel: number;
  precio: number;
  libro: LibroContable;
  superficie: number;
  recamaras: number;
  banos: number;
  bodegas: number;
  estacionamientos: number;
  tipo_estacionamiento: string;
  disponible: boolean;
  imagenes: string[];
  productos_adicionales: ProductoAdicional[];
  auditoria: Auditoria;
};

export type EsquemaPago = {
  id: string;
  unidad_id: string;
  nombre: string;
  pct_enganche: number;
  pct_mensualidades: number;
  pct_entrega: number;
  plazo_meses: number;
};

export type OrigenReferido = "LINK" | "MANUAL";

export type EstadoReferido =
  | "pendiente_confirmacion"
  | "confirmado"
  | "en_seguimiento"
  | "con_compra"
  | "sin_interes";

export type ActividadReferido = {
  tipo: "registro" | "contacto" | "cita" | "oferta" | "contrato";
  fecha: string;
  detalle: string;
};

export type Referido = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  tipo_persona: "FISICA" | "MORAL";
  rfc: string | null;
  curp: string | null;
  origen: OrigenReferido;
  desarrollos_interes: string[];
  estado: EstadoReferido;
  es_cliente: boolean;
  duplicado_crm: boolean;
  registro_original: string | null;
  confirmado_en: string | null;
  proteccion_hasta: string | null;
  ganancia_potencial: number;
  actividad: ActividadReferido[];
  auditoria: Auditoria;
};

export type EtapaNegocio =
  | "prospecto"
  | "oferta_enviada"
  | "apartado_pagado"
  | "contrato_firmado"
  | "escriturado"
  | "cierre_perdido";

export type Negocio = {
  id: string;
  desarrollo_id: string;
  unidad_label: string;
  folio: string;
  tipo: "Propiedad" | "Producto adicional";
  referido_id: string;
  etapa: EtapaNegocio;
  valor: number;
  ganancia_estimada: number;
  cobro_estimado: string;
  razon_cierre: string | null;
  auditoria: Auditoria;
};

export type EstatusGanancia =
  | "devengado"
  | "en_revision"
  | "aprobado"
  | "programado"
  | "depositado";

export type Ganancia = {
  id: string;
  folio: string;
  desarrollo_id: string;
  unidad_label: string;
  referido_id: string;
  compradores: number;
  venta: number;
  /** Único número visible en Fase 1: lo que recibe en su cuenta. */
  neto: number;
  /** Campos fiscales: persistidos, NO renderizados en Fase 1. */
  bruto: number;
  retenciones: number;
  clave_sat: string;
  vehiculo_pago: VehiculoPago;
  libro: LibroContable;
  estatus: EstatusGanancia;
  fecha_pago: string;
  auditoria: Auditoria;
};

export type Campania = {
  id: string;
  nombre: string;
  vigencia_inicio: string;
  vigencia_fin: string;
  pct_comision: number;
};

export type ReglasPrograma = {
  version: string;
  vigente_desde: string;
  secciones: { titulo: string; cuerpo: string[] }[];
};

export type EscenarioGuardado = {
  id: string;
  nombre: string;
  desarrollo_id: string;
  unidades: number;
  monto_total: number;
  cobro_estimado: string;
  creado_en: string;
  auditoria: Auditoria;
};

export type MetaPersonal = {
  id: string;
  usuario_id: string;
  objetivo_referidos: number;
  logrados: number;
  periodo: string;
};

export type TipoActivo = "IMAGEN" | "TEXTO" | "PDF" | "VIDEO";

export type ActivoPromocion = {
  id: string;
  desarrollo_id: string;
  tipo: TipoActivo;
  nombre: string;
  miniatura?: string | undefined;
  copy?: string | undefined;
  tamano?: string | undefined;
  url?: string | undefined;
  aprobado_por: string;
  aprobado_en: string;
  auditoria: Auditoria;
};

export type LogAuditoria = {
  id: string;
  fecha: string;
  usuario_id: string;
  accion: string;
  detalle: string;
  hash_previo: string | null;
};

/**
 * Vista derivada del motor de comisiones: vw_mi_comision_por_canal.
 * INVARIANTE — SEGURIDAD: solo el renglón del usuario autenticado.
 * NUNCA contiene sueldo, comisión externa, comisión dispersada total,
 * remanente de SOZU, comisión total del canal ni filas de otros usuarios.
 */
export type ComisionCanal = {
  canal_id: string;
  canal_nombre: string;
  /** Fracción sobre el precio de venta que le corresponde a ESTE usuario. */
  mi_porcentaje: number;
  aplica_a_referido_directo: boolean;
  aplica_a_participacion_canal: boolean;
};

/** Hitos de pago del programa. El componente acepta N hitos. */
export type HitoPago = {
  concepto: string;
  porcentaje: number;
  evento_disparador: string;
  fecha_estimada: string;
};
