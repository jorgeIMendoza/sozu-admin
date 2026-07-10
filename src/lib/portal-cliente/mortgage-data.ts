// ── Mortgage / Crédito hipotecario data layer ──
// Store en memoria de la decisión de crédito por propiedad, usado por Pago Final.
// Solo bancos con convenio real (BBVA / Santander / Banorte) desde `bancos_convenio`.
// No se recaba perfil ni contacto del cliente: ya lo tenemos en la BD.

// ── Banco seleccionado (viene de bancos_convenio) ──

export interface BankRateInfo {
  tasaMin: number | null;
  tasaMax: number | null;
  catMin: number | null;
  catMax: number | null;
}

export interface SelectedBank {
  idBanco: number;
  nombre: string;
  rates: BankRateInfo;
}

/** ¿El banco tiene tasas configuradas para poder mostrar estimación? */
export const hasRates = (r: BankRateInfo): boolean =>
  r.tasaMin != null && r.tasaMax != null;

export type MortgageChoice = { type: "preferred"; bank: SelectedBank };

export type PreValidationStatus =
  | "not_started"
  | "in_progress"
  | "pre_approved"
  | "rejected"
  | "completed";

export interface MortgageProcess {
  propertyId: string;
  declaredAt: string;
  choice: MortgageChoice;
  preferredStatus?: PreValidationStatus;
  lastUpdate?: string;
  prequalification?: PrequalificationData;
}

// ── Pre-calificación: datos enviados al banco ──
// Solo lo que el cliente elige (monto/plazo) + estimación derivada de las tasas
// del banco (si las hay). Sin ingreso/situación/contacto: ya está en la BD.

export interface PrequalificationData {
  idBanco: number;
  bankName: string;
  montoFinanciar: number;
  plazoAnios: number;
  // Estimacion - solo presente si el banco tiene tasas configuradas
  estimatedMonthlyMin?: number;
  estimatedMonthlyMax?: number;
  estimatedRateMin?: number;
  estimatedRateMax?: number;
  estimatedCatMin?: number;
  estimatedCatMax?: number;
  consentimientoCompartirDatos: boolean;
  submittedAt: string;
}

export function calculateMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  years: number,
): number {
  if (principal <= 0 || years <= 0) return 0;
  const i = annualRatePercent / 100 / 12;
  const n = years * 12;
  if (i === 0) return principal / n;
  const factor = Math.pow(1 + i, n);
  return (principal * i * factor) / (factor - 1);
}

export interface EstimateResult {
  monthlyMin: number;
  monthlyMax: number;
  rateMin: number;
  rateMax: number;
  catMin: number | null;
  catMax: number | null;
}

/** Estimación a partir de las tasas del banco. Null si el banco no tiene tasas. */
export function calculateEstimateFromRates(
  principal: number,
  years: number,
  rates: BankRateInfo,
): EstimateResult | null {
  if (rates.tasaMin == null || rates.tasaMax == null) return null;
  return {
    monthlyMin: calculateMonthlyPayment(principal, rates.tasaMin, years),
    monthlyMax: calculateMonthlyPayment(principal, rates.tasaMax, years),
    rateMin: rates.tasaMin,
    rateMax: rates.tasaMax,
    catMin: rates.catMin,
    catMax: rates.catMax,
  };
}

// ── Store en memoria ──
const store: Record<string, MortgageProcess> = {};

export const getMortgageProcess = (propertyId: string): MortgageProcess | undefined =>
  store[propertyId];

export const saveMortgageProcess = (process: MortgageProcess): void => {
  store[process.propertyId] = { ...process, lastUpdate: new Date().toISOString() };
};

export const clearMortgageProcess = (propertyId: string): void => {
  delete store[propertyId];
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
        label: "Selección registrada",
        description: "Envía tu solicitud al banco para iniciar tu crédito hipotecario.",
        tone: "info",
      };
    case "in_progress":
      return {
        label: "Solicitud enviada",
        description: "El banco está revisando tu solicitud. Un broker te contactará pronto.",
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
        description: "Puedes elegir otro banco o comunicarte con SOZU.",
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
