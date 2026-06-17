export type AmbassadorType =
  | 'cliente' | 'socio' | 'aliado' | 'referidor_externo' | 'colaborador' | 'otro';

export type AmbassadorStatus = 'activo' | 'inactivo' | 'pendiente';
export type CommissionTrigger = 'apartado' | 'promesa' | 'enganche' | 'escrituracion';
export type CommissionStatus = 'potencial' | 'generada' | 'autorizada' | 'pagada' | 'cancelada';

export type ReferralStatus =
  | 'registrado' | 'validado' | 'contactado' | 'cita_agendada' | 'cita_realizada'
  | 'en_seguimiento' | 'apartado' | 'promesa_firmada' | 'venta_cerrada'
  | 'comision_generada' | 'comision_pagada' | 'descartado' | 'duplicado';

export type InterestType = 'vivir' | 'inversion' | 'patrimonial' | 'indefinido';
export type ProtectionStatus = 'protegido' | 'pendiente' | 'duplicado_revision' | 'no_valido';
export type DocumentStatus = 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado';

export interface PaymentDocument {
  key: string; label: string; status: DocumentStatus;
  fileName?: string; uploadedAt?: string; rejectionReason?: string;
}

export interface AmbassadorNotification {
  id: string; ambassadorId: string; referralId?: string;
  type: string; message: string; createdAt: string; read: boolean;
}

export interface AdvisorNotification {
  id: string; advisorId: string; referralId: string;
  type: string; title: string; message: string; createdAt: string; read: boolean;
}

export interface Advisor {
  id: string; name: string; role: string;
  phone?: string; email?: string; avatarUrl?: string; active: boolean;
}

export type AssignmentStatus = 'sin_asignar' | 'asignado' | 'en_seguimiento' | 'reasignado' | 'pausado';

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  sin_asignar: 'Sin asesor asignado',
  asignado: 'Asesor asignado',
  en_seguimiento: 'En seguimiento por asesor',
  reasignado: 'Reasignado',
  pausado: 'Seguimiento pausado',
};

export function ambassadorVisibleAssignment(s: AssignmentStatus): string {
  if (s === 'sin_asignar') return 'Pendiente de asignación';
  if (s === 'en_seguimiento') return 'En seguimiento';
  return 'Asesor asignado';
}

export interface AmbassadorsSettings {
  unassignedAlertHours: number;
  noUpdateAlertDays: number;
}

export const DEFAULT_SETTINGS: AmbassadorsSettings = {
  unassignedAlertHours: 24,
  noUpdateAlertDays: 5,
};

export const DEFAULT_PAYMENT_DOCS: PaymentDocument[] = [
  { key: 'convenio', label: 'Convenio de Embajador firmado', status: 'pendiente' },
  { key: 'id', label: 'Identificación oficial', status: 'pendiente' },
  { key: 'rfc', label: 'Constancia de situación fiscal', status: 'pendiente' },
  { key: 'bancarios', label: 'Datos bancarios', status: 'pendiente' },
  { key: 'factura', label: 'Factura / recibo (al pago)', status: 'pendiente' },
];

export interface Ambassador {
  id: string; fullName: string; phone: string; email: string;
  company?: string; type: AmbassadorType; status: AmbassadorStatus;
  createdAt: string; code: string; referralLink: string;
  commissionPct: number; fixedAmount?: number;
  commissionTrigger: CommissionTrigger;
  notes?: string; paymentDocs?: PaymentDocument[]; protectionDays?: number;
}

export interface AmbassadorAuditEvent {
  timestamp: string;
  actor: 'admin' | 'embajador' | 'sistema';
  type: string;
  details?: string;
}

export interface Referral {
  id: string; ambassadorId: string; clientName: string;
  phone: string; email: string; relationship?: string; comments?: string;
  interestType: InterestType; productInterest?: string; consent: boolean;
  registeredAt: string; status: ReferralStatus;
  assignedAdvisorId?: string; assignedAdvisorName?: string;
  assignedAdvisorRole?: string; assignedAdvisorPhone?: string;
  assignedAdvisorEmail?: string; assignedAt?: string;
  assignmentStatus?: AssignmentStatus; lastAdvisorUpdate?: string;
  internalNotes: string[]; publicComments?: string; nextStepOverride?: string;
  protectionStatus?: ProtectionStatus;
  saleAmount?: number; commissionAmount: number;
  commissionStatus: CommissionStatus;
  estimatedPaymentDate?: string; paymentDate?: string;
  auditTrail: AmbassadorAuditEvent[];
}

export const AMBASSADOR_TYPE_LABEL: Record<AmbassadorType, string> = {
  cliente: 'Cliente', socio: 'Socio', aliado: 'Aliado',
  referidor_externo: 'Referidor externo',
  colaborador: 'Colaborador', otro: 'Otro',
};

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  registrado: 'Registrado', validado: 'Validado', contactado: 'Contactado',
  cita_agendada: 'Cita agendada', cita_realizada: 'Cita realizada',
  en_seguimiento: 'En seguimiento', apartado: 'Apartado',
  promesa_firmada: 'Promesa firmada', venta_cerrada: 'Venta cerrada',
  comision_generada: 'Comisión generada', comision_pagada: 'Comisión pagada',
  descartado: 'Descartado', duplicado: 'Duplicado',
};

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  potencial: 'Potencial', generada: 'Generada', autorizada: 'Autorizada',
  pagada: 'Pagada', cancelada: 'Cancelada',
};

export const COMMISSION_STATUS_HELP: Record<CommissionStatus, string> = {
  potencial: 'Estimación calculada sobre referidos en proceso. No representa una comisión garantizada.',
  generada: 'Se activa cuando el referido cumple la condición comercial definida.',
  autorizada: 'Aprobada internamente para pago. Pendiente de programación.',
  pagada: 'Comisión ya liquidada al Embajador.',
  cancelada: 'No procede por cancelación, duplicidad o incumplimiento de reglas.',
};

export const PROTECTION_STATUS_LABEL: Record<ProtectionStatus, string> = {
  protegido: 'Protegido', pendiente: 'Pendiente de validación',
  duplicado_revision: 'Duplicado en revisión', no_valido: 'No válido',
};

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  pendiente: 'Pendiente', en_revision: 'En revisión',
  aprobado: 'Aprobado', rechazado: 'Rechazado',
};

export function mapStatusForAmbassador(status: ReferralStatus): string {
  switch (status) {
    case 'registrado': return 'Registrado';
    case 'validado':
    case 'contactado':
    case 'cita_agendada': return 'En contacto';
    case 'cita_realizada':
    case 'en_seguimiento': return 'En seguimiento';
    case 'apartado':
    case 'promesa_firmada': return 'Apartado';
    case 'venta_cerrada': return 'Venta cerrada';
    case 'comision_generada': return 'Comisión en proceso';
    case 'comision_pagada': return 'Comisión pagada';
    case 'duplicado': return 'Duplicado';
    case 'descartado': return 'Descartado';
  }
}

export function nextStepFor(status: ReferralStatus): string {
  switch (status) {
    case 'registrado': return 'Validación pendiente';
    case 'validado': return 'Contacto inicial pendiente';
    case 'contactado': return 'Cita por confirmar';
    case 'cita_agendada': return 'Cita agendada';
    case 'cita_realizada':
    case 'en_seguimiento': return 'Esperando decisión del cliente';
    case 'apartado': return 'Firma en proceso';
    case 'promesa_firmada': return 'Enganche pendiente';
    case 'venta_cerrada': return 'Comisión en revisión';
    case 'comision_generada': return 'Autorización de pago';
    case 'comision_pagada':
    case 'descartado': return 'Proceso finalizado';
    case 'duplicado': return 'En revisión por duplicidad';
  }
}

export function protectionStatusFor(r: Referral): ProtectionStatus {
  if (r.protectionStatus) return r.protectionStatus;
  if (r.status === 'duplicado') return 'duplicado_revision';
  if (r.status === 'descartado') return 'no_valido';
  if (r.status === 'registrado') return 'pendiente';
  return 'protegido';
}

export const TIMELINE_STAGES: { key: ReferralStatus; label: string }[] = [
  { key: 'registrado', label: 'Referido registrado' },
  { key: 'validado', label: 'Referido validado' },
  { key: 'contactado', label: 'Cliente contactado' },
  { key: 'cita_agendada', label: 'Cita agendada' },
  { key: 'cita_realizada', label: 'Cita realizada' },
  { key: 'en_seguimiento', label: 'En seguimiento' },
  { key: 'apartado', label: 'Apartado' },
  { key: 'promesa_firmada', label: 'Promesa firmada' },
  { key: 'venta_cerrada', label: 'Enganche / venta' },
  { key: 'comision_generada', label: 'Comisión generada' },
  { key: 'comision_pagada', label: 'Comisión pagada' },
];

export function stageIndex(status: ReferralStatus): number {
  const i = TIMELINE_STAGES.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const normPhone = (s: string) => s.replace(/\D/g, '').slice(-10);

export function detectDuplicate(
  referrals: Referral[],
  candidate: Pick<Referral, 'phone' | 'email' | 'clientName'>,
): Referral | null {
  const cp = normPhone(candidate.phone);
  const ce = norm(candidate.email);
  const cn = norm(candidate.clientName);
  return (
    referrals.find(
      (r) =>
        (cp && normPhone(r.phone) === cp) ||
        (ce && norm(r.email) === ce) ||
        (cn && norm(r.clientName) === cn),
    ) ?? null
  );
}