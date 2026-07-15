// =============================================================
// Portal Condominio · Amenidades — Reservas de espacios reservables
// Modelo de datos (mock). Solo UI — sin STP/RLS reales todavía.
// Todo punto de integración se marca `// SWAP POINT:`.
// =============================================================

// Estado del SLOT (espacio + fecha + franja), no de la amenidad.
export type EstadoSlot =
  | "disponible" // reservable
  | "apartado" // hold de un residente, espera validación admin; caduca
  | "por_pagar" // admin validó, CLABE habilitada; espera pago; caduca
  | "reservada" // pago conciliado por STP; confirmada
  | "mantenimiento"; // bloqueado por admin, no reservable

export type TipoEspacio = "sala_juntas" | "sala_tv" | "asador" | "cocina_equipada";

export interface EspacioReservable {
  id: string;
  nombre: string; // "Sala de Juntas 1", "Asador 3", "Cocina Equipada A"
  tipo: TipoEspacio;
  capacidad: number;
  cuotaRenta: number; // MXN; 0 = sin costo
  depositoGarantia: number; // MXN; 0 = sin depósito
  requierePago: boolean; // derivado: cuotaRenta + deposito > 0
  franjasHorarias: string[]; // ["08:00-12:00", ...]
  clabeStp: string; // CLABE STP dedicada; tabular-nums // SWAP POINT
  activo: boolean;
}

export interface EntradaAuditoria {
  id: string;
  timestamp: string; // ISO
  usuario: string;
  accion: string; // "Solicitud creada", "Reserva validada", "Pago conciliado", ...
  detalle: string;
}

export interface Reserva {
  id: string;
  codigoReserva: string | null; // se genera al pasar a 'por_pagar'; tabular-nums
  espacioId: string;
  fecha: string; // ISO date (YYYY-MM-DD)
  franja: string; // una de franjasHorarias
  estado: EstadoSlot; // estado del slot para esa fecha/franja
  // Residente / unidad
  unidad: string; // "#1204"
  residenteNombre: string;
  // Elegibilidad (lo que valida el humano)
  unidadAlCorriente: boolean; // ¿mantenimiento al corriente? // SWAP POINT
  saldoVencidoDias: number; // para regla de morosidad
  // Pago
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
