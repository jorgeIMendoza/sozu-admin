// Mock data for Portal Escrituración. Inspired by SOZU Property Suite reference project.

export type StageKey =
  | "expediente"
  | "avaluo"
  | "instruccion"
  | "borrador"
  | "vobo"
  | "firma"
  | "registro"
  | "entrega";

export type Health = "on_track" | "at_risk" | "delayed" | "done";

export interface Expediente {
  id: string;
  unit: string;
  project: "Margot" | "Bottura" | "Monocolo";
  client: string;
  payment: "Contado" | "Hipotecario";
  bank?: "Santander" | "BBVA" | "Banorte";
  notary: string;
  amount: number;
  stage: StageKey;
  progress: number;
  health: Health;
  signDate: string;
  daysInStage: number;
}

export const STAGES: { key: StageKey; label: string }[] = [
  { key: "expediente", label: "Expediente" },
  { key: "avaluo", label: "Avalúo" },
  { key: "instruccion", label: "Instrucción notarial" },
  { key: "borrador", label: "Borrador" },
  { key: "vobo", label: "VoBo banco / dev." },
  { key: "firma", label: "Firma" },
  { key: "registro", label: "Registro público" },
  { key: "entrega", label: "Entrega de escritura" },
];

export const HEALTH_META: Record<Health, { label: string; className: string }> = {
  on_track: { label: "En tiempo", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  at_risk: { label: "En riesgo", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  delayed: { label: "Retrasado", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  done: { label: "Concluido", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
};

export const EXPEDIENTES: Expediente[] = [
  { id: "ESC-2041", unit: "305B",  project: "Bottura", client: "Jorge Acosta",   payment: "Hipotecario", bank: "Santander", notary: "Notaría 51", amount: 6_240_000, stage: "vobo",        progress: 65,  health: "on_track", signDate: "12 May 2026", daysInStage: 3 },
  { id: "ESC-2042", unit: "703",   project: "Bottura", client: "Joel Herrera",   payment: "Contado",                          notary: "Notaría 59", amount: 7_180_000, stage: "firma",       progress: 82,  health: "on_track", signDate: "09 May 2026", daysInStage: 1 },
  { id: "ESC-2043", unit: "A-404", project: "Margot",  client: "Marta Ramírez",  payment: "Hipotecario", bank: "BBVA",       notary: "Notaría 63", amount: 5_120_000, stage: "borrador",    progress: 48,  health: "at_risk",  signDate: "20 May 2026", daysInStage: 7 },
  { id: "ESC-2044", unit: "B-1104",project: "Margot",  client: "Ernesto Gómez",  payment: "Hipotecario", bank: "Banorte",    notary: "Notaría 51", amount: 6_410_000, stage: "registro",    progress: 92,  health: "on_track", signDate: "02 May 2026", daysInStage: 2 },
  { id: "ESC-2045", unit: "C-902", project: "Bottura", client: "Diana Muñoz",    payment: "Contado",                          notary: "Notaría 59", amount: 6_980_000, stage: "instruccion", progress: 35,  health: "delayed",  signDate: "26 May 2026", daysInStage: 12 },
  { id: "ESC-2046", unit: "C-1402",project: "Bottura", client: "Patricia Vega",  payment: "Contado",                          notary: "Notaría 63", amount: 9_240_000, stage: "avaluo",      progress: 22,  health: "on_track", signDate: "30 May 2026", daysInStage: 4 },
  { id: "ESC-2047", unit: "A-1203",project: "Margot",  client: "Carlos López",   payment: "Hipotecario", bank: "Santander", notary: "Notaría 51", amount: 4_980_000, stage: "expediente",  progress: 12,  health: "at_risk",  signDate: "06 Jun 2026", daysInStage: 5 },
  { id: "ESC-2048", unit: "B-808", project: "Bottura", client: "Laura Sánchez",  payment: "Hipotecario", bank: "BBVA",       notary: "Notaría 59", amount: 8_120_000, stage: "entrega",     progress: 100, health: "done",     signDate: "28 Abr 2026", daysInStage: 0 },
  { id: "ESC-2049", unit: "PH-2",  project: "Monocolo",client: "Lorena Iglesias",payment: "Hipotecario", bank: "Santander", notary: "Notaría 63", amount: 12_400_000,stage: "vobo",        progress: 70,  health: "on_track", signDate: "18 May 2026", daysInStage: 2 },
  { id: "ESC-2050", unit: "501",   project: "Bottura", client: "Andrea Salgado", payment: "Contado",                          notary: "Notaría 51", amount: 5_980_000, stage: "borrador",    progress: 55,  health: "on_track", signDate: "22 May 2026", daysInStage: 4 },
];

export interface Notaria {
  id: string;
  num: number;
  titular: string;
  zona: string;
  email: string;
  telefono: string;
  cargaActiva: number;
  slaPromedioDias: number;
}

export const NOTARIAS: Notaria[] = [
  { id: "n51", num: 51, titular: "Lic. Roberto Quintana",    zona: "CDMX · Polanco",      email: "contacto@notaria51.mx", telefono: "55 5555 0151", cargaActiva: 14, slaPromedioDias: 32 },
  { id: "n59", num: 59, titular: "Lic. Adriana del Castillo",zona: "CDMX · Condesa",      email: "contacto@notaria59.mx", telefono: "55 5555 0159", cargaActiva: 11, slaPromedioDias: 28 },
  { id: "n63", num: 63, titular: "Lic. Esteban Vargas",      zona: "Estado de México",    email: "contacto@notaria63.mx", telefono: "55 5555 0163", cargaActiva: 9,  slaPromedioDias: 41 },
  { id: "n12", num: 12, titular: "Lic. Mariana Robles",      zona: "Querétaro · Centro",  email: "contacto@notaria12.mx", telefono: "44 2222 0012", cargaActiva: 6,  slaPromedioDias: 35 },
  { id: "n88", num: 88, titular: "Lic. Federico Hinojosa",   zona: "CDMX · Santa Fe",     email: "contacto@notaria88.mx", telefono: "55 5555 0188", cargaActiva: 8,  slaPromedioDias: 30 },
];

export interface Notario {
  id: string;
  nombre: string;
  notariaId: string;
  cedula: string;
  especialidad: string;
  email: string;
  activo: boolean;
}

export const NOTARIOS: Notario[] = [
  { id: "no1", nombre: "Lic. Roberto Quintana",     notariaId: "n51", cedula: "5421988", especialidad: "Compraventa · Hipotecario", email: "rquintana@notaria51.mx", activo: true },
  { id: "no2", nombre: "Lic. Sandra Quintana",      notariaId: "n51", cedula: "7821112", especialidad: "Sociedades",                email: "squintana@notaria51.mx", activo: true },
  { id: "no3", nombre: "Lic. Adriana del Castillo", notariaId: "n59", cedula: "6112341", especialidad: "Compraventa",               email: "adelcastillo@notaria59.mx", activo: true },
  { id: "no4", nombre: "Lic. Esteban Vargas",       notariaId: "n63", cedula: "5023109", especialidad: "Hipotecario",               email: "evargas@notaria63.mx", activo: true },
  { id: "no5", nombre: "Lic. Mariana Robles",       notariaId: "n12", cedula: "8893021", especialidad: "Compraventa · Mercantil",   email: "mrobles@notaria12.mx", activo: true },
  { id: "no6", nombre: "Lic. Federico Hinojosa",    notariaId: "n88", cedula: "7712910", especialidad: "Compraventa",               email: "fhinojosa@notaria88.mx", activo: false },
];

export interface Avaluo {
  id: string;
  unit: string;
  project: Expediente["project"];
  client: string;
  banco: "Santander" | "BBVA" | "Banorte" | "HSBC";
  perito: string;
  monto: number;
  fechaSolicitud: string;
  estado: "solicitado" | "agendado" | "ejecutado" | "aceptado" | "rechazado";
}

export const AVALUOS: Avaluo[] = [
  { id: "AV-9001", unit: "305B",  project: "Bottura", client: "Jorge Acosta",  banco: "Santander", perito: "Pablo Ruiz",     monto: 6_320_000, fechaSolicitud: "10 Abr 2026", estado: "aceptado"  },
  { id: "AV-9002", unit: "A-404", project: "Margot",  client: "Marta Ramírez", banco: "BBVA",      perito: "Inés Cárdenas",  monto: 5_180_000, fechaSolicitud: "16 Abr 2026", estado: "ejecutado" },
  { id: "AV-9003", unit: "C-1402",project: "Bottura", client: "Patricia Vega", banco: "Banorte",   perito: "Diego Mendoza",  monto: 9_300_000, fechaSolicitud: "20 Abr 2026", estado: "agendado"  },
  { id: "AV-9004", unit: "A-1203",project: "Margot",  client: "Carlos López",  banco: "Santander", perito: "Pablo Ruiz",     monto: 4_980_000, fechaSolicitud: "22 Abr 2026", estado: "solicitado"},
  { id: "AV-9005", unit: "B-808", project: "Bottura", client: "Laura Sánchez", banco: "HSBC",      perito: "Ricardo Olmos",  monto: 8_050_000, fechaSolicitud: "12 Abr 2026", estado: "rechazado" },
];

export interface DocumentoPLD {
  id: string;
  expedienteId: string;
  cliente: string;
  documento: string;
  estado: "pendiente" | "en_revision" | "aprobado" | "rechazado";
  responsable: string;
}

export const DOCS_PLD: DocumentoPLD[] = [
  { id: "PLD-1", expedienteId: "ESC-2041", cliente: "Jorge Acosta",   documento: "Identificación oficial",     estado: "aprobado",    responsable: "Cumplimiento" },
  { id: "PLD-2", expedienteId: "ESC-2041", cliente: "Jorge Acosta",   documento: "Comprobante de domicilio",   estado: "aprobado",    responsable: "Cumplimiento" },
  { id: "PLD-3", expedienteId: "ESC-2043", cliente: "Marta Ramírez",  documento: "Acta de matrimonio",         estado: "en_revision", responsable: "Jurídico" },
  { id: "PLD-4", expedienteId: "ESC-2045", cliente: "Diana Muñoz",    documento: "Origen de recursos",         estado: "pendiente",   responsable: "PLD" },
  { id: "PLD-5", expedienteId: "ESC-2047", cliente: "Carlos López",   documento: "RFC y constancia fiscal",    estado: "rechazado",   responsable: "Cumplimiento" },
  { id: "PLD-6", expedienteId: "ESC-2049", cliente: "Lorena Iglesias",documento: "CURP",                       estado: "aprobado",    responsable: "Cumplimiento" },
];

export interface Borrador {
  id: string;
  expedienteId: string;
  version: number;
  fecha: string;
  autor: string;
  estado: "en_redaccion" | "revision_interna" | "enviado_banco" | "aprobado";
}

export const BORRADORES: Borrador[] = [
  { id: "BR-1", expedienteId: "ESC-2041", version: 3, fecha: "28 Abr 2026", autor: "Notaría 51", estado: "aprobado" },
  { id: "BR-2", expedienteId: "ESC-2043", version: 2, fecha: "30 Abr 2026", autor: "Notaría 63", estado: "revision_interna" },
  { id: "BR-3", expedienteId: "ESC-2045", version: 1, fecha: "01 May 2026", autor: "Notaría 59", estado: "en_redaccion" },
  { id: "BR-4", expedienteId: "ESC-2049", version: 2, fecha: "03 May 2026", autor: "Notaría 63", estado: "enviado_banco" },
];

export interface PlantillaEscritura {
  id: string;
  nombre: string;
  tipo: "Compraventa" | "Hipotecario" | "Fideicomiso";
  version: string;
  actualizada: string;
}

export const PLANTILLAS: PlantillaEscritura[] = [
  { id: "TPL-1", nombre: "Compraventa estándar PF",        tipo: "Compraventa", version: "v4.2", actualizada: "12 Mar 2026" },
  { id: "TPL-2", nombre: "Compraventa con hipoteca BBVA",  tipo: "Hipotecario", version: "v2.0", actualizada: "20 Mar 2026" },
  { id: "TPL-3", nombre: "Compraventa con hipoteca Santander",tipo: "Hipotecario",version:"v2.1",actualizada: "01 Abr 2026" },
  { id: "TPL-4", nombre: "Fideicomiso de garantía",        tipo: "Fideicomiso", version: "v1.3", actualizada: "18 Feb 2026" },
  { id: "TPL-5", nombre: "Compraventa PM",                 tipo: "Compraventa", version: "v3.0", actualizada: "05 Mar 2026" },
];

export interface CitaFirma {
  id: string;
  expedienteId: string;
  cliente: string;
  notary: string;
  fecha: string;
  hora: string;
  estado: "confirmada" | "pendiente_confirmar" | "reagendar";
}

export const CITAS_FIRMA: CitaFirma[] = [
  { id: "FIRMA-1", expedienteId: "ESC-2042", cliente: "Joel Herrera",    notary: "Notaría 59", fecha: "09 May 2026", hora: "10:00", estado: "confirmada" },
  { id: "FIRMA-2", expedienteId: "ESC-2041", cliente: "Jorge Acosta",    notary: "Notaría 51", fecha: "12 May 2026", hora: "11:30", estado: "confirmada" },
  { id: "FIRMA-3", expedienteId: "ESC-2049", cliente: "Lorena Iglesias", notary: "Notaría 63", fecha: "18 May 2026", hora: "09:30", estado: "pendiente_confirmar" },
  { id: "FIRMA-4", expedienteId: "ESC-2050", cliente: "Andrea Salgado",  notary: "Notaría 51", fecha: "22 May 2026", hora: "12:00", estado: "reagendar" },
  { id: "FIRMA-5", expedienteId: "ESC-2043", cliente: "Marta Ramírez",   notary: "Notaría 63", fecha: "20 May 2026", hora: "10:30", estado: "pendiente_confirmar" },
];

export interface EntregaFisica {
  id: string;
  expedienteId: string;
  cliente: string;
  unidad: string;
  fechaProgramada: string;
  checklist: { llaves: boolean; manuales: boolean; controlAcceso: boolean; tarjeton: boolean };
  estado: "programada" | "ejecutada" | "con_observaciones";
}

export const ENTREGAS: EntregaFisica[] = [
  { id: "ENT-1", expedienteId: "ESC-2044", cliente: "Ernesto Gómez",  unidad: "B-1104", fechaProgramada: "07 May 2026", checklist: { llaves: true, manuales: true, controlAcceso: true, tarjeton: true },   estado: "ejecutada" },
  { id: "ENT-2", expedienteId: "ESC-2048", cliente: "Laura Sánchez",  unidad: "B-808",  fechaProgramada: "05 May 2026", checklist: { llaves: true, manuales: true, controlAcceso: false, tarjeton: true },  estado: "con_observaciones" },
  { id: "ENT-3", expedienteId: "ESC-2042", cliente: "Joel Herrera",   unidad: "703",    fechaProgramada: "11 May 2026", checklist: { llaves: false, manuales: false, controlAcceso: false, tarjeton: false }, estado: "programada" },
  { id: "ENT-4", expedienteId: "ESC-2041", cliente: "Jorge Acosta",   unidad: "305B",   fechaProgramada: "14 May 2026", checklist: { llaves: false, manuales: false, controlAcceso: false, tarjeton: false }, estado: "programada" },
];

export interface InscripcionRPP {
  id: string;
  expedienteId: string;
  unidad: string;
  fechaIngreso: string;
  fechaSalida: string | null;
  folioReal: string | null;
  estado: "ingresado" | "en_calificacion" | "calificado" | "inscrito" | "rechazado";
}

export const INSCRIPCIONES: InscripcionRPP[] = [
  { id: "RPP-1", expedienteId: "ESC-2048", unidad: "B-808",  fechaIngreso: "30 Abr 2026", fechaSalida: "06 May 2026", folioReal: "RPP-1283091", estado: "inscrito"        },
  { id: "RPP-2", expedienteId: "ESC-2044", unidad: "B-1104", fechaIngreso: "02 May 2026", fechaSalida: null,           folioReal: null,           estado: "en_calificacion" },
  { id: "RPP-3", expedienteId: "ESC-2042", unidad: "703",    fechaIngreso: "10 May 2026", fechaSalida: null,           folioReal: null,           estado: "ingresado"       },
];

export interface CreditoHipotecario {
  id: string;
  expedienteId: string;
  banco: "Santander" | "BBVA" | "Banorte" | "HSBC";
  cliente: string;
  montoSolicitado: number;
  montoAutorizado: number;
  tasa: number;
  plazoMeses: number;
  estado: "solicitud" | "avaluo" | "autorizado" | "instruccion" | "dispersado";
}

export const CREDITOS: CreditoHipotecario[] = [
  { id: "CR-1", expedienteId: "ESC-2041", banco: "Santander", cliente: "Jorge Acosta",   montoSolicitado: 4_500_000, montoAutorizado: 4_400_000, tasa: 10.2, plazoMeses: 240, estado: "instruccion"   },
  { id: "CR-2", expedienteId: "ESC-2043", banco: "BBVA",       cliente: "Marta Ramírez", montoSolicitado: 3_800_000, montoAutorizado: 0,         tasa: 0,    plazoMeses: 240, estado: "avaluo"        },
  { id: "CR-3", expedienteId: "ESC-2047", banco: "Santander", cliente: "Carlos López",   montoSolicitado: 3_500_000, montoAutorizado: 0,         tasa: 0,    plazoMeses: 240, estado: "solicitud"     },
  { id: "CR-4", expedienteId: "ESC-2048", banco: "BBVA",       cliente: "Laura Sánchez", montoSolicitado: 6_000_000, montoAutorizado: 6_000_000, tasa: 9.9,  plazoMeses: 240, estado: "dispersado"    },
  { id: "CR-5", expedienteId: "ESC-2049", banco: "Santander", cliente: "Lorena Iglesias",montoSolicitado: 8_500_000, montoAutorizado: 8_200_000, tasa: 10.1, plazoMeses: 240, estado: "autorizado"    },
];

export const PROYECTOS = ["Margot", "Bottura", "Monocolo"] as const;

export function fmtMxn(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export function fmtMxnDec(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}