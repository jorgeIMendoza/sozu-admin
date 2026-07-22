// ── Domain Types ──
// Extracted from mock-data.ts for reuse across the application

export type TransactionStage =
  | "preventa"
  | "pago_final"
  | "escrituracion"
  | "entrega"
  | "post_entrega";

export type StageStatus = "completed" | "active" | "pending";

export interface StageInfo {
  id: TransactionStage;
  label: string;
  description: string;
  status: StageStatus;
  cta?: { label: string; action: string };
  contextMessage?: string;
  details?: Record<string, string>;
}

export interface NotaryData {
  name: string;    // notarios.nombre (personal name)
  notaria: string; // notarios.notaria (office name)
  phone: string;
  email: string;
  address: string;
}

export interface PropertyData {
  id: string;
  projectName: string;
  unitNumber: string;
  location: string;
  type: string;
  area: string;
  floor: string;
  bedrooms: number;
  bathrooms: number;
  deliveryDate: string;
  imageGradient: string;
  image?: string;
  address?: string;
  fechaEscritura?: string;
  projectId?: number;
  idPropiedad?: number;
  clientName?: string;
  clientRFC?: string;
  notary?: NotaryData;
  tipoFinanciamiento?: 'RECURSOS_PROPIOS' | 'CREDITO_HIPOTECARIO' | null;
  enDemanda?: boolean; // id_estatus_disponibilidad = 11 (proceso legal) → modo solo lectura
}

export interface FinancialData {
  initialPrice: number;
  totalPaid: number;
  pendingBalance: number;
  estimatedAppreciation: number;
  currentEstimatedValue: number;
  pricePerM2Initial: number;
  pricePerM2Current: number;
  currency: string;
  clabe?: string;
}

export interface MaintenanceData {
  monthlyFee: number;
  nextDueDate: string;
  status: "pagado" | "pendiente";
  history: { month: string; amount: number; status: "pagado" | "pendiente" }[];
}

export interface PaymentRecord {
  date: string;
  concept: string;
  amount: number;
  status: "pagado" | "pendiente";
  pagoId?: number;
  cepUrl?: string;
  evidenceUrl?: string;
  trackingKey?: string;
  paymentMethodName?: string;
  receiptUrl?: string;
}

export interface AdditionalProduct {
  id: string;
  name: string;
  /** Categoría del producto: 1=Estacionamiento, 2=Bodega, 3=Muebles, 4=Condensadora. */
  categoriaId?: number | null;
  description?: string;
  totalPrice: number;
  totalPaid: number;
  pendingBalance: number;
  status: "pendiente" | "financiado" | "pagado" | "entregado";
  financingPlan?: string;
  nextDueDate?: string;
  nextDueAmount?: number;
  estimatedDelivery?: string;
  documents: { name: string; status: "disponible" | "pendiente" }[];
}

export interface InvestmentProperty {
  property: PropertyData;
  financials: FinancialData;
  stages: StageInfo[];
  payments: PaymentRecord[];
  maintenance?: MaintenanceData;
  additionalProducts?: AdditionalProduct[];
}

export interface SmartAlert {
  id: string;
  type: "warning" | "info" | "success";
  icon: string;
  message: string;
  propertyId: string;
  priority: number;
}
