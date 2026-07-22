// =============================================================
// Portal Condominio · Amenidades — modelo de datos (mock)
// UN solo catálogo de `Amenidad`; `modalidadUso` decide si enciende el motor
// de reservas. Solo UI — sin STP/RLS/Storage reales. Cada integración: // SWAP POINT.
// =============================================================

// ── Catálogo unificado ─────────────────────────────────────

export type ModalidadUso = "libre" | "reservable";

export type TipoAmenidad =
  | "sala_juntas" | "sala_tv" | "asador" | "cocina_equipada"
  | "gimnasio" | "lobby" | "roof_garden" | "sky_bar" | "sala_juegos"
  | "coworking" | "area_comercial" | "parque" | "otro";

export type ModeloCobro = "gratuito" | "por_franja" | "por_uso" | "por_hora";

export interface MediaItem {
  id: string;
  tipo: "imagen" | "video";
  url: string;              // SWAP POINT: Supabase Storage. En mock, placeholder/URL local.
  titulo?: string;
  orden: number;
  esPortada?: boolean;
}

export interface ConfiguracionReserva {
  modeloCobro: ModeloCobro;
  tarifa: number;                 // MXN (0 si gratuito)
  depositoGarantia: number;       // MXN; 0 = sin depósito
  franjasHorarias: string[];      // ["08:00-12:00", ...] resolución de bloque, NO por minuto
  capacidad: number;
  clabeStp: string;               // SWAP POINT: CLABE STP real por espacio
  requiereValidacionAdmin: boolean; // default true
  umbralMorosidadDias: number | null;
}

export interface Amenidad {
  id: string;
  condominioId: string;       // "margot" — NUNCA default a 1
  nombre: string;
  tipo: TipoAmenidad;
  ubicacion: string;
  descripcion: string;
  media: MediaItem[];
  modalidadUso: ModalidadUso;
  reserva: ConfiguracionReserva | null; // null si modalidadUso === "libre"
  activo: boolean;            // soft-disable, NUNCA hard-delete
  auditoria: EntradaAuditoria[];
}

// ── Motor de reservas (preservado) ─────────────────────────

// Estado del SLOT (espacio + fecha + franja), no de la amenidad.
export type EstadoSlot =
  | "disponible" // reservable
  | "apartado" // hold de un residente, espera validación admin; caduca
  | "por_pagar" // admin validó, CLABE habilitada; espera pago; caduca
  | "reservada" // pago conciliado por STP; confirmada
  | "mantenimiento"; // bloqueado por admin, no reservable

// Alias de compatibilidad: el motor tipa espacios con el conjunto amplio.
export type TipoEspacio = TipoAmenidad;

/**
 * Vista que consume el motor de reservas (calendario, bandejas, SlotModal).
 * NO se persiste: se DERIVA del catálogo (`amenidades` reservable && activo)
 * en el store. Cambiar la tarifa/franjas de una `Amenidad.reserva` se refleja
 * aquí para reservas NUEVAS; las confirmadas guardan su propio snapshot.
 */
export interface EspacioReservable {
  id: string;                // === Amenidad.id
  nombre: string;
  tipo: TipoEspacio;
  capacidad: number;
  cuotaRenta: number; // MXN; 0 = sin costo
  depositoGarantia: number; // MXN; 0 = sin depósito
  requierePago: boolean; // derivado: modeloCobro !== gratuito && cuota+deposito > 0
  franjasHorarias: string[]; // ["08:00-12:00", ...]
  clabeStp: string; // CLABE STP dedicada; tabular-nums // SWAP POINT
  activo: boolean;
}

export interface EntradaAuditoria {
  id: string;
  timestamp: string; // ISO
  usuario: string;
  accion: string; // "Solicitud creada", "Reserva validada", "Amenidad creada", ...
  detalle: string;
}

export interface Reserva {
  id: string;
  codigoReserva: string | null; // se genera al pasar a 'por_pagar'; tabular-nums
  espacioId: string;            // === Amenidad.id
  fecha: string; // ISO date (YYYY-MM-DD)
  franja: string; // una de franjasHorarias
  estado: EstadoSlot; // estado del slot para esa fecha/franja
  // Residente / unidad
  unidad: string; // "#1204"
  residenteNombre: string;
  // Elegibilidad (lo que valida el humano)
  unidadAlCorriente: boolean; // ¿mantenimiento al corriente? // SWAP POINT
  saldoVencidoDias: number; // para regla de morosidad
  // Pago (snapshot al crear la solicitud)
  cuota: number;
  deposito: number;
  montoTotal: number;
  pagoConciliado: boolean; // lo pone STP, no el humano
  referenciaStp: string | null; // // SWAP POINT
  // Caducidades
  holdCreadoEn: string | null; // ISO; base para 48h
  pagoHabilitadoEn: string | null; // ISO; base para 24h
  // Decisión admin
  motivoRechazo: string | null;
  // Auditoría
  auditoria: EntradaAuditoria[];
}

export interface BloqueoMantenimiento {
  id: string;
  espacioId: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD (inclusive)
  motivo: string; // "Limpieza profunda", "Reparación", "Evento del condominio"
  creadoPor: string;
}

// Abono STP recibido que NO casa con ninguna reserva por_pagar (excepción de
// conciliación que la administración debe resolver — no confirma pagos normales).
export interface AbonoExcepcion {
  id: string;
  referenciaStp: string;
  monto: number;
  fecha: string; // ISO
  nota: string; // por qué no casa (monto/ref no coincide)
}
