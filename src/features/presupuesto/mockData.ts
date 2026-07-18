// =============================================================
// Portal Condominio · Presupuesto — datos mock (semilla realista)
// Semilla basada en el fraccionamiento del Excel de referencia (10 áreas,
// montos reales). ES DATO, no esquema: cada condominio define su propio árbol.
// Total ≈ $871,389/mes ≈ $10.46M anual. Seguridad ≈ 48%, Administración ≈ 26%.
// Erogaciones Ene–Jul 2026 ligadas a egresos de Tesorería (// SWAP POINT).
// =============================================================
import type {
  AreaGasto,
  CentroCosto,
  Concepto,
  Erogacion,
  Presupuesto,
  PropuestaRevision,
} from "./types";

const EJERCICIO = 2026;

// ── Nivel 1: Áreas ───────────────────────────────────────────
const AREAS: AreaGasto[] = [
  { id: "a1", numero: 1, nombre: "Administración" },
  { id: "a2", numero: 2, nombre: "Seguridad" },
  { id: "a3", numero: 3, nombre: "Jardinería" },
  { id: "a4", numero: 4, nombre: "Casa Club" },
  { id: "a5", numero: 5, nombre: "Gimnasio" },
  { id: "a6", numero: 6, nombre: "Área de Alberca" },
  { id: "a7", numero: 7, nombre: "Vialidades e Infraestructura" },
  { id: "a8", numero: 8, nombre: "Comunicación y Tecnología" },
  { id: "a9", numero: 9, nombre: "Fondo de Reserva" },
  { id: "a10", numero: 10, nombre: "Gastos Financieros" },
];

// ── Nivel 2: Centros de costo ────────────────────────────────
const CENTROS: CentroCosto[] = [
  { id: "cc1.1", areaId: "a1", codigo: "1.1", nombre: "Personal Interno" },
  { id: "cc1.2", areaId: "a1", codigo: "1.2", nombre: "Gastos de Oficina" },
  { id: "cc1.3", areaId: "a1", codigo: "1.3", nombre: "Honorarios" },
  { id: "cc2.1", areaId: "a2", codigo: "2.1", nombre: "Personal Interno de Seguridad" },
  { id: "cc2.2", areaId: "a2", codigo: "2.2", nombre: "Empresa Subcontratada" },
  { id: "cc2.3", areaId: "a2", codigo: "2.3", nombre: "Equipamiento" },
  { id: "cc3.1", areaId: "a3", codigo: "3.1", nombre: "Personal" },
  { id: "cc3.2", areaId: "a3", codigo: "3.2", nombre: "Insumos y Equipo" },
  { id: "cc4.1", areaId: "a4", codigo: "4.1", nombre: "Operación" },
  { id: "cc4.2", areaId: "a4", codigo: "4.2", nombre: "Mantenimiento" },
  { id: "cc5.1", areaId: "a5", codigo: "5.1", nombre: "Mantenimiento de Equipo" },
  { id: "cc5.2", areaId: "a5", codigo: "5.2", nombre: "Servicios" },
  { id: "cc6.1", areaId: "a6", codigo: "6.1", nombre: "Personal" },
  { id: "cc6.2", areaId: "a6", codigo: "6.2", nombre: "Químicos y Mantenimiento" },
  { id: "cc7.1", areaId: "a7", codigo: "7.1", nombre: "Alumbrado Público" },
  { id: "cc7.2", areaId: "a7", codigo: "7.2", nombre: "Obra Civil" },
  { id: "cc8.1", areaId: "a8", codigo: "8.1", nombre: "Conectividad" },
  { id: "cc8.2", areaId: "a8", codigo: "8.2", nombre: "Plataformas" },
  { id: "cc9.1", areaId: "a9", codigo: "9.1", nombre: "Aportación a Fondo" },
  { id: "cc10.1", areaId: "a10", codigo: "10.1", nombre: "Comisiones y Servicios Bancarios" },
];

// ── Nivel 3: Conceptos (partidas) ────────────────────────────
function concepto(id: string, centroCostoId: string, nombre: string, mensual: number): Concepto {
  return { id, centroCostoId, nombre, presupuestoMensual: mensual, presupuestoPorMes: null, activo: true };
}

const CONCEPTOS: Concepto[] = [
  // Administración
  concepto("k-adminGral", "cc1.1", "Administrador General (sueldo + prestaciones)", 45000),
  concepto("k-asistente", "cc1.1", "Asistente administrativo", 22000),
  concepto("k-imssAdmin", "cc1.1", "IMSS / INFONAVIT", 18000),
  concepto("k-contador", "cc1.1", "Contador externo", 15000),
  concepto("k-papeleria", "cc1.2", "Papelería e insumos", 5000),
  concepto("k-software", "cc1.2", "Software de administración", 8758),
  concepto("k-mensajeria", "cc1.2", "Mensajería y paquetería", 3000),
  concepto("k-honorarios", "cc1.3", "Honorarios de administración", 90000),
  concepto("k-legal", "cc1.3", "Asesoría legal", 12000),
  concepto("k-auditoria", "cc1.3", "Auditoría externa", 8000),
  // Seguridad
  concepto("k-jefeSeg", "cc2.1", "Jefe de seguridad", 25000),
  concepto("k-imssSeg", "cc2.1", "Prestaciones IMSS seguridad", 12111),
  concepto("k-vigilancia", "cc2.2", "Servicio de vigilancia (empresa)", 361520),
  concepto("k-cctv", "cc2.3", "Mantenimiento CCTV", 12000),
  concepto("k-radios", "cc2.3", "Radios y consumibles", 8000),
  // Jardinería
  concepto("k-jardinero", "cc3.1", "Jardineros (2)", 18000),
  concepto("k-plantas", "cc3.2", "Plantas y fertilizantes", 9000),
  concepto("k-equipoJardin", "cc3.2", "Mantenimiento de equipo", 8000),
  // Casa Club
  concepto("k-anfitrion", "cc4.1", "Anfitrión Casa Club", 12000),
  concepto("k-limpiezaClub", "cc4.1", "Limpieza Casa Club", 8000),
  concepto("k-mobiliario", "cc4.2", "Mobiliario y consumibles", 6000),
  // Gimnasio
  concepto("k-aparatos", "cc5.1", "Mantenimiento de aparatos", 9000),
  concepto("k-insumosGim", "cc5.1", "Insumos (toallas, higiene)", 4000),
  concepto("k-instructor", "cc5.2", "Instructor por horas", 4000),
  // Alberca
  concepto("k-salvavidas", "cc6.1", "Salvavidas", 14000),
  concepto("k-quimicos", "cc6.2", "Cloro y químicos", 12000),
  concepto("k-bomba", "cc6.2", "Bomba y filtros", 8000),
  // Vialidades e Infraestructura
  concepto("k-cfe", "cc7.1", "Consumo CFE áreas comunes", 22000),
  concepto("k-luminarias", "cc7.1", "Mantenimiento de luminarias", 6000),
  concepto("k-bacheo", "cc7.2", "Bacheo y pintura", 9000),
  concepto("k-senaletica", "cc7.2", "Señalética", 6000),
  // Comunicación y Tecnología (erogado 0)
  concepto("k-fibra", "cc8.1", "Internet / fibra áreas comunes", 8000),
  concepto("k-porteroIp", "cc8.1", "Telefonía / portero IP", 4000),
  concepto("k-appResidentes", "cc8.2", "App de residentes / software", 6000),
  // Fondo de Reserva (erogado 0)
  concepto("k-fondoReserva", "cc9.1", "Aportación mensual a Fondo de Reserva", 44000),
  // Gastos Financieros
  concepto("k-comisionesBanco", "cc10.1", "Comisiones bancarias / STP", 5000),
  concepto("k-seguroComunes", "cc10.1", "Seguro de áreas comunes", 4000),
];

// ── Erogaciones (fuente: Tesorería) ──────────────────────────
// Helper: emite una erogación por mes (0-index) para un concepto.
function mensualISO(mes: number): string {
  return `${EJERCICIO}-${String(mes + 1).padStart(2, "0")}-05`;
}

// egresoTesoreriaId liga (mock) con el egreso que la origina en Tesorería.
// Algunos referencian egresos existentes del mock de Tesorería (exp-*).
let egSeq = 0;
function ero(
  conceptoId: string,
  mes: number,
  monto: number,
  proveedor: string,
  concepto: string,
  egresoTesoreriaId?: string,
): Erogacion {
  egSeq += 1;
  return {
    id: `ero-${conceptoId}-${mes}-${egSeq}`,
    conceptoId,
    egresoTesoreriaId: egresoTesoreriaId ?? `teso-2026-${String(egSeq).padStart(4, "0")}`, // SWAP POINT
    fecha: mensualISO(mes),
    monto,
    proveedor,
    concepto,
  };
}

// Recurrente: emite el monto mensual del concepto para los meses [0..hastaMes].
function recurrente(
  conceptoId: string,
  monto: number,
  proveedor: string,
  desc: string,
  hastaMes: number,
  egresoBase?: string,
): Erogacion[] {
  const out: Erogacion[] = [];
  for (let m = 0; m <= hastaMes; m++) {
    out.push(ero(conceptoId, m, monto, proveedor, desc, egresoBase ? `${egresoBase}-${m}` : undefined));
  }
  return out;
}

// Mes actual del demo = Jul (index 6). Los recurrentes se cargan Ene–Jun (0..5)
// → erogado (6 meses) < presupuesto a la fecha (7 meses) ⇒ áreas "dentro".
const HASTA = 5;

const EROGACIONES: Erogacion[] = [
  // Administración (dentro)
  ...recurrente("k-adminGral", 45000, "Nómina interna", "Sueldo Administrador General", HASTA, "exp-1"),
  ...recurrente("k-asistente", 22000, "Nómina interna", "Sueldo asistente administrativo", HASTA),
  ...recurrente("k-imssAdmin", 18000, "IMSS", "Cuotas IMSS/INFONAVIT", HASTA),
  ...recurrente("k-contador", 15000, "Contable SC", "Honorarios contador externo", HASTA),
  ...recurrente("k-honorarios", 90000, "Admin SC", "Honorarios de administración", HASTA, "exp-9"),
  ...recurrente("k-software", 8758, "Software MX", "Suscripción software administración", HASTA),
  // Seguridad (dentro)
  ...recurrente("k-vigilancia", 361520, "SecureMX", "Servicio de vigilancia mensual", HASTA, "exp-3"),
  ...recurrente("k-jefeSeg", 25000, "Nómina interna", "Sueldo jefe de seguridad", HASTA),
  ...recurrente("k-imssSeg", 12111, "IMSS", "Prestaciones IMSS seguridad", HASTA),
  ...recurrente("k-cctv", 12000, "VideoTech", "Mantenimiento CCTV", HASTA, "exp-10"),
  // Jardinería (SOBRE-EJERCIDA: recurrente + reencespado extraordinario)
  ...recurrente("k-jardinero", 18000, "Nómina interna", "Sueldo jardineros", HASTA),
  ...recurrente("k-plantas", 9000, "Vivero Central", "Plantas y fertilizantes", HASTA),
  ...recurrente("k-equipoJardin", 8000, "JardinTools", "Mantenimiento de equipo", HASTA),
  ero("k-plantas", 4, 78000, "Vivero Central", "Reencespado extraordinario áreas verdes"),
  ero("k-equipoJardin", 5, 52000, "JardinTools", "Compra de podadora industrial"),
  // Casa Club (dentro)
  ...recurrente("k-anfitrion", 12000, "Nómina interna", "Anfitrión Casa Club", HASTA),
  ...recurrente("k-limpiezaClub", 8000, "Clean Pro SA", "Limpieza Casa Club", HASTA, "exp-2"),
  // Gimnasio (dentro)
  ...recurrente("k-aparatos", 9000, "GymFix", "Mantenimiento de aparatos", HASTA),
  ...recurrente("k-instructor", 4000, "Instructor externo", "Instructor por horas", HASTA),
  // Alberca (dentro)
  ...recurrente("k-salvavidas", 14000, "Nómina interna", "Sueldo salvavidas", HASTA),
  ...recurrente("k-quimicos", 12000, "AquaClean", "Cloro y químicos", HASTA),
  // Vialidades e Infraestructura (dentro)
  ...recurrente("k-cfe", 22000, "CFE", "Consumo CFE áreas comunes", HASTA, "exp-5"),
  ...recurrente("k-luminarias", 6000, "IluminaMX", "Mantenimiento de luminarias", HASTA),
  // Gastos Financieros (dentro)
  ...recurrente("k-comisionesBanco", 5000, "Banco / STP", "Comisiones bancarias", HASTA),
  ...recurrente("k-seguroComunes", 4000, "Seguros GNP", "Seguro de áreas comunes", HASTA),
  // Comunicación y Tecnología → SIN erogaciones (erogado 0)
  // Fondo de Reserva → SIN erogaciones (erogado 0)
];

// ── Presupuesto aprobado 2026 ────────────────────────────────
export const MOCK_PRESUPUESTO: Presupuesto = {
  id: "pre-margot-2026",
  condominioId: "margot",
  ejercicio: EJERCICIO,
  estado: "aprobado",
  areas: AREAS,
  centrosCosto: CENTROS,
  conceptos: CONCEPTOS,
  numeroUnidades: 111, // divisor de cuota (configurable; el ejemplo es de 111 propiedades)
  cobranzaEsperadaAnual: 9_800_000, // SWAP POINT: viene del módulo de Cobranza del condominio
  umbralFondoReserva: 0.1, // Fondo ≥ 10% del presupuesto anual
  fechaAprobacion: "2025-12-15",
  aprobadoPor: "Asamblea de condóminos",
};

export const MOCK_EROGACIONES: Erogacion[] = EROGACIONES;

// ── Propuesta de revisión abierta (columna "Eduardo") ────────
export const MOCK_PROPUESTAS: PropuestaRevision[] = [
  {
    id: "prop-1",
    presupuestoId: "pre-margot-2026",
    autor: "Eduardo",
    fecha: "2026-06-20",
    cambios: {
      "k-vigilancia": 372000, // renovación de contrato de vigilancia (+10,480)
      "k-honorarios": 85000, // renegociación honorarios (−5,000)
      "k-appResidentes": 9500, // upgrade app de residentes (+3,500)
      "k-fondoReserva": 50000, // reforzar Fondo de Reserva (+6,000)
    },
    estado: "abierta",
    nota: "Ajustes propuestos para el 2º semestre: renovación de vigilancia, renegociación de honorarios y refuerzo del Fondo de Reserva.",
  },
];

export const MOCK_AUDITORIA_INICIAL = [
  {
    id: "aud-seed-1",
    timestamp: "2025-12-15T18:00:00.000Z",
    usuario: "Asamblea de condóminos",
    accion: "Presupuesto aprobado",
    detalle: "Ejercicio 2026 aprobado en asamblea. Presupuesto anual ≈ $10,456,668.",
  },
];
