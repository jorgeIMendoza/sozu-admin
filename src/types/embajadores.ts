export type EmbajadorType =
  | 'cliente' | 'socio' | 'aliado' | 'referidor_externo' | 'colaborador' | 'otro';

export type EmbajadorStatus = 'activo' | 'inactivo' | 'pendiente';

export type CommissionTrigger = 'apartado' | 'promesa' | 'enganche' | 'escrituracion';

export type CommissionStatus =
  | 'potencial' | 'generada' | 'autorizada' | 'pagada' | 'cancelada';

export type ReferralStatus =
  | 'registrado' | 'validado' | 'contactado' | 'cita_agendada' | 'cita_realizada'
  | 'en_seguimiento' | 'apartado' | 'promesa_firmada' | 'venta_cerrada'
  | 'comision_generada' | 'comision_pagada' | 'descartado' | 'duplicado';

export type InterestType = 'vivir' | 'inversion' | 'patrimonial' | 'indefinido';

export interface Embajador {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  company?: string;
  type: EmbajadorType;
  status: EmbajadorStatus;
  createdAt: string;
  code: string;
  referralLink: string;
  commissionPct: number;
  commissionTrigger: CommissionTrigger;
  notes?: string;
}

export interface Referral {
  id: string;
  embajadorId: string;
  clientName: string;
  phone: string;
  email: string;
  interestType: InterestType;
  productInterest?: string;
  registeredAt: string;
  status: ReferralStatus;
  assignedAdvisorName?: string;
  saleAmount?: number;
  commissionAmount: number;
  commissionStatus: CommissionStatus;
  paymentDate?: string;
}

export const EMBAJADOR_TYPE_LABEL: Record<EmbajadorType, string> = {
  cliente: 'Cliente', socio: 'Socio', aliado: 'Aliado',
  referidor_externo: 'Referidor externo', colaborador: 'Colaborador', otro: 'Otro',
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

export function mapStatusForEmbajador(status: ReferralStatus): string {
  switch (status) {
    case 'registrado': return 'Registrado';
    case 'validado': case 'contactado': case 'cita_agendada': return 'En contacto';
    case 'cita_realizada': case 'en_seguimiento': return 'En seguimiento';
    case 'apartado': case 'promesa_firmada': return 'Apartado';
    case 'venta_cerrada': return 'Venta cerrada';
    case 'comision_generada': return 'Comisión en proceso';
    case 'comision_pagada': return 'Comisión pagada';
    case 'duplicado': return 'Duplicado';
    case 'descartado': return 'Descartado';
  }
}