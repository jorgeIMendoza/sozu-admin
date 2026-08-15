// ---------- Catálogos ----------
export type TipoFactor =
  | "torre"
  | "nivel"
  | "vista"
  | "orientacion"
  | "plano"
  | "extras"
  | "tamano";

export type EstadoVersion = "borrador" | "publicada" | "archivada";

export type EstadoCalibracion =
  | "sin_calibrar"
  | "calibrado"
  | "desactualizado"
  | "calibrado_manualmente";

export type LibroContable = "Comercial";

// ---------- Inventario (lectura desde el mock compartido) ----------
export interface Proyecto {
  id_proyecto: string;
  nombre: string;
  desarrollador: string;
  ciudad: string;
  num_departamentos: number;
  activo: boolean;
}

export interface Torre {
  id_torre: string;
  id_proyecto: string;
  nombre: string;
  fecha_entrega_estimada: string;
  activo: boolean;
}

export interface Modelo {
  id_modelo: string;
  id_proyecto: string;
  nombre: string;
  recamaras: number;
  banos_completos: number;
  medios_banos: number;
  caracteristicas: string[];
  activo: boolean;
}

export interface Propiedad {
  id_propiedad: string;
  id_proyecto: string;
  id_torre: string;
  id_modelo: string;
  numero: string;
  nivel: number;
  m2_interiores: number;
  m2_exteriores: number;
  m2_loft: number;
  vista: string;
  orientacion: string;
  num_cajones: number;
  tipo_cajon: "independiente" | "tandem";
  tiene_bodega: boolean;
  m2_bodega: number;
  caracteristicas_extra: string[];
  propietario: string;
  tipo_transaccion: string;
  tipo_propiedad: string;
  estatus: string;
  precio_lista_actual: number;
  activo: boolean;
}

// ---------- Motor de precios ----------
export interface FactorPrecio {
  id_factor: string;
  tipo_factor: TipoFactor;
  clave: string;
  etiqueta: string;
  valor: number;
  activo: boolean;
}

export interface ConfiguracionNivel {
  coef_a: number;
  coef_b: number;
}

export interface ConfiguracionTamano {
  theta: number;
  /** Solo presente en motores en formato anterior al anclaje por modelo. */
  m2_referencia?: number;
}

/** Combinación de condiciones de menor valor del proyecto. Vale 1.0000 por construcción. */
export interface AnclaProyecto {
  id_torre: string;
  nivel: number;
  clave_vista: string;
  clave_orientacion: string;
  /** Texto legible generado. */
  descripcion: string;
}

/** Precio por m² de la unidad ancla de un modelo y su área tipo. */
export interface BaseModelo {
  id_modelo: string;
  nombre_modelo: string;
  precio_base_m2: number;
  m2_referencia: number;
  activo: boolean;
}

export interface MotorPrecio {
  id_motor: string;
  id_proyecto: string;
  nombre: string;
  /** Unidad ancla del proyecto. */
  ancla: AnclaProyecto;
  /** Precio base por m² y m² de referencia, por modelo. */
  bases_modelo: BaseModelo[];
  /** Solo presente en snapshots de versiones publicadas en el formato anterior. */
  precio_base_m2?: number;
  k_ext: number;
  k_loft: number;
  nivel: ConfiguracionNivel;
  tamano: ConfiguracionTamano;
  precio_cajon: number;
  factor_cajon_tandem: number;
  precio_m2_bodega: number;
  factores: FactorPrecio[];
  tasa_descuento_anual: number;
  activo: boolean;
  actualizado_en: string;
  /** Estado de calibración del motor. Controla la compuerta de la alerta DELTA_ALTO. */
  estado_calibracion: EstadoCalibracion;
  fecha_calibracion: string | null;
  /** Retraso esperado del pago contra entrega, en meses. */
  meses_holgura_entrega: number;
  /** Factor de VPN objetivo del proyecto; null = usar el del esquema base. */
  vpn_objetivo_factor: number | null;
  /** Días que una cotización entregada permanece vigente. */
  vigencia_oferta_dias: number;

}

// ---------- Resultado del cálculo ----------
export interface AlertaCalidad {
  codigo: string;
  severidad: "informativa" | "advertencia" | "critica";
  mensaje: string;
}

export interface DesglosePrecio {
  id_propiedad: string;
  area_ponderada: number;
  f_torre: number;
  f_nivel: number;
  f_vista: number;
  f_orientacion: number;
  f_extras: number;
  f_tamano: number;
  componente_exento: number;
  componente_gravado: number;
  precio_calculado: number;
  precio_override: number | null;
  motivo_override: string | null;
  precio_lista: number;
  delta_vs_actual: number;
  delta_pct: number;
  bloqueada_para_reprecio: boolean;
  /** Motivo del bloqueo de reprecio, cuando aplica. */
  motivo_bloqueo:
    | "apartada"
    | "vendida"
    | "oferta_vigente"
    | "conversion_pendiente"
    | null;
  alertas: AlertaCalidad[];
}

// ---------- Esquemas de financiamiento con eje temporal ----------

export type ModoEscalonamiento = "lineal" | "tramos";

/** Régimen comercial del esquema. */
export type TipoEsquema = "preventa" | "post_entrega";

export interface TramoEscalonado {
  /** Proporción del total de mensualidades asignada a este tramo, 0 a 1. */
  peso: number;
}

export interface EsquemaFinanciamiento {
  id_esquema: string;
  id_proyecto: string;
  nombre: string;
  /** preventa = paga durante obra y liquida contra entrega; post_entrega = inmueble terminado. */
  tipo_esquema: TipoEsquema;


  // Composición porcentual
  pct_enganche: number;
  pct_mensualidades: number;
  pct_entrega: number;
  num_mensualidades: number;
  escalonadas: boolean;
  modo_escalonamiento: ModoEscalonamiento;
  tramos: TramoEscalonado[];
  factor_crecimiento: number;

  // Eje temporal
  meses_enganche: number;
  mes_inicio_mensualidades: number;

  // Política comercial
  pct_ajuste_manual: number;
  es_base: boolean;
  es_contado: boolean;

  activo: boolean;
  creado_en: string;
}

export interface FlujoMensual {
  mes: number;
  pct: number;
  concepto: "enganche" | "mensualidad" | "entrega";
  monto?: number;
  factor_descuento?: number;
  valor_presente?: number;
}

export interface AdvertenciaEsquema {
  codigo: string;
  severidad: "informativa" | "advertencia" | "critica";
  mensaje: string;
}

export interface ResultadoVPN {
  id_esquema: string;
  horizonte_meses: number;
  tasa_mensual: number;
  flujos: FlujoMensual[];
  factor_vpn: number;
  factor_vpn_con_ajuste: number;
  plazo_promedio_ponderado: number;
  ajuste_equivalente: number;
  brecha_politica: number;
  descuento_max_autorizable: number;
  advertencias: AdvertenciaEsquema[];
}

// ---------- Bitácora de auditoría ----------
export type TipoEvento =
  // Motor
  | "motor.parametro_actualizado"
  | "motor.factor_creado"
  | "motor.factor_actualizado"
  | "motor.factor_desactivado"
  | "motor.factor_reactivado"
  | "motor.restablecido"
  // Calibración
  | "calibracion.ejecutada"
  | "calibracion.coeficientes_aplicados"
  | "calibracion.atipico_clasificado"
  | "calibracion.baseline_congelado"
  | "calibracion.declarada_manualmente"
  // Precios
  | "precio.override_aplicado"
  | "precio.override_removido"
  | "precio.override_masivo"
  // Esquemas
  | "esquema.creado"
  | "esquema.actualizado"
  | "esquema.desactivado"
  | "esquema.marcado_base"
  // Escenarios
  | "escenario.guardado"
  | "escenario.archivado"
  // Ofertas
  | "oferta.registrada"
  | "oferta.cancelada"
  | "oferta.vencida"
  // Versiones
  | "version.creada"
  | "version.publicada"
  | "version.archivada"
  | "version.publicacion_bloqueada"
  // Salida de datos
  | "exportacion.csv";

export interface ActorEvento {
  id_persona: string;
  nombre: string;
  rol: string;
}

export interface EventoAuditoria {
  id_evento: string;
  secuencia: number;
  ocurrido_en: string;
  actor: ActorEvento;
  id_proyecto: string;
  tipo: TipoEvento;
  entidad: { tipo: string; id: string; etiqueta: string };
  antes: unknown | null;
  despues: unknown | null;
  impacto_pesos: number | null;
  motivo: { causa: string; descripcion: string } | null;
  libro: "Comercial";
  hash_anterior: string;
  hash: string;
}

// ---------- Ofertas vigentes ----------
export type EstadoOferta = "vigente" | "vencida" | "cancelada" | "convertida";

export interface OfertaVigente {
  id_oferta: string;
  id_proyecto: string;
  id_propiedad: string;
  precio_ofertado: number;
  id_esquema: string;
  nombre_esquema: string;
  descuento_adicional: number;
  emitida_en: string;
  vigencia_dias: number;
  vence_en: string;
  estado: EstadoOferta;
  emitida_por: ActorEvento;
  referencia_cliente: string;
  notas: string;
  cancelada_en: string | null;
  motivo_cancelacion: string | null;
  convertida_en: string | null;
}

// ---------- Versiones de lista ----------
export interface PrecioVersion {
  precio_calculado: number;
  precio_override: number | null;
  precio_lista: number;
  componente_exento: number;
  componente_gravado: number;
}

export interface VersionLista {
  id_version: string;
  id_proyecto: string;
  numero: number;
  nombre: string;
  estado: EstadoVersion;
  creada_en: string;
  creada_por: ActorEvento;
  publicada_en: string | null;
  publicada_por: ActorEvento | null;
  snapshot_motor: MotorPrecio;
  precios: Record<string, PrecioVersion>;
  unidades_incluidas: string[];
  unidades_excluidas: { id_propiedad: string; motivo: string }[];
  valor_total: number;
  notas: string;
}
