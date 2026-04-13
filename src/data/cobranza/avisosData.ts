import { mockAccounts } from './mockData';
import { mockCases } from './mockDataExtended';

// ── Aviso Types ─────────────────────────────────────────────────
export type AvisoCategory = 'cobranza_preventiva' | 'cobranza_vencida' | 'estado_cuenta' | 'comprobante' | 'documentacion' | 'penalizacion' | 'legal' | 'entrega_escrituracion' | 'general';

export const avisoCategoryLabels: Record<AvisoCategory, string> = {
  cobranza_preventiva: 'Cobranza preventiva',
  cobranza_vencida: 'Cobranza vencida',
  estado_cuenta: 'Estado de cuenta',
  comprobante: 'Comprobante',
  documentacion: 'Documentación',
  penalizacion: 'Penalización',
  legal: 'Legal',
  entrega_escrituracion: 'Entrega / escrituración',
  general: 'General',
};

export type AvisoChannel = 'email' | 'whatsapp' | 'sms';

export type SendStatus = 'pendiente' | 'enviado' | 'entregado' | 'leido' | 'error' | 'rebotado' | 'requiere_seguimiento';

export const sendStatusLabels: Record<SendStatus, string> = {
  pendiente: 'Pendiente',
  enviado: 'Enviado',
  entregado: 'Entregado',
  leido: 'Leído',
  error: 'Error',
  rebotado: 'Rebotado',
  requiere_seguimiento: 'Requiere seguimiento',
};

export const sendStatusConfig: Record<SendStatus, { bg: string; text: string }> = {
  pendiente: { bg: 'bg-warning-bg', text: 'text-warning' },
  enviado: { bg: 'bg-info/10', text: 'text-info' },
  entregado: { bg: 'bg-success-bg', text: 'text-success' },
  leido: { bg: 'bg-success-bg', text: 'text-success' },
  error: { bg: 'bg-danger-bg', text: 'text-danger' },
  rebotado: { bg: 'bg-danger-bg', text: 'text-danger' },
  requiere_seguimiento: { bg: 'bg-priority-purple/10', text: 'text-priority-purple' },
};

export type ErrorType = 'correo_invalido' | 'rebote_previo' | 'queja_spam' | 'canal_sin_datos' | 'error_plantilla' | 'error_tecnico';

export const errorTypeLabels: Record<ErrorType, string> = {
  correo_invalido: 'Correo inválido',
  rebote_previo: 'Rebote previo',
  queja_spam: 'Queja de spam',
  canal_sin_datos: 'Canal sin datos',
  error_plantilla: 'Error de plantilla',
  error_tecnico: 'Error técnico',
};

export type SuggestedAction = 'reenviar' | 'llamar' | 'whatsapp' | 'actualizar_email' | 'escalar' | 'seguimiento_manual';

export const suggestedActionLabels: Record<SuggestedAction, string> = {
  reenviar: 'Reenviar',
  llamar: 'Contactar por llamada',
  whatsapp: 'Contactar por WhatsApp',
  actualizar_email: 'Actualizar email',
  escalar: 'Escalar',
  seguimiento_manual: 'Seguimiento manual',
};

export interface AvisoRecord {
  id: string;
  accountId: string;
  clientName: string;
  caseId?: string;
  category: AvisoCategory;
  channel: AvisoChannel;
  subject: string;
  preview: string;
  sentBy: string;
  sentDate: string;
  status: SendStatus;
  errorType?: ErrorType;
  errorDetail?: string;
  suggestedAction?: SuggestedAction;
  followUpNote?: string;
}

// ── Plantillas de Cobranza ──────────────────────────────────────
export interface CobranzaTemplate {
  id: string;
  name: string;
  category: AvisoCategory;
  channel: AvisoChannel;
  subject: string;
  preview: string;
}

export const cobranzaTemplates: CobranzaTemplate[] = [
  { id: 'tpl-c1', name: 'Recordatorio preventivo', category: 'cobranza_preventiva', channel: 'email', subject: 'Recordatorio de pago próximo', preview: 'Estimado cliente, le recordamos que su próxima fecha de pago se acerca...' },
  { id: 'tpl-c2', name: 'Aviso de parcialidad vencida', category: 'cobranza_vencida', channel: 'email', subject: 'Parcialidad vencida - Acción requerida', preview: 'Le informamos que su parcialidad presenta un retraso...' },
  { id: 'tpl-c3', name: 'Envío de estado de cuenta', category: 'estado_cuenta', channel: 'email', subject: 'Estado de cuenta actualizado', preview: 'Adjunto encontrará su estado de cuenta actualizado al día de hoy...' },
  { id: 'tpl-c4', name: 'Confirmación de comprobante', category: 'comprobante', channel: 'email', subject: 'Comprobante de pago', preview: 'Adjunto el comprobante de pago solicitado correspondiente a...' },
  { id: 'tpl-c5', name: 'Solicitud de documentación', category: 'documentacion', channel: 'email', subject: 'Documentación pendiente', preview: 'Le solicitamos actualizar la documentación de su expediente...' },
  { id: 'tpl-c6', name: 'Aviso de penalización', category: 'penalizacion', channel: 'email', subject: 'Aviso de penalización por incumplimiento', preview: 'Le informamos que debido al incumplimiento de pago, se ha iniciado...' },
  { id: 'tpl-c7', name: 'Notificación prelegal', category: 'legal', channel: 'email', subject: 'Notificación formal de incumplimiento', preview: 'Por medio de la presente se le notifica formalmente...' },
  { id: 'tpl-c8', name: 'Recordatorio WhatsApp', category: 'cobranza_preventiva', channel: 'whatsapp', subject: 'Recordatorio de pago', preview: 'Hola, le recordamos que su próximo pago es el día...' },
  { id: 'tpl-c9', name: 'Seguimiento de promesa', category: 'cobranza_vencida', channel: 'whatsapp', subject: 'Seguimiento de compromiso', preview: 'Hola, damos seguimiento al compromiso de pago registrado...' },
];

// ── Mock Aviso Records ──────────────────────────────────────────
const a = mockAccounts;

export const mockAvisos: AvisoRecord[] = [
  // Successful sends
  { id: 'AV-001', accountId: a[0].id, clientName: a[0].client.name, caseId: 'CASE-001', category: 'comprobante', channel: 'email', subject: 'Comprobante de pago - Febrero 2026', preview: 'Estimado cliente, adjunto el comprobante de su pago de febrero.', sentBy: 'Luz Ochoa', sentDate: '2026-03-28T10:30:00', status: 'entregado' },
  { id: 'AV-002', accountId: a[2].id, clientName: a[2].client.name, caseId: 'CASE-004', category: 'estado_cuenta', channel: 'email', subject: 'Estado de cuenta actualizado', preview: 'Adjunto su estado de cuenta al 25 de marzo de 2026.', sentBy: 'Tomás Peterson', sentDate: '2026-03-25T09:30:00', status: 'leido' },
  { id: 'AV-003', accountId: a[5].id, clientName: a[5].client.name, category: 'cobranza_preventiva', channel: 'whatsapp', subject: 'Recordatorio de pago', preview: 'Hola, le recordamos que su próximo pago vence el 5 de abril.', sentBy: 'Tomás Peterson', sentDate: '2026-03-27T08:00:00', status: 'leido' },
  { id: 'AV-004', accountId: a[18].id, clientName: a[18].client.name, caseId: 'CASE-003', category: 'cobranza_vencida', channel: 'email', subject: 'Parcialidades vencidas - Regularización', preview: 'Le informamos que su cuenta presenta 3 parcialidades vencidas.', sentBy: 'Luz Ochoa', sentDate: '2026-03-26T11:00:00', status: 'enviado' },

  // Errors
  { id: 'AV-005', accountId: a[10].id, clientName: a[10].client.name, caseId: 'CASE-009', category: 'estado_cuenta', channel: 'email', subject: 'Estado de cuenta - Marzo 2026', preview: 'Adjunto su estado de cuenta actualizado.', sentBy: 'Luz Ochoa', sentDate: '2026-03-26T14:00:00', status: 'rebotado', errorType: 'correo_invalido', errorDetail: 'El correo miguel.vargas@mail.com no existe o fue dado de baja.', suggestedAction: 'actualizar_email' },
  { id: 'AV-006', accountId: a[43].id, clientName: a[43].client.name, caseId: 'CASE-005', category: 'penalizacion', channel: 'email', subject: 'Aviso de penalización', preview: 'Le informamos que se ha iniciado proceso de penalización.', sentBy: 'Luz Ochoa', sentDate: '2026-03-24T17:00:00', status: 'error', errorType: 'error_tecnico', errorDetail: 'Timeout al conectar con servidor SMTP.', suggestedAction: 'reenviar' },
  { id: 'AV-007', accountId: a[35].id, clientName: a[35].client.name, category: 'documentacion', channel: 'email', subject: 'Actualización de documentos requerida', preview: 'Se requiere actualizar su comprobante de domicilio.', sentBy: 'Luz Ochoa', sentDate: '2026-03-27T16:30:00', status: 'rebotado', errorType: 'rebote_previo', errorDetail: 'Dirección de correo marcada por rebote previo.', suggestedAction: 'llamar' },

  // Requires follow-up
  { id: 'AV-008', accountId: a[50].id, clientName: a[50].client.name, caseId: 'CASE-016', category: 'cobranza_vencida', channel: 'email', subject: 'Aclaración de cobro duplicado', preview: 'Estimado cliente, estamos revisando el posible cobro duplicado.', sentBy: 'Tomás Peterson', sentDate: '2026-03-25T15:00:00', status: 'requiere_seguimiento', suggestedAction: 'seguimiento_manual', followUpNote: 'Cliente no ha respondido en 3 días.' },

  // More successful
  { id: 'AV-009', accountId: a[14].id, clientName: a[14].client.name, category: 'cobranza_preventiva', channel: 'email', subject: 'Recordatorio de pago - Abril 2026', preview: 'Le recordamos que su próxima fecha de pago se acerca.', sentBy: 'Tomás Peterson', sentDate: '2026-03-27T09:00:00', status: 'entregado' },
  { id: 'AV-010', accountId: a[25].id, clientName: a[25].client.name, category: 'estado_cuenta', channel: 'email', subject: 'Estado de cuenta Q1 2026', preview: 'Adjunto su estado de cuenta del primer trimestre.', sentBy: 'Luz Ochoa', sentDate: '2026-03-20T10:00:00', status: 'leido' },
  { id: 'AV-011', accountId: a[30].id, clientName: a[30].client.name, category: 'entrega_escrituracion', channel: 'email', subject: 'Actualización sobre entrega', preview: 'Le compartimos información actualizada sobre su proceso de entrega.', sentBy: 'Tomás Peterson', sentDate: '2026-03-26T15:00:00', status: 'enviado' },
  { id: 'AV-012', accountId: a[55].id, clientName: a[55].client.name, category: 'cobranza_vencida', channel: 'whatsapp', subject: 'Seguimiento de promesa de pago', preview: 'Hola, damos seguimiento al compromiso registrado el 20 de marzo.', sentBy: 'Luz Ochoa', sentDate: '2026-03-28T11:00:00', status: 'leido' },
];

// ── Helpers ─────────────────────────────────────────────────────
const avisoCache: AvisoRecord[] = [...mockAvisos];

export function getAvisosForAccount(accountId: string): AvisoRecord[] {
  return avisoCache.filter(av => av.accountId === accountId).sort((a, b) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());
}

export function getAvisosForCase(caseId: string): AvisoRecord[] {
  return avisoCache.filter(av => av.caseId === caseId).sort((a, b) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());
}

export function getAvisosWithErrors(): AvisoRecord[] {
  return avisoCache.filter(av => av.status === 'error' || av.status === 'rebotado' || av.status === 'requiere_seguimiento').sort((a, b) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());
}

export function getAllAvisos(): AvisoRecord[] {
  return [...avisoCache].sort((a, b) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());
}

export function addAviso(aviso: AvisoRecord) {
  avisoCache.unshift(aviso);
}
