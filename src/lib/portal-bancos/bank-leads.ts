// =============================================================
// Portal Bancos — Modelo de datos de la mesa hipotecaria (mock)
// Portado del proyecto SOZU Bank Ally.
// =============================================================

// Identificador de banco asociado a una solicitud. Antes era un union de los 3
// bancos mock; ahora es el id (string) del banco con convenio real. La fuente de
// verdad de los bancos con convenio vive en `bancos_convenio` (ver hook
// `useBancosConvenio`); aquí solo se conserva el tipo para las solicitudes.
export type BankId = string;

export type IngresoRange = "15k-30k" | "30k-60k" | "60k-120k" | "120k+";
export type SituacionLaboral = "asalariado" | "honorarios" | "empresario" | "jubilado";

export const INGRESO_LABEL: Record<IngresoRange, string> = {
  "15k-30k": "$15,000 – $30,000",
  "30k-60k": "$30,000 – $60,000",
  "60k-120k": "$60,000 – $120,000",
  "120k+": "Más de $120,000",
};

export const SITUACION_LABEL: Record<SituacionLaboral, string> = {
  asalariado: "Asalariado con nómina formal",
  honorarios: "Profesionista independiente (honorarios)",
  empresario: "Empresario o accionista",
  jubilado: "Jubilado o pensionado",
};

export interface ConsentRecord {
  granted: boolean;
  timestamp: string;
  ley: "LFPDPPP";
}

export interface ClientData {
  fullName: string;
  phone: string;
  email: string;
  ingresoRange: IngresoRange;
  situacionLaboral: SituacionLaboral;
  esClienteActual: boolean;
  consent: ConsentRecord;
}

export interface CreditRequest {
  montoFinanciar: number;
  plazoAnios: 5 | 10 | 15 | 20;
  estMonthlyMin: number;
  estMonthlyMax: number;
  estRateMin: number;
  estRateMax: number;
  estCatMin: number;
  estCatMax: number;
}

export type ObraEtapa = "Cimentación" | "Estructura" | "Albañilería" | "Acabados" | "Terminado";

export interface PropertyData {
  project: string;
  unit: string;
  address: string;
  totalValue: number;
  saldoFinanciar: number;
  avanceObra: number;
  etapa: ObraEtapa;
  fechaEscrituracion: string;
}

export type LeadScore = "verde" | "amarillo" | "rojo";

export interface SozuMeta {
  leadId: string;
  score: LeadScore;
  declaredAt: string;
  agenteComercial: { name: string; phone: string };
}

export type LeadStatus =
  | "nuevo" | "asignado" | "contactado" | "en_evaluacion"
  | "pre_aprobado" | "oferta_vinculante" | "en_coordinacion"
  | "formalizado" | "rechazado" | "desistido";

export interface StatusDescriptor {
  label: string;
  tone: "neutral" | "info" | "warning" | "success" | "destructive";
  shortDesc: string;
  isTerminal: boolean;
  isWon: boolean;
}

export const STATUS_DESCRIPTORS: Record<LeadStatus, StatusDescriptor> = {
  nuevo:             { label: "Nuevo",              tone: "info",        shortDesc: "Lead recién recibido, sin asignar.",        isTerminal: false, isWon: false },
  asignado:          { label: "Asignado",           tone: "info",        shortDesc: "Asignado a un ejecutivo.",                  isTerminal: false, isWon: false },
  contactado:        { label: "Contactado",         tone: "info",        shortDesc: "Primer contacto realizado.",                isTerminal: false, isWon: false },
  en_evaluacion:     { label: "En evaluación",      tone: "info",        shortDesc: "Recabando documentación y evaluando.",      isTerminal: false, isWon: false },
  pre_aprobado:      { label: "Pre-aprobado",       tone: "success",     shortDesc: "Aprobación condicional del banco.",         isTerminal: false, isWon: false },
  oferta_vinculante: { label: "Oferta vinculante",  tone: "success",     shortDesc: "Oferta vinculante emitida al cliente.",     isTerminal: false, isWon: false },
  en_coordinacion:   { label: "Coordinando notaría",tone: "info",        shortDesc: "Alineando notario, fecha y pago.",          isTerminal: false, isWon: false },
  formalizado:       { label: "Formalizado",        tone: "success",     shortDesc: "Crédito formalizado, listo para escriturar.", isTerminal: true,  isWon: true  },
  rechazado:         { label: "Rechazado",          tone: "destructive", shortDesc: "El banco declinó la solicitud.",            isTerminal: true,  isWon: false },
  desistido:         { label: "Desistido",          tone: "neutral",     shortDesc: "El cliente no avanzó con esta institución.",isTerminal: true,  isWon: false },
};

export const PIPELINE_ORDER: LeadStatus[] = [
  "nuevo", "asignado", "contactado", "en_evaluacion",
  "pre_aprobado", "oferta_vinculante", "en_coordinacion", "formalizado",
];

export const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  nuevo: ["asignado", "contactado", "desistido", "rechazado"],
  asignado: ["contactado", "nuevo", "desistido", "rechazado"],
  contactado: ["en_evaluacion", "asignado", "desistido", "rechazado"],
  en_evaluacion: ["pre_aprobado", "contactado", "desistido", "rechazado"],
  pre_aprobado: ["oferta_vinculante", "en_evaluacion", "desistido", "rechazado"],
  oferta_vinculante: ["en_coordinacion", "pre_aprobado", "desistido", "rechazado"],
  en_coordinacion: ["formalizado", "oferta_vinculante", "desistido", "rechazado"],
  formalizado: [],
  rechazado: [],
  desistido: [],
};

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export const REJECTION_REASONS = [
  "Capacidad de pago insuficiente",
  "Historial crediticio (Buró)",
  "Documentación incompleta",
  "Avalúo por debajo del monto",
  "Cliente fuera de política",
  "Otro",
] as const;

export const DESIST_REASONS = [
  "Eligió otro banco",
  "Decidió pagar de contado",
  "No respondió",
  "Pospuso la compra",
  "Otro",
] as const;

export type LeadHealth = "en_tiempo" | "en_riesgo" | "detenido";

export function daysUntil(iso: string): number {
  const target = new Date(iso).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

const EARLY_STATUSES: LeadStatus[] = ["nuevo", "asignado", "contactado", "en_evaluacion"];

export function deriveHealth(lead: { status: LeadStatus; property: PropertyData; lastUpdate: string }): LeadHealth {
  const desc = STATUS_DESCRIPTORS[lead.status];
  if (desc.isTerminal) return "en_tiempo";
  const dias = daysUntil(lead.property.fechaEscrituracion);
  const diasSinUpdate = daysUntil(lead.lastUpdate) * -1;
  if (diasSinUpdate >= 5) return "detenido";
  if (dias < 30 && EARLY_STATUSES.includes(lead.status)) return "en_riesgo";
  if (dias < 15) return "en_riesgo";
  return "en_tiempo";
}

export const HEALTH_DESCRIPTOR: Record<LeadHealth, { label: string; tone: "success" | "warning" | "destructive" }> = {
  en_tiempo: { label: "En tiempo", tone: "success" },
  en_riesgo: { label: "En riesgo", tone: "warning" },
  detenido:  { label: "Detenido",  tone: "destructive" },
};

export interface ActivityEntry {
  id: string;
  ts: string;
  author: string;
  type: "creado" | "status_change" | "nota" | "contacto";
  from?: LeadStatus;
  to?: LeadStatus;
  note?: string;
}

export interface BankLead {
  id: string;
  bankId: BankId;
  status: LeadStatus;
  assignedAgentId?: string;
  closeReason?: string;
  client: ClientData;
  credit: CreditRequest;
  property: PropertyData;
  sozu: SozuMeta;
  activity: ActivityEntry[];
  createdAt: string;
  lastUpdate: string;
}

export const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

export const plural = (n: number, singular: string, pluralForm: string) =>
  `${n} ${n === 1 ? singular : pluralForm}`;

export function closedDescriptor(
  status: LeadStatus
): { label: string; tone: "success" | "destructive" | "neutral" } | null {
  switch (status) {
    case "formalizado": return { label: "Cerrado · ganado", tone: "success" };
    case "rechazado":   return { label: "Rechazado",        tone: "destructive" };
    case "desistido":   return { label: "No avanzó",        tone: "neutral" };
    default: return null;
  }
}

export function amortMonthly(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}