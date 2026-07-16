// =============================================================
// Portal Condominio · Módulo "Validación de Titularidad"
// Modelo de datos (mock). Solo UI — sin persistencia real todavía.
// Todo punto de integración con backends reales se marca `// SWAP POINT:`.
// =============================================================

// Estado de validación de un dato o documento (dos ejes que conviven)
export type EstadoValidacion =
  | "en_revision"
  | "validado"
  | "rechazado"
  | "por_confirmar" // baja confianza OCR
  | "expirado";

export type EstadoRequerimiento = "pendiente" | "opcional" | "cargado";
export type EstadoVigencia = "vigente" | "por_vencer" | "expirado" | "no_aplica";

// Wrapper estándar SOZU: valor + estado + procedencia documental
export interface Campo<T> {
  valor: T | null;
  estado: EstadoValidacion;
  idDocumentoFuente: string | null; // "Tomado de: [documento]"
}

export type TipoPersona = "fisica" | "moral";
export type ContextoCompra = "contado" | "credito_hipotecario";
export type Antiguedad = "reciente" | "normal"; // reciente < 6 meses
export type NivelSolicitado = 1 | 2;
export type NivelOtorgado = 1 | 2 | null;

// Semáforo agregado de los cruces automáticos
export type Semaforo = "verde" | "ambar" | "rojo";

export type EstadoSolicitud =
  | "nueva"
  | "en_revision"
  | "info_solicitada"
  | "aprobada"
  | "rechazada";

export type AreaAsignada = "legal" | "escrituracion" | "administracion" | "cobranza";

// Verificación registral: la pieza crítica, NO un checkbox decorativo
export type EstadoRegistral = "no_iniciada" | "en_gestion" | "verificado" | "no_verificable";

export type TipoDocumento =
  | "identificacion"
  | "escritura"
  | "certificado_rpp"
  | "predial"
  | "curp_constancia" // persona física
  | "constancia_moral" // persona moral
  | "acta_constitutiva" // persona moral
  | "poder" // persona moral
  | "id_representante"; // persona moral

export interface DocumentoExpediente {
  id: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  urlMock: string; // placeholder para preview
  requerimiento: EstadoRequerimiento;
  estado: EstadoValidacion;
  vigencia: EstadoVigencia;
  // datos extraídos por "OCR" (mock), cada uno como Campo<T>
  datosExtraidos: Record<string, Campo<string>>;
  motivoRechazo?: string;
}

export interface Cruce {
  id: string;
  etiqueta: string; // p.ej. "Nombre ID = Escritura = RPP"
  resultado: Semaforo;
  detalle: string; // qué se comparó y qué se encontró
  esCadenaDominio?: boolean; // marca el cruce central
}

export interface Gravamen {
  existe: boolean;
  acreedor: string | null; // banco/acreedor si compra con crédito
}

export interface EntradaAuditoria {
  id: string;
  timestamp: string; // ISO
  usuario: string; // quién actuó
  accion: string; // qué hizo
  detalle: string; // evidencia/justificación
}

export interface SolicitudTitularidad {
  id: string; // folio interno de la solicitud
  // Solicitante
  tipoPersona: TipoPersona;
  nombreODireccionRazonSocial: string;
  rfc: Campo<string>;
  curp?: Campo<string>; // solo física
  razonSocial?: Campo<string>; // solo moral
  representanteLegal?: {
    // solo moral
    nombre: Campo<string>;
    curp: Campo<string>;
  };
  correo: string; // verificado
  telefono: string;
  // Propiedad
  desarrollo: "Margot";
  unidad: string; // "#201"
  folioReal: Campo<string>; // tabular-nums en UI
  direccion: string;
  modelo: "Breath" | "Heart" | "Joy" | "Kind" | "Soft";
  // SWAP POINT: duenoOriginalRegistrado debe leerse de la fuente única de
  // titularidad (registros SOZU / Legal Flow), NO de una tabla local del
  // Portal Condominio. Hoy en Margot muchas unidades figuran a nombre de
  // "Hevi Holding" (titular original/mayorista); el cruce de cadena de dominio
  // compara el enajenante de la escritura contra este valor.
  duenoOriginalRegistrado: string;
  // Contexto de compra
  contextoCompra: ContextoCompra;
  antiguedad: Antiguedad;
  // Expediente
  documentos: DocumentoExpediente[];
  cruces: Cruce[];
  semaforoAgregado: Semaforo; // peor caso de los cruces
  gravamen: Gravamen;
  // Verificación humana
  verificacionRegistral: EstadoRegistral;
  poderConFacultadesDominio?: boolean | null; // solo moral, revisión legal
  cadenaDominioConfirmada: boolean | null; // confirmación humana
  // Estado y decisión
  estado: EstadoSolicitud;
  nivelSolicitado: NivelSolicitado;
  nivelOtorgado: NivelOtorgado;
  areaAsignada: AreaAsignada | null;
  motivoRechazo?: string;
  fechaCreacion: string; // ISO
  diasEnCola: number; // para SLA/priorización
  auditoria: EntradaAuditoria[];
}
