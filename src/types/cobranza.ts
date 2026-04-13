export type PriorityLevel = 'green' | 'yellow' | 'red' | 'purple' | 'blue' | 'gray';

// ── Legal Entities ──────────────────────────────────────────────
export interface LegalEntity {
  id: string;
  name: string;
  rfc?: string;
}

// ── Charge Types ────────────────────────────────────────────────
export type ChargeType = 'propiedad' | 'bodega' | 'paquete_muebles' | 'condensadora' | 'estacionamiento' | 'servicios';

export const chargeTypeLabels: Record<ChargeType, string> = {
  propiedad: 'Propiedad',
  bodega: 'Bodega',
  paquete_muebles: 'Paq. muebles',
  condensadora: 'Condensadora',
  estacionamiento: 'Estacionamiento',
  servicios: 'Servicios',
};

export const chargeTypeFullLabels: Record<ChargeType, string> = {
  propiedad: 'Propiedad',
  bodega: 'Bodega',
  paquete_muebles: 'Paquete de muebles',
  condensadora: 'Condensadora',
  estacionamiento: 'Estacionamiento',
  servicios: 'Servicios',
};

export const chargeTypeColors: Record<ChargeType, { bg: string; text: string }> = {
  propiedad: { bg: 'bg-primary/10', text: 'text-primary' },
  bodega: { bg: 'bg-info/10', text: 'text-info' },
  paquete_muebles: { bg: 'bg-warning/10', text: 'text-warning' },
  condensadora: { bg: 'bg-priority-purple/10', text: 'text-priority-purple' },
  estacionamiento: { bg: 'bg-success/10', text: 'text-success' },
  servicios: { bg: 'bg-muted', text: 'text-muted-foreground' },
};

// Legacy aliases for backward compat
export type ChargeCategory = ChargeType;
export type ChargeSubtype = string;
export const chargeCategoryLabels = chargeTypeLabels;

export type AccountStatus = 'al_corriente' | 'vencida_1' | 'vencida_2' | 'vencida_3_plus' | 'prelegal' | 'legal' | 'conciliacion' | 'doc_incompleta';

export type PaymentStatus = 'pagado' | 'pendiente' | 'vencido' | 'parcial';

export type DocumentStatus = 'pendiente' | 'recibido' | 'validado' | 'rechazado';

export type PromiseStatus = 'activa' | 'cumplida' | 'vencida' | 'cancelada' | 'propuesta' | 'pendiente_confirmacion' | 'enviada_revision' | 'rechazada';

export type PromiseType = 'simple' | 'parcial' | 'reestructura_temporal' | 'convenio_regularizacion' | 'rescate_penalizacion' | 'terminacion_negociada';

export type IncidentType = 'pago_no_reflejado' | 'comprobante_pendiente' | 'referencia_invalida' | 'pago_duplicado' | 'cuenta_incorrecta' | 'revision_sistemas' | 'cep_pendiente' | 'pago_directo_desarrolladora' | 'monto_inconsistente' | 'pago_mal_aplicado' | 'no_identificado' | 'alerta_pld';

export type IncidentStatus = 'abierta' | 'en_revision' | 'resuelta' | 'rechazada';

export type CommunicationChannel = 'email' | 'whatsapp' | 'llamada' | 'nota_interna';

export type PLDStatus = 'validado' | 'pendiente_revision' | 'alerta_terceros' | 'evidencia_inconsistente' | 'bloqueado_pld' | 'liberado_pld';

export type LegalStatus =
  | 'sin_accion'
  | 'prelegal'
  | 'notificacion_preparacion'
  | 'vobo_juridico_pendiente'
  | 'enviada_notario'
  | 'programada_entrega'
  | 'entregada'
  | 'no_entregada'
  | 'reprogramada'
  | 'en_negociacion'
  | 'convenio_terminacion'
  | 'demanda_preparada'
  | 'demanda_presentada'
  | 'en_juicio'
  | 'sentencia'
  | 'rescindida'
  | 'liberada_comercialmente';

export const legalStatusLabels: Record<LegalStatus, string> = {
  sin_accion: 'Sin acción legal',
  prelegal: 'Prelegal',
  notificacion_preparacion: 'Notificación en preparación',
  vobo_juridico_pendiente: 'VoBo jurídico pendiente',
  enviada_notario: 'Enviada a notario/corredor',
  programada_entrega: 'Entrega programada',
  entregada: 'Entregada',
  no_entregada: 'No entregada',
  reprogramada: 'Reprogramada',
  en_negociacion: 'En negociación',
  convenio_terminacion: 'Convenio de terminación',
  demanda_preparada: 'Demanda preparada',
  demanda_presentada: 'Demanda presentada',
  en_juicio: 'En juicio',
  sentencia: 'Sentencia',
  rescindida: 'Rescindida',
  liberada_comercialmente: 'Liberada comercialmente',
};

export const pldStatusLabels: Record<PLDStatus, string> = {
  validado: 'Validado',
  pendiente_revision: 'Pendiente revisión',
  alerta_terceros: 'Alerta pagos terceros',
  evidencia_inconsistente: 'Evidencia inconsistente',
  bloqueado_pld: 'Bloqueado por PLD',
  liberado_pld: 'Liberado por PLD',
};

export const promiseTypeLabels: Record<PromiseType, string> = {
  simple: 'Promesa simple',
  parcial: 'Pago parcial',
  reestructura_temporal: 'Reestructura temporal',
  convenio_regularizacion: 'Convenio de regularización',
  rescate_penalizacion: 'Rescate por penalización',
  terminacion_negociada: 'Terminación negociada',
};

export interface Project {
  id: string;
  name: string;
  location: string;
  totalUnits: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  rfc?: string;
}

export interface Account {
  id: string;
  accountId: string;
  accountNumber: string;
  clabe: string;
  clientId: string;
  client: Client;
  coOwners?: Client[];
  projectId: string;
  project: Project;
  building: string;
  unitNumber: string;
  model: string;
  totalPrice: number;
  paidAmount: number;
  balance: number;
  overdueAmount: number;
  paymentDay: number;
  currentInstallment: number;
  totalInstallments: number;
  overdueInstallments: number;
  lastPaymentDate: string | null;
  nextDueDate: string;
  status: AccountStatus;
  priority: PriorityLevel;
  assignedExecutive: string;
  seller: string;
  legalEntity: LegalEntity;
  chargeType: ChargeType;
  chargeCategory: ChargeCategory; // legacy alias
  chargeSubtype: ChargeSubtype; // legacy alias
  documentationComplete: boolean;
  conciliationPending: boolean;
  fullyReconciled: boolean;
  activePromise: PaymentPromise | null;
  lastContactChannel: CommunicationChannel | null;
  suggestedAction: string;
  separationDate: string;
  contractDate: string;
  estimatedDelivery: string;
  pldStatus: PLDStatus;
  legalStatus: LegalStatus;
}

export interface Installment {
  id: string;
  accountId: string;
  number: number;
  dueDate: string;
  amount: number;
  status: PaymentStatus;
  paidDate: string | null;
  daysOverdue: number;
  paymentRef?: string;
}

export interface FinancialMovement {
  id: string;
  accountId: string;
  date: string;
  type: 'cargo' | 'pago' | 'ajuste';
  concept: string;
  amount: number;
  balance: number;
  reference?: string;
  paymentMethod?: string;
  reconciled: boolean;
  receiptUrl?: string;
  notes?: string;
}

export interface PaymentPromise {
  id: string;
  accountId: string;
  promiseDate: string;
  amount: number;
  channel: CommunicationChannel;
  notes: string;
  registeredBy: string;
  status: PromiseStatus;
  createdAt: string;
  type?: PromiseType;
  approvedBy?: string;
  linkedToLegal?: boolean;
}

export interface Communication {
  id: string;
  accountId: string;
  date: string;
  channel: CommunicationChannel;
  direction: 'inbound' | 'outbound';
  subject: string;
  content: string;
  user: string;
  result?: string;
  templateUsed?: string;
}

export interface AccountDocument {
  id: string;
  accountId: string;
  name: string;
  category: string;
  status: DocumentStatus;
  uploadDate: string | null;
  validatedBy: string | null;
  notes: string;
  critical: boolean;
  fileUrl?: string;
}

export interface Incident {
  id: string;
  accountId: string;
  type: IncidentType;
  priority: 'alta' | 'media' | 'baja';
  openDate: string;
  sla: string;
  assignee: string;
  status: IncidentStatus;
  evidence?: string;
  comments: string[];
}

export interface WeeklyFlowData {
  week: number;
  range: string;
  projected: number;
  collected: number;
  obraProvision: number;
  difference: number;
  deficit: number;
  status: 'ok' | 'atencion' | 'alto' | 'critico';
}

export interface KPIData {
  totalPortfolio: number;
  currentPortfolio: number;
  overduePortfolio: number;
  overdueByProject: { project: string; amount: number }[];
  accounts1Overdue: number;
  accounts2Overdue: number;
  accounts3PlusOverdue: number;
  activePromises: number;
  brokenPromises: number;
  paymentsToday: number;
  pendingConciliation: number;
  incompleteDocumentation: number;
  legalCases: number;
  monthlyRecovery: number;
  agingData: { range: string; amount: number; count: number }[];
  upcomingDue7: number;
  upcomingDue15: number;
  upcomingDue30: number;
}
