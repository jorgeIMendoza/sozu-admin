import { mockAccounts } from './mockData';

// ── Customer Cases (Inbox) ──────────────────────────────────────
export type CaseType = 'problemas_plataforma' | 'aclaracion_pagos' | 'solicitud_comprobante' | 'solicitud_edo_cuenta' | 'pago_no_reflejado' | 'renegociacion' | 'penalizacion' | 'duda_entrega' | 'solicitud_contrato' | 'actualizacion_documental' | 'aclaracion_saldo' | 'entrega_escrituracion' | 'penalidad_entrega_tardia' | 'credito_hipotecario' | 'solicitud_factura' | 'devolucion_pago' | 'otro';
export type CaseStatus = 'abierto' | 'en_atencion' | 'esperando_cliente' | 'resuelto' | 'escalado' | 'archivado';
export type CaseChannel = 'whatsapp' | 'email' | 'llamada' | 'interno';

export const caseTypeLabels: Record<CaseType, string> = {
  problemas_plataforma: 'Problemas con plataforma',
  aclaracion_pagos: 'Aclaración de pagos',
  solicitud_comprobante: 'Solicitud de comprobante',
  solicitud_edo_cuenta: 'Solicitud de estado de cuenta',
  pago_no_reflejado: 'Pago no reflejado',
  renegociacion: 'Renegociación / compromiso',
  penalizacion: 'Cliente en penalización',
  duda_entrega: 'Duda sobre entrega',
  solicitud_contrato: 'Solicitud de contrato',
  actualizacion_documental: 'Actualización documental',
  aclaracion_saldo: 'Aclaración de saldo',
  entrega_escrituracion: 'Entrega y escrituración',
  penalidad_entrega_tardia: 'Penalidad por entrega tardía',
  credito_hipotecario: 'Crédito hipotecario',
  solicitud_factura: 'Solicitud de factura',
  devolucion_pago: 'Devolución por pago incorrecto',
  otro: 'Otro',
};

export const caseStatusLabels: Record<CaseStatus, string> = {
  abierto: 'Abierto',
  en_atencion: 'En atención',
  esperando_cliente: 'Esperando cliente',
  resuelto: 'Resuelto',
  escalado: 'Escalado',
  archivado: 'Archivado',
};

export type FollowUpType = 'llamada' | 'whatsapp' | 'email' | 'comprobante' | 'estado_cuenta' | 'documento' | 'revision_interna' | 'escalamiento' | 'revision_legal' | 'seguimiento_promesa' | 'seguimiento_conciliacion';

export const followUpTypeLabels: Record<FollowUpType, string> = {
  llamada: 'Llamada', whatsapp: 'WhatsApp', email: 'Email', comprobante: 'Envío de comprobante',
  estado_cuenta: 'Envío de estado de cuenta', documento: 'Solicitud de documento', revision_interna: 'Revisión interna',
  escalamiento: 'Escalamiento', revision_legal: 'Revisión legal', seguimiento_promesa: 'Seguimiento promesa', seguimiento_conciliacion: 'Seguimiento conciliación',
};

export type FollowUpResult = 'contactado' | 'sin_respuesta' | 'reprogramado' | 'cliente_solicita_tiempo' | 'comprobante_enviado' | 'edo_cuenta_enviado' | 'escalado' | 'resuelto' | 'no_procedio';

export const followUpResultLabels: Record<FollowUpResult, string> = {
  contactado: 'Contactado', sin_respuesta: 'Sin respuesta', reprogramado: 'Reprogramado',
  cliente_solicita_tiempo: 'Cliente solicita tiempo', comprobante_enviado: 'Comprobante enviado',
  edo_cuenta_enviado: 'Edo. cuenta enviado', escalado: 'Escalado', resuelto: 'Resuelto', no_procedio: 'No procedió',
};

export interface CaseFollowUp {
  id: string;
  caseId: string;
  date: string;
  executive: string;
  type: FollowUpType;
  title: string;
  detail: string;
  result: FollowUpResult;
  nextAction?: string;
  nextDate?: string;
  reminderActive?: boolean;
}

export interface CaseReminder {
  id: string;
  caseId: string;
  date: string;
  time: string;
  description: string;
  executive: string;
  priority: 'alta' | 'media' | 'baja';
  completed: boolean;
}

export interface CustomerCase {
  id: string;
  accountId: string;
  clientName: string;
  projectName: string;
  unitNumber: string;
  type: CaseType;
  channel: CaseChannel;
  priority: 'alta' | 'media' | 'baja' | 'critica';
  status: CaseStatus;
  assignee: string;
  openDate: string;
  sla: string;
  lastMessage: string;
  suggestedAction: string;
  messages: { date: string; from: string; content: string; channel: CaseChannel }[];
  // CRM fields
  nextAction: string;
  nextFollowUpDate: string;
  nextFollowUpTime?: string;
  followUpType?: FollowUpType;
  lastMovementDate: string;
  reminderDate?: string;
  reminderTime?: string;
  hasReminder: boolean;
  blockedByClient: boolean;
  waitDeadline?: string;
  escalationReason?: string;
  escalationTarget?: string;
}

export { mockTemplates, templateSuggestionByCase } from '@/data/mockData';

const a = mockAccounts;

// CRM defaults helper
const crmDefaults: Record<string, Partial<CustomerCase>> = {
  'CASE-001': { nextAction: 'Enviar comprobante de febrero', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '10:00', followUpType: 'comprobante', lastMovementDate: '2026-03-28', hasReminder: true, reminderDate: '2026-03-29', reminderTime: '09:30', blockedByClient: false },
  'CASE-002': { nextAction: 'Verificar pago con tesorería', nextFollowUpDate: '2026-03-28', nextFollowUpTime: '11:00', followUpType: 'revision_interna', lastMovementDate: '2026-03-27', hasReminder: true, reminderDate: '2026-03-28', reminderTime: '10:30', blockedByClient: false },
  'CASE-003': { nextAction: 'Crear propuesta de regularización', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '09:00', followUpType: 'llamada', lastMovementDate: '2026-03-26', hasReminder: true, reminderDate: '2026-03-29', reminderTime: '08:30', blockedByClient: false },
  'CASE-004': { nextAction: '', nextFollowUpDate: '2026-03-25', lastMovementDate: '2026-03-25', hasReminder: false, blockedByClient: false },
  'CASE-005': { nextAction: 'Revisar propuesta de rescate con supervisor', nextFollowUpDate: '2026-03-28', nextFollowUpTime: '14:00', followUpType: 'escalamiento', lastMovementDate: '2026-03-25', hasReminder: true, reminderDate: '2026-03-28', reminderTime: '13:30', blockedByClient: false, escalationReason: 'Cliente con 3+ parcialidades vencidas solicita rescate', escalationTarget: 'Supervisor de cobranza' },
  'CASE-006': { nextAction: '', nextFollowUpDate: '2026-03-15', lastMovementDate: '2026-03-15', hasReminder: false, blockedByClient: false },
  'CASE-007': { nextAction: 'Generar factura Q1 2026', nextFollowUpDate: '2026-03-30', nextFollowUpTime: '10:00', followUpType: 'documento', lastMovementDate: '2026-03-28', hasReminder: false, blockedByClient: false },
  'CASE-008': { nextAction: 'Enviar información de crédito hipotecario', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '11:00', followUpType: 'email', lastMovementDate: '2026-03-27', hasReminder: true, reminderDate: '2026-03-29', reminderTime: '10:00', blockedByClient: false },
  'CASE-009': { nextAction: 'Aclarar diferencia de monto con tesorería', nextFollowUpDate: '2026-03-28', nextFollowUpTime: '15:00', followUpType: 'revision_interna', lastMovementDate: '2026-03-26', hasReminder: false, blockedByClient: false },
  'CASE-010': { nextAction: '', nextFollowUpDate: '2026-03-22', lastMovementDate: '2026-03-22', hasReminder: false, blockedByClient: false },
  'CASE-011': { nextAction: 'Enviar desglose detallado de saldo', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '09:00', followUpType: 'estado_cuenta', lastMovementDate: '2026-03-28', hasReminder: true, reminderDate: '2026-03-29', reminderTime: '08:30', blockedByClient: false },
  'CASE-012': { nextAction: 'Coordinar con área de entregas', nextFollowUpDate: '2026-03-28', nextFollowUpTime: '16:00', followUpType: 'revision_interna', lastMovementDate: '2026-03-26', hasReminder: false, blockedByClient: false },
  'CASE-013': { nextAction: 'Solicitar comprobante de domicilio actualizado', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '10:00', followUpType: 'documento', lastMovementDate: '2026-03-27', hasReminder: false, blockedByClient: false },
  'CASE-014': { nextAction: '', nextFollowUpDate: '2026-03-20', lastMovementDate: '2026-03-20', hasReminder: false, blockedByClient: false },
  'CASE-015': { nextAction: 'Revisar cláusula contractual con jurídico', nextFollowUpDate: '2026-03-28', nextFollowUpTime: '11:00', followUpType: 'revision_legal', lastMovementDate: '2026-03-23', hasReminder: true, reminderDate: '2026-03-28', reminderTime: '10:00', blockedByClient: false, escalationReason: 'Revisión de cláusula contractual por penalidad', escalationTarget: 'Departamento Jurídico' },
  'CASE-016': { nextAction: 'Confirmar con tesorería y procesar devolución', nextFollowUpDate: '2026-03-28', nextFollowUpTime: '14:00', followUpType: 'revision_interna', lastMovementDate: '2026-03-25', hasReminder: true, reminderDate: '2026-03-28', reminderTime: '13:00', blockedByClient: false },
  'CASE-017': { nextAction: 'Registrar promesa de pago parcial', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '10:00', followUpType: 'seguimiento_promesa', lastMovementDate: '2026-03-28', hasReminder: false, blockedByClient: false },
  'CASE-018': { nextAction: 'Verificar pago STP del 20 de marzo', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '09:00', followUpType: 'revision_interna', lastMovementDate: '2026-03-28', hasReminder: true, reminderDate: '2026-03-29', reminderTime: '08:30', blockedByClient: false },
  'CASE-019': { nextAction: '', nextFollowUpDate: '2026-03-10', lastMovementDate: '2026-03-10', hasReminder: false, blockedByClient: false },
  'CASE-020': { nextAction: 'Reportar a soporte técnico', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '10:00', followUpType: 'revision_interna', lastMovementDate: '2026-03-28', hasReminder: false, blockedByClient: false },
  'CASE-021': { nextAction: '', nextFollowUpDate: '2026-03-18', lastMovementDate: '2026-03-18', hasReminder: false, blockedByClient: false },
  'CASE-022': { nextAction: 'Revisar movimientos y aclarar diferencia', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '10:00', followUpType: 'revision_interna', lastMovementDate: '2026-03-27', hasReminder: false, blockedByClient: false },
  'CASE-023': { nextAction: 'Evaluar propuesta de regularización', nextFollowUpDate: '2026-03-28', nextFollowUpTime: '15:00', followUpType: 'llamada', lastMovementDate: '2026-03-26', hasReminder: true, reminderDate: '2026-03-28', reminderTime: '14:30', blockedByClient: false },
  'CASE-024': { nextAction: 'Generar factura febrero-marzo', nextFollowUpDate: '2026-03-30', nextFollowUpTime: '10:00', followUpType: 'documento', lastMovementDate: '2026-03-28', hasReminder: false, blockedByClient: false },
  'CASE-025': { nextAction: 'Coordinar con área de obra', nextFollowUpDate: '2026-03-29', nextFollowUpTime: '11:00', followUpType: 'llamada', lastMovementDate: '2026-03-25', hasReminder: false, blockedByClient: false },
};

function enrichCase(base: Omit<CustomerCase, 'nextAction' | 'nextFollowUpDate' | 'lastMovementDate' | 'hasReminder' | 'blockedByClient'>): CustomerCase {
  const defaults = crmDefaults[base.id] || { nextAction: '', nextFollowUpDate: base.openDate, lastMovementDate: base.openDate, hasReminder: false, blockedByClient: false };
  return { ...base, nextAction: '', nextFollowUpDate: base.openDate, lastMovementDate: base.openDate, hasReminder: false, blockedByClient: false, ...defaults } as CustomerCase;
}

export const mockCases: CustomerCase[] = ([
  {
    id: 'CASE-001', accountId: a[0].id, clientName: a[0].client.name, projectName: 'Margot', unitNumber: a[0].unitNumber,
    type: 'solicitud_comprobante', channel: 'whatsapp', priority: 'media', status: 'abierto', assignee: 'Luz Ochoa', openDate: '2026-03-28',
    sla: '24 horas', lastMessage: 'Necesito el comprobante de mi pago de febrero', suggestedAction: 'Enviar comprobante',
    messages: [{ date: '2026-03-28 09:15', from: a[0].client.name, content: 'Hola, necesito el comprobante de mi pago de febrero', channel: 'whatsapp' }],
  },
  {
    id: 'CASE-002', accountId: a[5].id, clientName: a[5].client.name, projectName: 'Bottura', unitNumber: a[5].unitNumber,
    type: 'pago_no_reflejado', channel: 'whatsapp', priority: 'alta', status: 'en_atencion', assignee: 'Tomás Peterson', openDate: '2026-03-27',
    sla: '48 horas', lastMessage: 'Hice la transferencia el lunes y no aparece en mi estado de cuenta', suggestedAction: 'Verificar con tesorería',
    messages: [
      { date: '2026-03-27 14:00', from: a[5].client.name, content: 'Hice la transferencia el lunes y no aparece en mi estado de cuenta', channel: 'whatsapp' },
      { date: '2026-03-27 14:30', from: 'Tomás Peterson', content: 'Buen día, ¿nos podría compartir su comprobante de pago para verificar?', channel: 'whatsapp' },
      { date: '2026-03-27 15:10', from: a[5].client.name, content: 'Aquí le envío la captura de la transferencia', channel: 'whatsapp' },
    ],
  },
  {
    id: 'CASE-003', accountId: a[18].id, clientName: a[18].client.name, projectName: 'Daiku', unitNumber: a[18].unitNumber,
    type: 'renegociacion', channel: 'llamada', priority: 'alta', status: 'en_atencion', assignee: 'Luz Ochoa', openDate: '2026-03-26',
    sla: '72 horas', lastMessage: 'Cliente solicita reestructura de pagos por situación financiera', suggestedAction: 'Crear propuesta de regularización',
    messages: [
      { date: '2026-03-26 10:00', from: 'Luz Ochoa', content: 'Se contactó al cliente. Indica dificultad para cubrir las 3 parcialidades vencidas.', channel: 'llamada' },
      { date: '2026-03-26 11:00', from: 'Luz Ochoa', content: 'Nota interna: Cliente dispuesto a pagar 50% inmediato y el resto en 2 meses.', channel: 'interno' },
    ],
  },
  {
    id: 'CASE-004', accountId: a[2].id, clientName: a[2].client.name, projectName: 'Daiku', unitNumber: a[2].unitNumber,
    type: 'solicitud_edo_cuenta', channel: 'email', priority: 'baja', status: 'resuelto', assignee: 'Tomás Peterson', openDate: '2026-03-25',
    sla: '24 horas', lastMessage: 'Estado de cuenta enviado exitosamente', suggestedAction: 'Cerrado',
    messages: [
      { date: '2026-03-25 08:00', from: a[2].client.name, content: '¿Me pueden enviar mi estado de cuenta actualizado?', channel: 'email' },
      { date: '2026-03-25 09:30', from: 'Tomás Peterson', content: 'Se envió estado de cuenta al correo del cliente.', channel: 'email' },
    ],
  },
  {
    id: 'CASE-005', accountId: a[43].id, clientName: a[43].client.name, projectName: 'Monócolo', unitNumber: a[43].unitNumber,
    type: 'penalizacion', channel: 'llamada', priority: 'alta', status: 'escalado', assignee: 'Luz Ochoa', openDate: '2026-03-24',
    sla: '24 horas', lastMessage: 'Cliente con 3+ parcialidades vencidas solicita rescate', suggestedAction: 'Escalar a supervisor',
    messages: [
      { date: '2026-03-24 16:00', from: 'Luz Ochoa', content: 'Cliente contacta preocupado por penalización. Tiene 3 parcialidades vencidas y quiere regularizarse.', channel: 'llamada' },
      { date: '2026-03-25 09:00', from: 'Luz Ochoa', content: 'Nota interna: Se escaló caso a supervisor para evaluar propuesta de rescate.', channel: 'interno' },
    ],
  },
  {
    id: 'CASE-006', accountId: a[8].id, clientName: a[8].client.name, projectName: 'Margot', unitNumber: a[8].unitNumber,
    type: 'duda_entrega', channel: 'whatsapp', priority: 'baja', status: 'archivado', assignee: 'Tomás Peterson', openDate: '2026-03-15',
    sla: '48 horas', lastMessage: '¿Ya tienen fecha estimada de entrega de mi depa?', suggestedAction: 'Información enviada',
    messages: [
      { date: '2026-03-15 11:00', from: a[8].client.name, content: '¿Ya tienen fecha estimada de entrega de mi depa?', channel: 'whatsapp' },
      { date: '2026-03-15 12:00', from: 'Tomás Peterson', content: 'Se le compartió la fecha estimada según el avance de obra.', channel: 'whatsapp' },
    ],
  },
  {
    id: 'CASE-007', accountId: a[3].id, clientName: a[3].client.name, projectName: 'Bottura', unitNumber: a[3].unitNumber,
    type: 'solicitud_factura', channel: 'email', priority: 'baja', status: 'abierto', assignee: 'Luz Ochoa', openDate: '2026-03-28',
    sla: '48 horas', lastMessage: 'Solicito factura de mis pagos del primer trimestre', suggestedAction: 'Generar factura',
    messages: [{ date: '2026-03-28 10:00', from: a[3].client.name, content: 'Solicito factura de mis pagos del primer trimestre 2026', channel: 'email' }],
  },
  {
    id: 'CASE-008', accountId: a[14].id, clientName: a[14].client.name, projectName: 'Daiku', unitNumber: a[14].unitNumber,
    type: 'credito_hipotecario', channel: 'llamada', priority: 'media', status: 'en_atencion', assignee: 'Tomás Peterson', openDate: '2026-03-27',
    sla: '72 horas', lastMessage: 'Cliente pregunta sobre proceso de crédito hipotecario', suggestedAction: 'Enviar información de crédito',
    messages: [{ date: '2026-03-27 09:00', from: a[14].client.name, content: '¿Cuál es el proceso para tramitar el crédito hipotecario?', channel: 'llamada' }],
  },
  {
    id: 'CASE-009', accountId: a[10].id, clientName: a[10].client.name, projectName: 'Daiku', unitNumber: a[10].unitNumber,
    type: 'aclaracion_pagos', channel: 'email', priority: 'media', status: 'en_atencion', assignee: 'Luz Ochoa', openDate: '2026-03-26',
    sla: '48 horas', lastMessage: 'El monto de mi estado de cuenta no coincide con lo que calculé', suggestedAction: 'Revisar estado de cuenta y aclarar',
    messages: [
      { date: '2026-03-26 08:30', from: a[10].client.name, content: 'El monto de mi estado de cuenta no coincide con lo que calculé. ¿Podrían revisarlo?', channel: 'email' },
      { date: '2026-03-26 10:00', from: 'Luz Ochoa', content: 'Revisando con tesorería para aclarar diferencia.', channel: 'interno' },
    ],
  },
  {
    id: 'CASE-010', accountId: a[20].id, clientName: a[20].client.name, projectName: 'Margot', unitNumber: a[20].unitNumber,
    type: 'problemas_plataforma', channel: 'whatsapp', priority: 'baja', status: 'resuelto', assignee: 'Tomás Peterson', openDate: '2026-03-22',
    sla: '24 horas', lastMessage: 'No puedo entrar a la plataforma para ver mi saldo', suggestedAction: 'Cerrado',
    messages: [
      { date: '2026-03-22 07:45', from: a[20].client.name, content: 'No puedo entrar a la plataforma para ver mi saldo. Me da error.', channel: 'whatsapp' },
      { date: '2026-03-22 08:20', from: 'Tomás Peterson', content: 'Se reseteó contraseña y se envió acceso nuevo.', channel: 'whatsapp' },
    ],
  },
  {
    id: 'CASE-011', accountId: a[25].id, clientName: a[25].client.name, projectName: 'Bottura', unitNumber: a[25].unitNumber,
    type: 'aclaracion_saldo', channel: 'llamada', priority: 'media', status: 'abierto', assignee: 'Luz Ochoa', openDate: '2026-03-28',
    sla: '48 horas', lastMessage: 'No entiendo el desglose del saldo pendiente', suggestedAction: 'Enviar desglose detallado',
    messages: [{ date: '2026-03-28 11:30', from: a[25].client.name, content: 'No entiendo el desglose del saldo pendiente. ¿Me lo pueden explicar?', channel: 'llamada' }],
  },
  {
    id: 'CASE-012', accountId: a[30].id, clientName: a[30].client.name, projectName: 'Daiku', unitNumber: a[30].unitNumber,
    type: 'entrega_escrituracion', channel: 'email', priority: 'media', status: 'en_atencion', assignee: 'Tomás Peterson', openDate: '2026-03-26',
    sla: '72 horas', lastMessage: '¿Cuándo me entregan mi departamento?', suggestedAction: 'Coordinar con área de entregas',
    messages: [{ date: '2026-03-26 14:00', from: a[30].client.name, content: '¿Cuándo será la entrega de mi departamento? Ya pasó la fecha estimada.', channel: 'email' }],
  },
  {
    id: 'CASE-013', accountId: a[35].id, clientName: a[35].client.name, projectName: 'Monócolo', unitNumber: a[35].unitNumber,
    type: 'actualizacion_documental', channel: 'email', priority: 'baja', status: 'abierto', assignee: 'Luz Ochoa', openDate: '2026-03-27',
    sla: '48 horas', lastMessage: 'Necesito actualizar mi comprobante de domicilio', suggestedAction: 'Solicitar documento actualizado',
    messages: [{ date: '2026-03-27 16:00', from: a[35].client.name, content: 'Cambié de domicilio, necesito actualizar mi comprobante', channel: 'email' }],
  },
  {
    id: 'CASE-014', accountId: a[40].id, clientName: a[40].client.name, projectName: 'Margot', unitNumber: a[40].unitNumber,
    type: 'solicitud_contrato', channel: 'email', priority: 'baja', status: 'resuelto', assignee: 'Tomás Peterson', openDate: '2026-03-20',
    sla: '48 horas', lastMessage: 'Necesito copia de mi contrato firmado', suggestedAction: 'Cerrado',
    messages: [
      { date: '2026-03-20 09:00', from: a[40].client.name, content: 'Necesito una copia digital de mi contrato firmado', channel: 'email' },
      { date: '2026-03-20 14:00', from: 'Tomás Peterson', content: 'Se envió copia escaneada del contrato al correo.', channel: 'email' },
    ],
  },
  {
    id: 'CASE-015', accountId: a[45].id, clientName: a[45].client.name, projectName: 'Bottura', unitNumber: a[45].unitNumber,
    type: 'penalidad_entrega_tardia', channel: 'email', priority: 'alta', status: 'escalado', assignee: 'Luz Ochoa', openDate: '2026-03-23',
    sla: '24 horas', lastMessage: 'Exijo la penalidad por retraso en la entrega', suggestedAction: 'Escalar a legal',
    messages: [
      { date: '2026-03-23 08:00', from: a[45].client.name, content: 'Según mi contrato, tienen penalidad por entrega tardía. Exijo que se aplique.', channel: 'email' },
      { date: '2026-03-23 10:00', from: 'Luz Ochoa', content: 'Nota interna: Se escaló a jurídico para revisar cláusula contractual.', channel: 'interno' },
    ],
  },
  {
    id: 'CASE-016', accountId: a[50].id, clientName: a[50].client.name, projectName: 'Daiku', unitNumber: a[50].unitNumber,
    type: 'devolucion_pago', channel: 'email', priority: 'alta', status: 'en_atencion', assignee: 'Tomás Peterson', openDate: '2026-03-25',
    sla: '72 horas', lastMessage: 'Me cobraron doble, necesito la devolución', suggestedAction: 'Verificar con tesorería y procesar devolución',
    messages: [
      { date: '2026-03-25 11:00', from: a[50].client.name, content: 'Revisé mi estado de cuenta y aparecen dos cargos del mismo monto. Me cobraron doble.', channel: 'email' },
      { date: '2026-03-25 14:00', from: 'Tomás Peterson', content: 'Verificando con tesorería. Le confirmo a la brevedad.', channel: 'email' },
    ],
  },
  {
    id: 'CASE-017', accountId: a[55].id, clientName: a[55].client.name, projectName: 'Monócolo', unitNumber: a[55].unitNumber,
    type: 'renegociacion', channel: 'llamada', priority: 'media', status: 'abierto', assignee: 'Luz Ochoa', openDate: '2026-03-28',
    sla: '72 horas', lastMessage: 'No podré cubrir el pago completo este mes', suggestedAction: 'Registrar promesa parcial',
    messages: [{ date: '2026-03-28 15:00', from: a[55].client.name, content: 'No podré cubrir el pago completo este mes. ¿Puedo pagar la mitad ahora y el resto la próxima quincena?', channel: 'llamada' }],
  },
  {
    id: 'CASE-018', accountId: a[60].id, clientName: a[60].client.name, projectName: 'Margot', unitNumber: a[60].unitNumber,
    type: 'pago_no_reflejado', channel: 'whatsapp', priority: 'alta', status: 'abierto', assignee: 'Tomás Peterson', openDate: '2026-03-28',
    sla: '48 horas', lastMessage: 'No veo reflejado mi pago de marzo', suggestedAction: 'Verificar con tesorería',
    messages: [{ date: '2026-03-28 12:00', from: a[60].client.name, content: 'No veo reflejado mi pago de marzo. Pagué por STP el día 20.', channel: 'whatsapp' }],
  },
  {
    id: 'CASE-019', accountId: a[70].id, clientName: a[70].client.name, projectName: 'Daiku', unitNumber: a[70].unitNumber,
    type: 'solicitud_comprobante', channel: 'email', priority: 'baja', status: 'archivado', assignee: 'Luz Ochoa', openDate: '2026-03-10',
    sla: '24 horas', lastMessage: 'Comprobante enviado', suggestedAction: 'Archivado',
    messages: [
      { date: '2026-03-10 08:00', from: a[70].client.name, content: 'Necesito mi comprobante de pago de enero', channel: 'email' },
      { date: '2026-03-10 10:00', from: 'Luz Ochoa', content: 'Se envió comprobante por correo.', channel: 'email' },
    ],
  },
  {
    id: 'CASE-020', accountId: a[75].id, clientName: a[75].client.name, projectName: 'Monócolo', unitNumber: a[75].unitNumber,
    type: 'problemas_plataforma', channel: 'whatsapp', priority: 'baja', status: 'abierto', assignee: 'Tomás Peterson', openDate: '2026-03-28',
    sla: '24 horas', lastMessage: 'La plataforma no me deja descargar mi estado de cuenta', suggestedAction: 'Reportar a soporte técnico',
    messages: [{ date: '2026-03-28 08:30', from: a[75].client.name, content: 'La plataforma no me deja descargar mi estado de cuenta. Sale error.', channel: 'whatsapp' }],
  },
  {
    id: 'CASE-021', accountId: a[80].id, clientName: a[80].client.name, projectName: 'Margot', unitNumber: a[80].unitNumber,
    type: 'solicitud_edo_cuenta', channel: 'email', priority: 'baja', status: 'resuelto', assignee: 'Luz Ochoa', openDate: '2026-03-18',
    sla: '24 horas', lastMessage: 'Estado de cuenta enviado', suggestedAction: 'Cerrado',
    messages: [
      { date: '2026-03-18 09:00', from: a[80].client.name, content: '¿Me pueden compartir mi estado de cuenta actualizado?', channel: 'email' },
      { date: '2026-03-18 11:00', from: 'Luz Ochoa', content: 'Se envió estado de cuenta por correo.', channel: 'email' },
    ],
  },
  {
    id: 'CASE-022', accountId: a[85].id, clientName: a[85].client.name, projectName: 'Bottura', unitNumber: a[85].unitNumber,
    type: 'aclaracion_pagos', channel: 'llamada', priority: 'media', status: 'en_atencion', assignee: 'Tomás Peterson', openDate: '2026-03-27',
    sla: '48 horas', lastMessage: 'No me cuadra el monto que me aparece como saldo', suggestedAction: 'Revisar movimientos y aclarar',
    messages: [{ date: '2026-03-27 10:00', from: a[85].client.name, content: 'No me cuadra el monto que me aparece como saldo. ¿Pueden revisarlo?', channel: 'llamada' }],
  },
  {
    id: 'CASE-023', accountId: a[90].id, clientName: a[90].client.name, projectName: 'Daiku', unitNumber: a[90].unitNumber,
    type: 'penalizacion', channel: 'llamada', priority: 'alta', status: 'en_atencion', assignee: 'Luz Ochoa', openDate: '2026-03-26',
    sla: '24 horas', lastMessage: 'Quiero saber qué opciones tengo para regularizarme', suggestedAction: 'Evaluar propuesta de regularización',
    messages: [
      { date: '2026-03-26 16:00', from: a[90].client.name, content: 'Sé que tengo parcialidades vencidas. Quiero saber qué opciones tengo para regularizarme.', channel: 'llamada' },
    ],
  },
  {
    id: 'CASE-024', accountId: a[95].id, clientName: a[95].client.name, projectName: 'Monócolo', unitNumber: a[95].unitNumber,
    type: 'solicitud_factura', channel: 'email', priority: 'baja', status: 'abierto', assignee: 'Tomás Peterson', openDate: '2026-03-28',
    sla: '48 horas', lastMessage: 'Solicito factura por mis pagos de febrero y marzo', suggestedAction: 'Generar factura',
    messages: [{ date: '2026-03-28 09:00', from: a[95].client.name, content: 'Solicito factura por mis pagos de febrero y marzo 2026', channel: 'email' }],
  },
  {
    id: 'CASE-025', accountId: a[65].id, clientName: a[65].client.name, projectName: 'Bottura', unitNumber: a[65].unitNumber,
    type: 'entrega_escrituracion', channel: 'llamada', priority: 'media', status: 'en_atencion', assignee: 'Luz Ochoa', openDate: '2026-03-25',
    sla: '72 horas', lastMessage: '¿Cuándo será la entrega? Ya quiero programar mi mudanza', suggestedAction: 'Coordinar con obra',
    messages: [{ date: '2026-03-25 14:00', from: a[65].client.name, content: '¿Cuándo será la entrega de mi departamento? Ya quiero programar mi mudanza.', channel: 'llamada' }],
  },
] as any[]).map(enrichCase);

// Mock follow-ups
export const mockFollowUps: CaseFollowUp[] = [
  { id: 'FU-001', caseId: 'CASE-002', date: '2026-03-27T14:30:00', executive: 'Tomás Peterson', type: 'whatsapp', title: 'Solicitud de comprobante', detail: 'Se pidió al cliente que comparta su comprobante de transferencia para verificar.', result: 'contactado', nextAction: 'Verificar con tesorería', nextDate: '2026-03-28' },
  { id: 'FU-002', caseId: 'CASE-003', date: '2026-03-26T10:00:00', executive: 'Luz Ochoa', type: 'llamada', title: 'Contacto inicial por reestructura', detail: 'Se contactó al cliente. Indica dificultad para cubrir 3 parcialidades vencidas. Dispuesto a pagar 50% inmediato.', result: 'contactado', nextAction: 'Crear propuesta de regularización', nextDate: '2026-03-29' },
  { id: 'FU-003', caseId: 'CASE-005', date: '2026-03-25T09:00:00', executive: 'Luz Ochoa', type: 'escalamiento', title: 'Escalado a supervisor', detail: 'Se escaló caso a supervisor para evaluar propuesta de rescate por penalización.', result: 'escalado', nextAction: 'Revisar propuesta de rescate', nextDate: '2026-03-28' },
  { id: 'FU-004', caseId: 'CASE-009', date: '2026-03-26T10:00:00', executive: 'Luz Ochoa', type: 'revision_interna', title: 'Revisión con tesorería', detail: 'Se está revisando con tesorería la diferencia de monto reportada por el cliente.', result: 'reprogramado', nextAction: 'Aclarar diferencia', nextDate: '2026-03-28' },
  { id: 'FU-005', caseId: 'CASE-016', date: '2026-03-25T14:00:00', executive: 'Tomás Peterson', type: 'email', title: 'Respuesta al cliente sobre cobro doble', detail: 'Se informó al cliente que se está verificando con tesorería.', result: 'contactado', nextAction: 'Confirmar devolución', nextDate: '2026-03-28' },
  { id: 'FU-006', caseId: 'CASE-023', date: '2026-03-26T16:00:00', executive: 'Luz Ochoa', type: 'llamada', title: 'Contacto con cliente en penalización', detail: 'Cliente indica interés en regularizarse. Se evaluarán opciones.', result: 'contactado', nextAction: 'Evaluar propuesta de regularización', nextDate: '2026-03-28' },
  { id: 'FU-007', caseId: 'CASE-001', date: '2026-03-28T09:20:00', executive: 'Luz Ochoa', type: 'whatsapp', title: 'Recepción de solicitud de comprobante', detail: 'Se recibió solicitud del cliente por WhatsApp. Se buscará comprobante en sistema.', result: 'contactado', nextAction: 'Enviar comprobante de febrero', nextDate: '2026-03-29' },
];

export const mockReminders: CaseReminder[] = [
  { id: 'REM-001', caseId: 'CASE-001', date: '2026-03-29', time: '09:30', description: 'Enviar comprobante de febrero al cliente', executive: 'Luz Ochoa', priority: 'media', completed: false },
  { id: 'REM-002', caseId: 'CASE-002', date: '2026-03-28', time: '10:30', description: 'Verificar pago con tesorería', executive: 'Tomás Peterson', priority: 'alta', completed: false },
  { id: 'REM-003', caseId: 'CASE-003', date: '2026-03-29', time: '08:30', description: 'Preparar propuesta de regularización', executive: 'Luz Ochoa', priority: 'alta', completed: false },
  { id: 'REM-004', caseId: 'CASE-005', date: '2026-03-28', time: '13:30', description: 'Seguimiento de propuesta de rescate con supervisor', executive: 'Luz Ochoa', priority: 'alta', completed: false },
  { id: 'REM-005', caseId: 'CASE-008', date: '2026-03-29', time: '10:00', description: 'Enviar información de crédito hipotecario', executive: 'Tomás Peterson', priority: 'media', completed: false },
  { id: 'REM-006', caseId: 'CASE-011', date: '2026-03-29', time: '08:30', description: 'Enviar desglose detallado de saldo', executive: 'Luz Ochoa', priority: 'media', completed: false },
  { id: 'REM-007', caseId: 'CASE-016', date: '2026-03-28', time: '13:00', description: 'Confirmar devolución con tesorería', executive: 'Tomás Peterson', priority: 'alta', completed: false },
  { id: 'REM-008', caseId: 'CASE-018', date: '2026-03-29', time: '08:30', description: 'Verificar pago STP con tesorería', executive: 'Tomás Peterson', priority: 'alta', completed: false },
  { id: 'REM-009', caseId: 'CASE-023', date: '2026-03-28', time: '14:30', description: 'Evaluar propuesta de regularización para cliente', executive: 'Luz Ochoa', priority: 'alta', completed: false },
  { id: 'REM-010', caseId: 'CASE-015', date: '2026-03-28', time: '10:00', description: 'Seguimiento con jurídico sobre cláusula contractual', executive: 'Luz Ochoa', priority: 'alta', completed: false },
];

// ── Payment Relation (Relación de Pagos) ────────────────────────
export type PaymentOrigin = 'STP' | 'Efectivo' | 'Cheque' | 'Transferencia' | 'STP manual';
export type PaymentEvidenceType = 'cep_validado' | 'comprobante_simple' | 'pago_directo_desarrolladora' | 'sin_evidencia' | 'en_investigacion';
export type ReconciliationStatus = 'conciliado' | 'pendiente_cep' | 'pendiente_comprobante' | 'en_revision' | 'excepcion' | 'no_identificado' | 'pago_directo' | 'cien_conciliado';

export interface PaymentRecord {
  id: string;
  date: string;
  clientName: string;
  accountId: string;
  projectName: string;
  unitNumber: string;
  amount: number;
  reference: string;
  origin: PaymentOrigin;
  via: string;
  hasCEP: boolean;
  hasComprobante: boolean;
  reconciliationStatus: ReconciliationStatus;
  evidenceType: PaymentEvidenceType;
  observations: string;
}

export const reconciliationStatusLabels: Record<ReconciliationStatus, string> = {
  conciliado: 'Conciliado',
  pendiente_cep: 'Pendiente CEP',
  pendiente_comprobante: 'Pendiente comprobante',
  en_revision: 'En revisión',
  excepcion: 'Excepción',
  no_identificado: 'No identificado',
  pago_directo: 'Pago directo desarrolladora',
  cien_conciliado: '100% Conciliado',
};

export const mockPaymentRecords: PaymentRecord[] = [
  { id: 'PAY-001', date: '2026-03-28', clientName: a[0].client.name, accountId: a[0].id, projectName: 'Margot', unitNumber: a[0].unitNumber, amount: 79167, reference: 'REF-839201', origin: 'STP', via: 'SPEI', hasCEP: true, hasComprobante: true, reconciliationStatus: 'cien_conciliado', evidenceType: 'cep_validado', observations: '' },
  { id: 'PAY-002', date: '2026-03-27', clientName: a[2].client.name, accountId: a[2].id, projectName: 'Daiku', unitNumber: a[2].unitNumber, amount: 156250, reference: 'REF-482910', origin: 'Transferencia', via: 'Transferencia bancaria', hasCEP: false, hasComprobante: true, reconciliationStatus: 'pendiente_cep', evidenceType: 'comprobante_simple', observations: 'Falta descargar CEP de Banxico' },
  { id: 'PAY-003', date: '2026-03-27', clientName: a[5].client.name, accountId: a[5].id, projectName: 'Bottura', unitNumber: a[5].unitNumber, amount: 105556, reference: '', origin: 'Transferencia', via: 'Depósito a cuenta desarrolladora', hasCEP: false, hasComprobante: false, reconciliationStatus: 'no_identificado', evidenceType: 'sin_evidencia', observations: 'Pago reportado por cliente vía WhatsApp sin comprobante' },
  { id: 'PAY-004', date: '2026-03-26', clientName: a[3].client.name, accountId: a[3].id, projectName: 'Bottura', unitNumber: a[3].unitNumber, amount: 85000, reference: 'REF-301822', origin: 'STP', via: 'SPEI', hasCEP: true, hasComprobante: true, reconciliationStatus: 'conciliado', evidenceType: 'cep_validado', observations: '' },
  { id: 'PAY-005', date: '2026-03-25', clientName: a[7].client.name, accountId: a[7].id, projectName: 'Monócolo', unitNumber: a[7].unitNumber, amount: 10833, reference: 'REF-661002', origin: 'STP', via: 'SPEI', hasCEP: false, hasComprobante: true, reconciliationStatus: 'en_revision', evidenceType: 'comprobante_simple', observations: 'Posible pago duplicado, verificar contra estado de cuenta' },
  { id: 'PAY-006', date: '2026-03-24', clientName: a[10].client.name, accountId: a[10].id, projectName: 'Daiku', unitNumber: a[10].unitNumber, amount: 58333, reference: 'REF-110394', origin: 'Efectivo', via: 'Depósito en sucursal', hasCEP: false, hasComprobante: true, reconciliationStatus: 'pago_directo', evidenceType: 'pago_directo_desarrolladora', observations: 'Pago directo en cuenta de desarrolladora' },
  { id: 'PAY-007', date: '2026-03-23', clientName: a[14].client.name, accountId: a[14].id, projectName: 'Daiku', unitNumber: a[14].unitNumber, amount: 75000, reference: 'REF-882011', origin: 'STP', via: 'SPEI', hasCEP: true, hasComprobante: true, reconciliationStatus: 'cien_conciliado', evidenceType: 'cep_validado', observations: '' },
  { id: 'PAY-008', date: '2026-03-22', clientName: a[1].client.name, accountId: a[1].id, projectName: 'Bottura', unitNumber: a[1].unitNumber, amount: 72917, reference: 'REF-553218', origin: 'Transferencia', via: 'Transferencia bancaria', hasCEP: false, hasComprobante: false, reconciliationStatus: 'excepcion', evidenceType: 'en_investigacion', observations: 'Pago reportado pero no localizado en cuentas bancarias' },
  { id: 'PAY-009', date: '2026-03-20', clientName: a[12].client.name, accountId: a[12].id, projectName: 'Margot', unitNumber: a[12].unitNumber, amount: 116667, reference: 'REF-993021', origin: 'STP manual', via: 'SPEI manual', hasCEP: false, hasComprobante: true, reconciliationStatus: 'pago_directo', evidenceType: 'pago_directo_desarrolladora', observations: 'Pago directo a cuenta desarrolladora' },
  { id: 'PAY-010', date: '2026-03-19', clientName: a[20].client.name, accountId: a[20].id, projectName: 'Margot', unitNumber: a[20].unitNumber, amount: 88889, reference: 'REF-114002', origin: 'STP', via: 'SPEI', hasCEP: true, hasComprobante: true, reconciliationStatus: 'cien_conciliado', evidenceType: 'cep_validado', observations: '' },
  { id: 'PAY-011', date: '2026-03-18', clientName: a[25].client.name, accountId: a[25].id, projectName: 'Bottura', unitNumber: a[25].unitNumber, amount: 66667, reference: 'REF-220451', origin: 'Cheque', via: 'Cheque bancario', hasCEP: false, hasComprobante: true, reconciliationStatus: 'pendiente_cep', evidenceType: 'comprobante_simple', observations: 'Cheque recibido, pendiente validación' },
  { id: 'PAY-012', date: '2026-03-15', clientName: a[30].client.name, accountId: a[30].id, projectName: 'Daiku', unitNumber: a[30].unitNumber, amount: 95000, reference: 'REF-337890', origin: 'STP', via: 'SPEI', hasCEP: true, hasComprobante: true, reconciliationStatus: 'conciliado', evidenceType: 'cep_validado', observations: '' },
  { id: 'PAY-013', date: '2026-03-14', clientName: a[35].client.name, accountId: a[35].id, projectName: 'Monócolo', unitNumber: a[35].unitNumber, amount: 23333, reference: 'REF-448901', origin: 'Transferencia', via: 'Transferencia bancaria', hasCEP: false, hasComprobante: true, reconciliationStatus: 'pendiente_comprobante', evidenceType: 'comprobante_simple', observations: 'Comprobante borroso, se solicitó reenvío' },
  { id: 'PAY-014', date: '2026-03-12', clientName: a[40].client.name, accountId: a[40].id, projectName: 'Margot', unitNumber: a[40].unitNumber, amount: 79167, reference: 'REF-559012', origin: 'STP', via: 'SPEI', hasCEP: true, hasComprobante: true, reconciliationStatus: 'cien_conciliado', evidenceType: 'cep_validado', observations: '' },
  { id: 'PAY-015', date: '2026-03-10', clientName: a[50].client.name, accountId: a[50].id, projectName: 'Daiku', unitNumber: a[50].unitNumber, amount: 88889, reference: 'REF-660123', origin: 'STP manual', via: 'SPEI manual', hasCEP: true, hasComprobante: true, reconciliationStatus: 'conciliado', evidenceType: 'cep_validado', observations: '' },
  { id: 'PAY-016', date: '2026-03-08', clientName: a[55].client.name, accountId: a[55].id, projectName: 'Monócolo', unitNumber: a[55].unitNumber, amount: 42000, reference: '', origin: 'Efectivo', via: 'Depósito en sucursal', hasCEP: false, hasComprobante: true, reconciliationStatus: 'pago_directo', evidenceType: 'pago_directo_desarrolladora', observations: 'Depósito en efectivo, no aplica CEP' },
  { id: 'PAY-017', date: '2026-03-05', clientName: a[60].client.name, accountId: a[60].id, projectName: 'Margot', unitNumber: a[60].unitNumber, amount: 79167, reference: 'REF-771234', origin: 'STP', via: 'SPEI', hasCEP: true, hasComprobante: true, reconciliationStatus: 'cien_conciliado', evidenceType: 'cep_validado', observations: '' },
  { id: 'PAY-018', date: '2026-03-03', clientName: a[65].client.name, accountId: a[65].id, projectName: 'Bottura', unitNumber: a[65].unitNumber, amount: 88889, reference: 'REF-882345', origin: 'Transferencia', via: 'Transferencia bancaria', hasCEP: false, hasComprobante: true, reconciliationStatus: 'en_revision', evidenceType: 'comprobante_simple', observations: 'Monto no coincide con parcialidad, verificando' },
];

// ── CEP Records ─────────────────────────────────────────────────
export type CEPStatus = 'pendiente_busqueda' | 'en_investigacion' | 'validado' | 'no_aplica' | 'requiere_evidencia';

export const cepStatusLabels: Record<CEPStatus, string> = {
  pendiente_busqueda: 'Pendiente búsqueda',
  en_investigacion: 'En investigación',
  validado: 'Validado',
  no_aplica: 'No aplica',
  requiere_evidencia: 'Requiere evidencia adicional',
};

export interface CEPRecord {
  id: string;
  paymentId: string;
  paymentDate: string;
  clientName: string;
  accountId: string;
  projectName: string;
  amount: number;
  reference: string;
  origin: string;
  status: CEPStatus;
  assignee: string;
  observations: string;
  requiresBanxico: boolean;
  lastUpdated: string;
}

export const mockCEPRecords: CEPRecord[] = [
  { id: 'CEP-001', paymentId: 'PAY-002', paymentDate: '2026-03-27', clientName: a[2].client.name, accountId: a[2].id, projectName: 'Daiku', amount: 156250, reference: 'REF-482910', origin: 'Transferencia', status: 'pendiente_busqueda', assignee: 'Luz Ochoa', observations: 'Transferencia directa, requiere descarga de CEP', requiresBanxico: true, lastUpdated: '2026-03-28' },
  { id: 'CEP-002', paymentId: 'PAY-005', paymentDate: '2026-03-25', clientName: a[7].client.name, accountId: a[7].id, projectName: 'Monócolo', amount: 10833, reference: 'REF-661002', origin: 'STP', status: 'en_investigacion', assignee: 'Tomás Peterson', observations: 'Comprobante simple disponible, falta CEP formal', requiresBanxico: true, lastUpdated: '2026-03-27' },
  { id: 'CEP-003', paymentId: 'PAY-006', paymentDate: '2026-03-24', clientName: a[10].client.name, accountId: a[10].id, projectName: 'Daiku', amount: 58333, reference: 'REF-110394', origin: 'Efectivo', status: 'no_aplica', assignee: 'Luz Ochoa', observations: 'Pago directo en sucursal, no aplica CEP electrónico', requiresBanxico: false, lastUpdated: '2026-03-25' },
  { id: 'CEP-004', paymentId: 'PAY-008', paymentDate: '2026-03-22', clientName: a[1].client.name, accountId: a[1].id, projectName: 'Bottura', amount: 72917, reference: 'REF-553218', origin: 'Transferencia', status: 'en_investigacion', assignee: 'Tomás Peterson', observations: 'Pago no localizado, se requiere revisar con banco', requiresBanxico: true, lastUpdated: '2026-03-26' },
  { id: 'CEP-005', paymentId: 'PAY-011', paymentDate: '2026-03-18', clientName: a[25].client.name, accountId: a[25].id, projectName: 'Bottura', amount: 66667, reference: 'REF-220451', origin: 'Cheque', status: 'requiere_evidencia', assignee: 'Luz Ochoa', observations: 'Cheque recibido, se requiere evidencia de depósito para validar', requiresBanxico: false, lastUpdated: '2026-03-24' },
  { id: 'CEP-006', paymentId: 'PAY-013', paymentDate: '2026-03-14', clientName: a[35].client.name, accountId: a[35].id, projectName: 'Monócolo', amount: 23333, reference: 'REF-448901', origin: 'Transferencia', status: 'pendiente_busqueda', assignee: 'Tomás Peterson', observations: 'Comprobante borroso, necesario buscar CEP original', requiresBanxico: true, lastUpdated: '2026-03-22' },
  { id: 'CEP-007', paymentId: 'PAY-018', paymentDate: '2026-03-03', clientName: a[65].client.name, accountId: a[65].id, projectName: 'Bottura', amount: 88889, reference: 'REF-882345', origin: 'Transferencia', status: 'en_investigacion', assignee: 'Luz Ochoa', observations: 'Monto no coincide con parcialidad, investigando', requiresBanxico: true, lastUpdated: '2026-03-20' },
  { id: 'CEP-008', paymentId: 'HIST-001', paymentDate: '2025-12-15', clientName: a[4].client.name, accountId: a[4].id, projectName: 'Margot', amount: 29167, reference: 'REF-221004', origin: 'STP', status: 'validado', assignee: 'Tomás Peterson', observations: 'CEP descargado y validado', requiresBanxico: false, lastUpdated: '2026-03-10' },
  { id: 'CEP-009', paymentId: 'HIST-002', paymentDate: '2025-11-20', clientName: a[13].client.name, accountId: a[13].id, projectName: 'Bottura', amount: 23333, reference: 'REF-118293', origin: 'STP', status: 'validado', assignee: 'Luz Ochoa', observations: 'CEP validado correctamente', requiresBanxico: false, lastUpdated: '2026-02-28' },
  { id: 'CEP-010', paymentId: 'HIST-003', paymentDate: '2025-10-10', clientName: a[9].client.name, accountId: a[9].id, projectName: 'Bottura', amount: 77778, reference: '', origin: 'Transferencia', status: 'requiere_evidencia', assignee: 'Tomás Peterson', observations: 'Sin referencia bancaria, se requiere evidencia adicional del cliente', requiresBanxico: false, lastUpdated: '2026-03-05' },
  { id: 'CEP-011', paymentId: 'PAY-016', paymentDate: '2026-03-08', clientName: a[55].client.name, accountId: a[55].id, projectName: 'Monócolo', amount: 42000, reference: '', origin: 'Efectivo', status: 'no_aplica', assignee: 'Luz Ochoa', observations: 'Depósito en efectivo, no aplica CEP', requiresBanxico: false, lastUpdated: '2026-03-12' },
  { id: 'CEP-012', paymentId: 'PAY-009', paymentDate: '2026-03-20', clientName: a[12].client.name, accountId: a[12].id, projectName: 'Margot', amount: 116667, reference: 'REF-993021', origin: 'STP manual', status: 'pendiente_busqueda', assignee: 'Tomás Peterson', observations: 'STP manual, falta CEP formal de la operación', requiresBanxico: true, lastUpdated: '2026-03-25' },
];
