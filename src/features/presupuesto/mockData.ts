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
  EgresoTesoreria,
  Presupuesto,
  PropuestaRevision,
} from "./types";

const EJERCICIO = 2026;

// ── Nivel 1: Áreas ───────────────────────────────────────────
const AREAS: AreaGasto[] = [
  { id: "a1", numero: 1, nombre: "Administración", activo: true },
  { id: "a2", numero: 2, nombre: "Seguridad", activo: true },
  { id: "a3", numero: 3, nombre: "Jardinería", activo: true },
  { id: "a4", numero: 4, nombre: "Casa Club", activo: true },
  { id: "a5", numero: 5, nombre: "Gimnasio", activo: true },
  { id: "a6", numero: 6, nombre: "Área de Alberca", activo: true },
  { id: "a7", numero: 7, nombre: "Vialidades e Infraestructura", activo: true },
  { id: "a8", numero: 8, nombre: "Comunicación y Tecnología", activo: true },
  { id: "a9", numero: 9, nombre: "Fondo de Reserva", activo: true },
  { id: "a10", numero: 10, nombre: "Gastos Financieros", activo: true },
];

// ── Nivel 2: Centros de costo ────────────────────────────────
const CENTROS: CentroCosto[] = [
  { id: "cc1.1", areaId: "a1", codigo: "1.1", nombre: "Personal Interno", activo: true },
  { id: "cc1.2", areaId: "a1", codigo: "1.2", nombre: "Gastos de Oficina", activo: true },
  { id: "cc1.3", areaId: "a1", codigo: "1.3", nombre: "Honorarios", activo: true },
  { id: "cc2.1", areaId: "a2", codigo: "2.1", nombre: "Personal Interno de Seguridad", activo: true },
  { id: "cc2.2", areaId: "a2", codigo: "2.2", nombre: "Empresa Subcontratada", activo: true },
  { id: "cc2.3", areaId: "a2", codigo: "2.3", nombre: "Equipamiento", activo: true },
  { id: "cc3.1", areaId: "a3", codigo: "3.1", nombre: "Personal", activo: true },
  { id: "cc3.2", areaId: "a3", codigo: "3.2", nombre: "Insumos y Equipo", activo: true },
  { id: "cc4.1", areaId: "a4", codigo: "4.1", nombre: "Operación", activo: true },
  { id: "cc4.2", areaId: "a4", codigo: "4.2", nombre: "Mantenimiento", activo: true },
  { id: "cc5.1", areaId: "a5", codigo: "5.1", nombre: "Mantenimiento de Equipo", activo: true },
  { id: "cc5.2", areaId: "a5", codigo: "5.2", nombre: "Servicios", activo: true },
  { id: "cc6.1", areaId: "a6", codigo: "6.1", nombre: "Personal", activo: true },
  { id: "cc6.2", areaId: "a6", codigo: "6.2", nombre: "Químicos y Mantenimiento", activo: true },
  { id: "cc7.1", areaId: "a7", codigo: "7.1", nombre: "Alumbrado Público", activo: true },
  { id: "cc7.2", areaId: "a7", codigo: "7.2", nombre: "Obra Civil", activo: true },
  { id: "cc8.1", areaId: "a8", codigo: "8.1", nombre: "Conectividad", activo: true },
  { id: "cc8.2", areaId: "a8", codigo: "8.2", nombre: "Plataformas", activo: true },
  { id: "cc9.1", areaId: "a9", codigo: "9.1", nombre: "Aportación a Fondo", activo: true },
  { id: "cc10.1", areaId: "a10", codigo: "10.1", nombre: "Comisiones y Servicios Bancarios", activo: true },
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

// ── Egresos de Tesorería (FUENTE ÚNICA) ──────────────────────
// SIN datos hardcodeados: el módulo arranca sin egresos. Los egresos reales
// entran por Tesorería (Nuevo egreso, clasificados) y de ahí se derivan las
// erogaciones del presupuesto. Con la lista vacía, el erogado es 0 en todo el
// catálogo. // SWAP POINT: persistencia real de egresos.

// ── Presupuesto aprobado 2026 (CATÁLOGO = configuración, se conserva) ─────────
export const MOCK_PRESUPUESTO: Presupuesto = {
  id: "pre-margot-2026",
  condominioId: "margot",
  ejercicio: EJERCICIO,
  estado: "aprobado",
  areas: AREAS,
  centrosCosto: CENTROS,
  conceptos: CONCEPTOS,
  numeroUnidades: 111, // divisor de cuota (configurable; el ejemplo es de 111 propiedades)
  // Fallback si no hay dataset del condominio. El Dashboard presupuestal PREFIERE
  // la cobranza esperada real (useCondominioDataset, misma que el Dashboard). // SWAP POINT.
  cobranzaEsperadaAnual: 9_800_000,
  umbralFondoReserva: 0.1, // Fondo ≥ 10% del presupuesto anual
  fechaAprobacion: "2025-12-15",
  aprobadoPor: "Asamblea de condóminos",
};

// Egresos: SIN semilla (fuente única vacía). El erogado arranca en 0.
export const MOCK_EGRESOS: EgresoTesoreria[] = [];

// Propuestas de revisión: SIN semilla (se crean desde el módulo).
export const MOCK_PROPUESTAS: PropuestaRevision[] = [];

// Auditoría: SIN semilla. Se llena con las acciones reales (modificaciones,
// aprobaciones, altas/bajas del catálogo) conforme ocurren.
export const MOCK_AUDITORIA_INICIAL: {
  id: string;
  timestamp: string;
  usuario: string;
  accion: string;
  detalle: string;
}[] = [];
