// =============================================================
// Portal Condominio · Amenidades — datos mock
// 9 espacios reservables de Margot + reservas cubriendo los 5 estados,
// morosidad, caducidad próxima, excepción de pago y espacio sin costo.
// Desarrollo "Margot" explícito (nunca id_proyecto=1 por defecto).
// =============================================================
import type {
  AbonoExcepcion,
  BloqueoMantenimiento,
  EntradaAuditoria,
  EspacioReservable,
  Reserva,
} from "./types";

// Base temporal capturada una vez (runtime de la app). Las caducidades del
// demo se calculan relativas a este instante.
const BASE = Date.now();
const H = 3600_000;
const D = 24 * H;

const isoFromBase = (hrs: number) => new Date(BASE + hrs * H).toISOString();
const dateFromBase = (days: number) => new Date(BASE + days * D).toISOString().slice(0, 10);

function requierePago(cuota: number, deposito: number) {
  return cuota + deposito > 0;
}

const FRANJAS_SALA = ["08:00-10:00", "10:00-12:00", "12:00-14:00", "16:00-18:00"];
const FRANJAS_ASADOR = ["10:00-14:00", "14:00-18:00", "18:00-22:00"];
const FRANJAS_COCINA = ["10:00-14:00", "14:00-18:00", "18:00-22:00"];

export const MOCK_ESPACIOS: EspacioReservable[] = [
  esp("esp-sj1", "Sala de Juntas 1", "sala_juntas", 10, 300, 500, FRANJAS_SALA, "646180157000000001"),
  esp("esp-sj2", "Sala de Juntas 2", "sala_juntas", 8, 300, 500, FRANJAS_SALA, "646180157000000002"),
  // Sin costo: prueba el camino apartado → validado → reservada (salta por_pagar).
  esp("esp-tv", "Sala de TV", "sala_tv", 12, 0, 0, ["16:00-18:00", "18:00-20:00", "20:00-22:00"], "646180157000000003"),
  esp("esp-as1", "Asador 1", "asador", 15, 250, 400, FRANJAS_ASADOR, "646180157000000004"),
  esp("esp-as2", "Asador 2", "asador", 15, 250, 400, FRANJAS_ASADOR, "646180157000000005"),
  esp("esp-as3", "Asador 3", "asador", 15, 250, 400, FRANJAS_ASADOR, "646180157000000006"),
  esp("esp-as4", "Asador 4", "asador", 15, 250, 400, FRANJAS_ASADOR, "646180157000000007"),
  esp("esp-coA", "Cocina Equipada A", "cocina_equipada", 20, 500, 800, FRANJAS_COCINA, "646180157000000008"),
  esp("esp-coB", "Cocina Equipada B", "cocina_equipada", 20, 500, 800, FRANJAS_COCINA, "646180157000000009"),
];

function esp(
  id: string,
  nombre: string,
  tipo: EspacioReservable["tipo"],
  capacidad: number,
  cuotaRenta: number,
  depositoGarantia: number,
  franjasHorarias: string[],
  clabeStp: string,
): EspacioReservable {
  return {
    id,
    nombre,
    tipo,
    capacidad,
    cuotaRenta,
    depositoGarantia,
    requierePago: requierePago(cuotaRenta, depositoGarantia),
    franjasHorarias,
    clabeStp,
    activo: true,
  };
}

function aud(id: string, hrs: number, usuario: string, accion: string, detalle: string): EntradaAuditoria {
  return { id, timestamp: isoFromBase(hrs), usuario, accion, detalle };
}

export const MOCK_RESERVAS: Reserva[] = [
  // 1) apartado recién creado (hold 48h con horas de sobra)
  {
    id: "res-1",
    codigoReserva: null,
    espacioId: "esp-sj1",
    fecha: dateFromBase(5),
    franja: "10:00-12:00",
    estado: "apartado",
    unidad: "#402",
    residenteNombre: "Andrea Salcedo",
    unidadAlCorriente: true,
    saldoVencidoDias: 0,
    cuota: 300,
    deposito: 500,
    montoTotal: 800,
    pagoConciliado: false,
    referenciaStp: null,
    holdCreadoEn: isoFromBase(-2),
    pagoHabilitadoEn: null,
    motivoRechazo: null,
    auditoria: [aud("a-1-1", -2, "Andrea Salcedo (#402)", "Solicitud creada", "Apartó Sala de Juntas 1 · 10:00-12:00.")],
  },
  // 2) apartado a punto de caducar (2h restantes)
  {
    id: "res-2",
    codigoReserva: null,
    espacioId: "esp-as1",
    fecha: dateFromBase(3),
    franja: "14:00-18:00",
    estado: "apartado",
    unidad: "#809",
    residenteNombre: "Marco Beltrán",
    unidadAlCorriente: true,
    saldoVencidoDias: 0,
    cuota: 250,
    deposito: 400,
    montoTotal: 650,
    pagoConciliado: false,
    referenciaStp: null,
    holdCreadoEn: isoFromBase(-46),
    pagoHabilitadoEn: null,
    motivoRechazo: null,
    auditoria: [aud("a-2-1", -46, "Marco Beltrán (#809)", "Solicitud creada", "Apartó Asador 1 · 14:00-18:00.")],
  },
  // 3) apartado con morosidad (saldo vencido 92 días)
  {
    id: "res-3",
    codigoReserva: null,
    espacioId: "esp-coA",
    fecha: dateFromBase(7),
    franja: "18:00-22:00",
    estado: "apartado",
    unidad: "#1204",
    residenteNombre: "Rodrigo Fuentes",
    unidadAlCorriente: false,
    saldoVencidoDias: 92,
    cuota: 500,
    deposito: 800,
    montoTotal: 1300,
    pagoConciliado: false,
    referenciaStp: null,
    holdCreadoEn: isoFromBase(-5),
    pagoHabilitadoEn: null,
    motivoRechazo: null,
    auditoria: [aud("a-3-1", -5, "Rodrigo Fuentes (#1204)", "Solicitud creada", "Apartó Cocina Equipada A · 18:00-22:00.")],
  },
  // 4) por_pagar con ventana amplia (23h restantes)
  {
    id: "res-4",
    codigoReserva: "RSV-000104",
    espacioId: "esp-sj2",
    fecha: dateFromBase(6),
    franja: "12:00-14:00",
    estado: "por_pagar",
    unidad: "#310",
    residenteNombre: "Lucía Márquez",
    unidadAlCorriente: true,
    saldoVencidoDias: 0,
    cuota: 300,
    deposito: 500,
    montoTotal: 800,
    pagoConciliado: false,
    referenciaStp: null,
    holdCreadoEn: isoFromBase(-10),
    pagoHabilitadoEn: isoFromBase(-1),
    motivoRechazo: null,
    auditoria: [
      aud("a-4-1", -10, "Lucía Márquez (#310)", "Solicitud creada", "Apartó Sala de Juntas 2 · 12:00-14:00."),
      aud("a-4-2", -1, "C. Delgado (Administración)", "Reserva validada", "Elegibilidad confirmada. Código RSV-000104. CLABE habilitada."),
    ],
  },
  // 5) por_pagar a punto de caducar (1h restante) — excepción tipo (a): abono no ha llegado
  {
    id: "res-5",
    codigoReserva: "RSV-000105",
    espacioId: "esp-coB",
    fecha: dateFromBase(4),
    franja: "14:00-18:00",
    estado: "por_pagar",
    unidad: "#1507",
    residenteNombre: "Diana Reyes",
    unidadAlCorriente: true,
    saldoVencidoDias: 0,
    cuota: 500,
    deposito: 800,
    montoTotal: 1300,
    pagoConciliado: false,
    referenciaStp: null,
    holdCreadoEn: isoFromBase(-32),
    pagoHabilitadoEn: isoFromBase(-23),
    motivoRechazo: null,
    auditoria: [
      aud("a-5-1", -32, "Diana Reyes (#1507)", "Solicitud creada", "Apartó Cocina Equipada B · 14:00-18:00."),
      aud("a-5-2", -23, "C. Delgado (Administración)", "Reserva validada", "Código RSV-000105. CLABE habilitada; en espera de abono STP."),
    ],
  },
  // 6-8) reservada (pago conciliado) en distintos espacios/días
  {
    id: "res-6",
    codigoReserva: "RSV-000098",
    espacioId: "esp-as3",
    fecha: dateFromBase(2),
    franja: "18:00-22:00",
    estado: "reservada",
    unidad: "#210",
    residenteNombre: "Pablo Herrera",
    unidadAlCorriente: true,
    saldoVencidoDias: 0,
    cuota: 250,
    deposito: 400,
    montoTotal: 650,
    pagoConciliado: true,
    referenciaStp: "STP-8890231",
    holdCreadoEn: isoFromBase(-72),
    pagoHabilitadoEn: isoFromBase(-60),
    motivoRechazo: null,
    auditoria: [
      aud("a-6-1", -72, "Pablo Herrera (#210)", "Solicitud creada", "Apartó Asador 3 · 18:00-22:00."),
      aud("a-6-2", -60, "C. Delgado (Administración)", "Reserva validada", "Código RSV-000098."),
      aud("a-6-3", -58, "Sistema · STP", "Pago conciliado", "Abono $650 conciliado (ref STP-8890231). Reserva confirmada."),
    ],
  },
  {
    id: "res-7",
    codigoReserva: "RSV-000090",
    espacioId: "esp-tv",
    fecha: dateFromBase(8),
    franja: "18:00-20:00",
    estado: "reservada",
    unidad: "#615",
    residenteNombre: "Karla Domínguez",
    unidadAlCorriente: true,
    saldoVencidoDias: 0,
    // Espacio sin costo → confirmada al validar (sin paso por_pagar).
    cuota: 0,
    deposito: 0,
    montoTotal: 0,
    pagoConciliado: true,
    referenciaStp: null,
    holdCreadoEn: isoFromBase(-40),
    pagoHabilitadoEn: null,
    motivoRechazo: null,
    auditoria: [
      aud("a-7-1", -40, "Karla Domínguez (#615)", "Solicitud creada", "Apartó Sala de TV · 18:00-20:00."),
      aud("a-7-2", -38, "C. Delgado (Administración)", "Reserva validada", "Espacio sin costo: confirmada directamente (sin pago)."),
    ],
  },
  {
    id: "res-8",
    codigoReserva: "RSV-000101",
    espacioId: "esp-coA",
    fecha: dateFromBase(11),
    franja: "14:00-18:00",
    estado: "reservada",
    unidad: "#1102",
    residenteNombre: "Ernesto Vidal",
    unidadAlCorriente: true,
    saldoVencidoDias: 0,
    cuota: 500,
    deposito: 800,
    montoTotal: 1300,
    pagoConciliado: true,
    referenciaStp: "STP-8891044",
    holdCreadoEn: isoFromBase(-90),
    pagoHabilitadoEn: isoFromBase(-80),
    motivoRechazo: null,
    auditoria: [
      aud("a-8-1", -90, "Ernesto Vidal (#1102)", "Solicitud creada", "Apartó Cocina Equipada A · 14:00-18:00."),
      aud("a-8-2", -80, "C. Delgado (Administración)", "Reserva validada", "Código RSV-000101."),
      aud("a-8-3", -78, "Sistema · STP", "Pago conciliado", "Abono $1,300 conciliado (ref STP-8891044). Reserva confirmada."),
    ],
  },
];

export const MOCK_BLOQUEOS: BloqueoMantenimiento[] = [
  {
    id: "blq-1",
    espacioId: "esp-as2",
    fechaInicio: dateFromBase(1),
    fechaFin: dateFromBase(2),
    motivo: "Reparación de parrilla",
    creadoPor: "C. Delgado (Administración)",
  },
];

// Excepción de conciliación tipo (b): abono STP recibido que no casa con
// ninguna reserva por_pagar (monto/ref no coincide).
export const MOCK_ABONOS_EXCEPCION: AbonoExcepcion[] = [
  {
    id: "abn-1",
    referenciaStp: "STP-8892210",
    monto: 700,
    fecha: isoFromBase(-6),
    nota: "Abono recibido sin código de reserva coincidente; monto no cuadra con reservas por_pagar activas.",
  },
];
