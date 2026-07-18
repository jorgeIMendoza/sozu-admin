// =============================================================
// Portal Condominio · Presupuesto Anual — Modelo de datos (mock)
// Jerarquía de 3 niveles: Área → Centro de Costo → Concepto (partida).
// El catálogo es DATO configurable por condominio, nunca constantes en código.
// El "erogado" NO se teclea aquí: entra desde Tesorería (fuente única).
// Solo UI + mock. Todo punto de integración se marca `// SWAP POINT:`.
// =============================================================

export type EstadoPresupuesto = "borrador" | "aprobado" | "cerrado";

// Nivel 1
export interface AreaGasto {
  id: string;
  numero: number; // 1..N (orden)
  nombre: string; // "Administración", "Seguridad", ... (DATO, no hardcode)
}

// Nivel 2
export interface CentroCosto {
  id: string;
  areaId: string;
  codigo: string; // "1.1", "2.3", ...
  nombre: string; // "Personal Interno", "Empresa Subcontratada", ...
}

// Nivel 3 — la partida presupuestal
export interface Concepto {
  id: string;
  centroCostoId: string;
  nombre: string; // "Administrador General (sueldo + prestaciones)"
  presupuestoMensual: number; // captura base
  // presupuesto anual: por defecto mensual*12, pero permite override por mes
  presupuestoPorMes: number[] | null; // 12 valores si el usuario personaliza; si null => mensual*12
  activo: boolean;
}

// Una erogación real contra un concepto en un mes — VIENE DE TESORERÍA
export interface Erogacion {
  id: string;
  conceptoId: string;
  egresoTesoreriaId: string; // // SWAP POINT: id del egreso en Tesorería que la origina
  fecha: string; // ISO; determina el mes
  monto: number;
  proveedor: string;
  concepto: string; // descripción del egreso
}

export interface Presupuesto {
  id: string;
  condominioId: string; // "margot" — NUNCA default a 1
  ejercicio: number; // 2026
  estado: EstadoPresupuesto;
  areas: AreaGasto[];
  centrosCosto: CentroCosto[];
  conceptos: Concepto[];
  // parámetros de control (de la guía de uso, ahora como config)
  numeroUnidades: number; // divisor para cuota estimada (configurable, NO 111 fijo)
  cobranzaEsperadaAnual: number; // // SWAP POINT: viene del módulo de cobranza del condominio
  umbralFondoReserva: number; // fracción, p.ej. 0.10 (Fondo ≥ 10% del presupuesto anual)
  fechaAprobacion: string | null;
  aprobadoPor: string | null;
}

// Propuesta de revisión (reemplaza la columna "Eduardo" del Excel)
export interface PropuestaRevision {
  id: string;
  presupuestoId: string;
  autor: string; // "Eduardo"
  fecha: string;
  // overrides por concepto: conceptoId -> nuevo presupuestoMensual
  cambios: Record<string, number>;
  estado: "abierta" | "adoptada" | "descartada";
  nota: string;
}

export interface EntradaAuditoria {
  id: string;
  timestamp: string;
  usuario: string;
  accion: string;
  detalle: string;
}

// ── Derivados (se calculan, no se almacenan) ─────────────────
export interface DerivadoPartida {
  presupuestoAnual: number;
  presupuestoPorMes: number[]; // 12
  erogadoAcumulado: number;
  erogadoPorMes: number[]; // 12
  disponible: number; // anual − erogado
  porcentajeEjercido: number; // 0..100+ (guarda contra /0)
  // Presupuesto proporcional hasta el mes actual (para variación a la fecha).
  presupuestoALaFecha: number;
  variacion: number; // erogado − presupuesto a la fecha (>0 = sobre-ejercido)
  sobreEjercido: boolean;
}
