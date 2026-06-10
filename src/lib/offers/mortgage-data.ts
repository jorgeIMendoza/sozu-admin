// ── Mortgage / Crédito hipotecario data layer ──
// In-memory store of the mortgage decision per property used by Pago Final.

export type PreferredBankId = "BBVA" | "Santander" | "Banorte";

export interface PreferredBank {
  id: PreferredBankId;
  name: string;
  shortDescription: string;
  benefits: string[];
}

export const PREFERRED_BANKS: PreferredBank[] = [
  {
    id: "BBVA",
    name: "BBVA",
    shortDescription: "Pre-validación digital",
    benefits: ["Notario integrado", "Broker dedicado", "Proceso ágil"],
  },
  {
    id: "Santander",
    name: "Santander",
    shortDescription: "Pre-validación digital",
    benefits: ["Notario integrado", "Broker dedicado", "Proceso ágil"],
  },
  {
    id: "Banorte",
    name: "Banorte",
    shortDescription: "Pre-validación digital",
    benefits: ["Notario integrado", "Broker dedicado", "Proceso ágil"],
  },
];

export interface OtherBankDetails {
  institution: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  branch: string;
}

export type MortgageChoice =
  | { type: "preferred"; bankId: PreferredBankId }
  | { type: "other"; details: OtherBankDetails };

export type PreValidationStatus =
  | "not_started"
  | "in_progress"
  | "pre_approved"
  | "rejected"
  | "completed";

export type OtherBankStatus =
  | "registered"
  | "contacted"
  | "in_coordination"
  | "completed";

export interface MortgageProcess {
  propertyId: string;
  declaredAt: string;
  choice: MortgageChoice;
  preferredStatus?: PreValidationStatus;
  otherStatus?: OtherBankStatus;
  lastUpdate?: string;
  prequalification?: PrequalificationData;
}

// ── Pre-calificación: tipos ──

export type IngresoRange = "15k-30k" | "30k-60k" | "60k-120k" | "120k+";

export type SituacionLaboral =
  | "asalariado"
  | "independiente"
  | "empresario"
  | "mixto";

export type LeadScore = "verde" | "amarillo" | "rojo";

export interface ContactInfo {
  nombre: string;
  email: string;
  telefono: string;
}

export interface BankRateRange {
  rateMin: number;
  rateMax: number;
  catMin: number;
  catMax: number;
  effectiveDate: string;
}

export interface PrequalificationData {
  montoFinanciar: number;
  plazoAnios: 10 | 15 | 20;
  ingresoRange: IngresoRange;
  situacionLaboral: SituacionLaboral;
  esClienteActual: boolean;
  contacto: ContactInfo;
  consentimientoCompartirDatos: boolean;
  estimatedMonthlyMin: number;
  estimatedMonthlyMax: number;
  estimatedRateMin: number;
  estimatedRateMax: number;
  estimatedCatMin: number;
  estimatedCatMax: number;
  ltv: number;
  score: LeadScore;
  submittedAt: string;
}

export const BANK_RATES: Record<PreferredBankId, BankRateRange> = {
  BBVA: { rateMin: 9.15, rateMax: 11.20, catMin: 13.0, catMax: 13.4, effectiveDate: "2026-Q1" },
  Santander: { rateMin: 8.85, rateMax: 10.65, catMin: 10.7, catMax: 12.6, effectiveDate: "2026-Q1" },
  Banorte: { rateMin: 9.15, rateMax: 11.20, catMin: 12.4, catMax: 13.1, effectiveDate: "2026-Q1" },
};

export const INGRESO_MIDPOINTS: Record<IngresoRange, number> = {
  "15k-30k": 22500,
  "30k-60k": 45000,
  "60k-120k": 90000,
  "120k+": 150000,
};

export const INGRESO_LABELS: Record<IngresoRange, string> = {
  "15k-30k": "$15,000 – $30,000",
  "30k-60k": "$30,000 – $60,000",
  "60k-120k": "$60,000 – $120,000",
  "120k+": "Más de $120,000",
};

export const SITUACION_LABORAL_LABELS: Record<SituacionLaboral, string> = {
  asalariado: "Asalariado (con recibo de nómina)",
  independiente: "Independiente / honorarios",
  empresario: "Empresario / accionista",
  mixto: "Ingresos mixtos",
};

export function calculateMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  years: number,
): number {
  if (principal <= 0 || years <= 0) return 0;
  const i = annualRatePercent / 100 / 12;
  const n = years * 12;
  const factor = Math.pow(1 + i, n);
  return (principal * i * factor) / (factor - 1);
}

export function calculateEstimateRange(
  bankId: PreferredBankId,
  principal: number,
  years: number,
) {
  const rates = BANK_RATES[bankId];
  return {
    monthlyMin: calculateMonthlyPayment(principal, rates.rateMin, years),
    monthlyMax: calculateMonthlyPayment(principal, rates.rateMax, years),
    rateMin: rates.rateMin,
    rateMax: rates.rateMax,
    catMin: rates.catMin,
    catMax: rates.catMax,
  };
}

export function calculateLTV(montoFinanciar: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return Math.min(montoFinanciar / propertyValue, 1);
}

export function calculateLeadScore(
  ltv: number,
  ingresoRange: IngresoRange,
  estimatedMonthlyMax: number,
): LeadScore {
  const ingresoMidpoint = INGRESO_MIDPOINTS[ingresoRange];
  if (ltv <= 0.5) return "verde";
  if (ltv <= 0.8 && ingresoMidpoint * 3.5 >= estimatedMonthlyMax) return "verde";
  if (ltv <= 0.9 && ingresoMidpoint * 3 >= estimatedMonthlyMax) return "amarillo";
  return "rojo";
}

// ── In-memory store ──
const store: Record<string, MortgageProcess> = {};

export const getMortgageProcess = (propertyId: string): MortgageProcess | undefined =>
  store[propertyId];

export const saveMortgageProcess = (process: MortgageProcess): void => {
  store[process.propertyId] = { ...process, lastUpdate: new Date().toISOString() };
};

export const clearMortgageProcess = (propertyId: string): void => {
  delete store[propertyId];
};

// ── Validation ──
export const isValidOtherBank = (details: Partial<OtherBankDetails>): boolean => {
  return Boolean(
    details.institution?.trim() &&
      details.contactName?.trim() &&
      details.contactPhone?.trim() &&
      details.branch?.trim(),
  );
};

// ── Status info ──
export type StatusTone = "info" | "success" | "warning" | "destructive";

export interface StatusInfo {
  label: string;
  description: string;
  tone: StatusTone;
}

export const getPreValidationStatusInfo = (status: PreValidationStatus): StatusInfo => {
  switch (status) {
    case "not_started":
      return {
        label: "Pre-validación pendiente",
        description: "Abre la app del banco para iniciar tu pre-validación digital.",
        tone: "info",
      };
    case "in_progress":
      return {
        label: "Pre-validación en curso",
        description: "El banco está revisando tu solicitud. Recibirás respuesta pronto.",
        tone: "warning",
      };
    case "pre_approved":
      return {
        label: "Pre-aprobado",
        description: "Tu broker dedicado se pondrá en contacto para los siguientes pasos.",
        tone: "success",
      };
    case "rejected":
      return {
        label: "Solicitud rechazada",
        description: "Comunícate con SOZU para evaluar otras opciones de financiamiento.",
        tone: "destructive",
      };
    case "completed":
      return {
        label: "Crédito formalizado",
        description: "Listo para coordinar firma de escrituración con el notario.",
        tone: "success",
      };
  }
};

export const getOtherBankStatusInfo = (status: OtherBankStatus): StatusInfo => {
  switch (status) {
    case "registered":
      return {
        label: "Banco registrado",
        description: "SOZU se pondrá en contacto con tu institución en los próximos días.",
        tone: "info",
      };
    case "contacted":
      return {
        label: "En contacto con tu banco",
        description: "Iniciamos la coordinación con el ejecutivo que registraste.",
        tone: "warning",
      };
    case "in_coordination":
      return {
        label: "Coordinación en curso",
        description: "Estamos alineando notario y fecha de firma con tu banco.",
        tone: "warning",
      };
    case "completed":
      return {
        label: "Crédito coordinado",
        description: "Todo listo para escriturar. Te notificaremos la fecha de firma.",
        tone: "success",
      };
  }
};
