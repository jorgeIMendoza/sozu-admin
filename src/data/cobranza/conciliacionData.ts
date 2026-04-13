import { mockAccounts } from '@/data/mockData';
import { addBitacoraEntry } from '@/data/bitacoraData';
import type { IncidentType } from '@/types/cobranza';

// ── Conciliation Case Types ─────────────────────────────────────
export type ConciliacionCaseType =
  | 'pago_no_reflejado'
  | 'comprobante_pendiente'
  | 'cep_pendiente'
  | 'pago_duplicado'
  | 'aclaracion_saldo'
  | 'pago_mal_aplicado'
  | 'transferencia_no_identificada'
  | 'evidencia_incompleta'
  | 'revision_documental_pago'
  | 'otro';

export const conciliacionCaseTypeLabels: Record<ConciliacionCaseType, string> = {
  pago_no_reflejado: 'Pago no reflejado',
  comprobante_pendiente: 'Comprobante pendiente',
  cep_pendiente: 'CEP pendiente',
  pago_duplicado: 'Pago duplicado',
  aclaracion_saldo: 'Aclaración de saldo',
  pago_mal_aplicado: 'Pago aplicado incorrectamente',
  transferencia_no_identificada: 'Transferencia no identificada',
  evidencia_incompleta: 'Evidencia incompleta',
  revision_documental_pago: 'Revisión documental de pago',
  otro: 'Otro',
};

export type ConciliacionStatus = 'abierta' | 'en_revision' | 'esperando_cliente' | 'escalada' | 'resuelta' | 'archivada';

export const conciliacionStatusLabels: Record<ConciliacionStatus, string> = {
  abierta: 'Abierta',
  en_revision: 'En revisión',
  esperando_cliente: 'Esperando cliente',
  escalada: 'Escalada',
  resuelta: 'Resuelta',
  archivada: 'Archivada',
};

export const conciliacionStatusColors: Record<ConciliacionStatus, { bg: string; text: string }> = {
  abierta: { bg: 'bg-danger-bg', text: 'text-danger' },
  en_revision: { bg: 'bg-warning-bg', text: 'text-warning' },
  esperando_cliente: { bg: 'bg-info-bg', text: 'text-info' },
  escalada: { bg: 'bg-priority-purple/10', text: 'text-priority-purple' },
  resuelta: { bg: 'bg-success-bg', text: 'text-success' },
  archivada: { bg: 'bg-muted', text: 'text-muted-foreground' },
};

export type ConciliacionPriority = 'baja' | 'media' | 'alta' | 'critica';

export const priorityLabels: Record<ConciliacionPriority, string> = {
  baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica',
};

export const priorityColors: Record<ConciliacionPriority, { bg: string; text: string }> = {
  baja: { bg: 'bg-muted', text: 'text-muted-foreground' },
  media: { bg: 'bg-warning-bg', text: 'text-warning' },
  alta: { bg: 'bg-danger-bg', text: 'text-danger' },
  critica: { bg: 'bg-priority-purple/10', text: 'text-priority-purple' },
};

export type ConciliacionOrigin = 'cobranza' | 'cliente' | 'sistema' | 'legal' | 'conciliacion_interna' | 'relacion_pagos';

export const originLabels: Record<ConciliacionOrigin, string> = {
  cobranza: 'Cobranza', cliente: 'Cliente', sistema: 'Sistema', legal: 'Legal',
  conciliacion_interna: 'Conciliación interna', relacion_pagos: 'Relación de pagos',
};

export type ArchiveReason = 'duplicado' | 'improcedente' | 'resuelto_fuera_flujo' | 'error_captura' | 'consolidado' | 'cancelado_cliente' | 'otro';

export const archiveReasonLabels: Record<ArchiveReason, string> = {
  duplicado: 'Duplicado',
  improcedente: 'Improcedente',
  resuelto_fuera_flujo: 'Resuelto fuera del flujo',
  error_captura: 'Error de captura',
  consolidado: 'Consolidado en otro caso',
  cancelado_cliente: 'Cancelado por cliente',
  otro: 'Otro',
};

export interface ConciliacionCase {
  id: string;
  accountId: string;
  clientName: string;
  projectName: string;
  unitNumber: string;
  accountNumber: string;
  entidadLegal: string;
  tipoCobro: string;
  // Case data
  caseType: ConciliacionCaseType;
  title: string;
  description: string;
  priority: ConciliacionPriority;
  status: ConciliacionStatus;
  assignee: string;
  openDate: string;
  sla: string;
  origin: ConciliacionOrigin;
  relatedAmount?: number;
  reference?: string;
  // Impact
  markPendingConciliation: boolean;
  adjustBandejaPriority: boolean;
  forceVisibility: boolean;
  blockProcess: boolean;
  requiresSpecialFollowUp: boolean;
  // Tracking
  lastMovementDate: string;
  nextAction?: string;
  archiveReason?: ArchiveReason;
  archiveComment?: string;
  comments: string[];
  history: ConciliacionHistoryEntry[];
}

export interface ConciliacionHistoryEntry {
  id: string;
  date: string;
  user: string;
  action: string;
  detail: string;
  previousValue?: string;
  newValue?: string;
}

// ── Mock Data ────────────────────────────────────────────────────
const a = mockAccounts;

export const mockConciliaciones: ConciliacionCase[] = [
  {
    id: 'CONC-001', accountId: a[4].id, clientName: a[4].client.name, projectName: a[4].project.name,
    unitNumber: a[4].unitNumber, accountNumber: a[4].accountNumber, entidadLegal: a[4].legalEntity.name,
    tipoCobro: a[4].chargeType,
    caseType: 'pago_no_reflejado', title: 'Transferencia STP del 20 de marzo no reflejada',
    description: 'Cliente reporta haber realizado transferencia por STP el 20 de marzo por $45,800 MXN. El pago no aparece en el estado de cuenta del sistema. Se solicitó comprobante CEP.',
    priority: 'alta', status: 'en_revision', assignee: 'Luz Ochoa', openDate: '2026-03-25',
    sla: '48h', origin: 'cliente', relatedAmount: 45800, reference: 'STP-20260320-4582',
    markPendingConciliation: true, adjustBandejaPriority: true, forceVisibility: false, blockProcess: false, requiresSpecialFollowUp: false,
    lastMovementDate: '2026-03-28', nextAction: 'Verificar con tesorería la recepción STP',
    comments: ['Cliente reporta transferencia del 20 de marzo', 'Se solicitó comprobante CEP'],
    history: [
      { id: 'h1', date: '2026-03-25T09:00:00', user: 'Luz Ochoa', action: 'Caso creado', detail: 'Se abre caso por reporte del cliente sobre pago no reflejado.' },
      { id: 'h2', date: '2026-03-26T10:30:00', user: 'Luz Ochoa', action: 'Solicitud de comprobante', detail: 'Se solicitó CEP al cliente por WhatsApp.' },
      { id: 'h3', date: '2026-03-28T11:00:00', user: 'Luz Ochoa', action: 'Cambio de estatus', detail: 'Estatus cambiado a En revisión tras recibir CEP del cliente.', previousValue: 'Abierta', newValue: 'En revisión' },
    ],
  },
  {
    id: 'CONC-002', accountId: a[12].id, clientName: a[12].client.name, projectName: a[12].project.name,
    unitNumber: a[12].unitNumber, accountNumber: a[12].accountNumber, entidadLegal: a[12].legalEntity.name,
    tipoCobro: a[12].chargeType,
    caseType: 'comprobante_pendiente', title: 'Comprobante de pago parcialidad 6 pendiente',
    description: 'Pago registrado en sistema pero sin comprobante adjunto. Se requiere evidencia para conciliar.',
    priority: 'media', status: 'esperando_cliente', assignee: 'Tomás Peterson', openDate: '2026-03-23',
    sla: '72h', origin: 'cobranza', relatedAmount: 38500,
    markPendingConciliation: true, adjustBandejaPriority: false, forceVisibility: false, blockProcess: false, requiresSpecialFollowUp: false,
    lastMovementDate: '2026-03-27', nextAction: 'Esperar respuesta del cliente con comprobante',
    comments: ['Pago reportado sin comprobante adjunto', 'Se envió recordatorio por email'],
    history: [
      { id: 'h1', date: '2026-03-23T14:00:00', user: 'Tomás Peterson', action: 'Caso creado', detail: 'Se detectó pago sin comprobante en revisión de parcialidades.' },
      { id: 'h2', date: '2026-03-25T09:00:00', user: 'Tomás Peterson', action: 'Envío de solicitud', detail: 'Se envió solicitud de comprobante al cliente por email.' },
      { id: 'h3', date: '2026-03-27T10:00:00', user: 'Tomás Peterson', action: 'Cambio de estatus', detail: 'Esperando respuesta del cliente.', previousValue: 'Abierta', newValue: 'Esperando cliente' },
    ],
  },
  {
    id: 'CONC-003', accountId: a[1].id, clientName: a[1].client.name, projectName: a[1].project.name,
    unitNumber: a[1].unitNumber, accountNumber: a[1].accountNumber, entidadLegal: a[1].legalEntity.name,
    tipoCobro: a[1].chargeType,
    caseType: 'cep_pendiente', title: 'CEP de pago de febrero no localizado',
    description: 'CEP de pago bancario del 15 de febrero no se localizó en el sistema. Se validó con el banco y se obtuvo CEP.',
    priority: 'media', status: 'resuelta', assignee: 'Luz Ochoa', openDate: '2026-03-20',
    sla: '24h', origin: 'conciliacion_interna', relatedAmount: 52300, reference: 'CEP-20260215-LO',
    markPendingConciliation: false, adjustBandejaPriority: false, forceVisibility: false, blockProcess: false, requiresSpecialFollowUp: false,
    lastMovementDate: '2026-03-22', nextAction: undefined,
    comments: ['CEP validado correctamente', 'Pago conciliado'],
    history: [
      { id: 'h1', date: '2026-03-20T08:00:00', user: 'Luz Ochoa', action: 'Caso creado', detail: 'Se detectó falta de CEP en conciliación mensual.' },
      { id: 'h2', date: '2026-03-21T15:00:00', user: 'Luz Ochoa', action: 'CEP localizado', detail: 'Se obtuvo CEP directamente del portal bancario.' },
      { id: 'h3', date: '2026-03-22T09:00:00', user: 'Luz Ochoa', action: 'Caso resuelto', detail: 'CEP validado y pago conciliado correctamente.', previousValue: 'En revisión', newValue: 'Resuelta' },
    ],
  },
  {
    id: 'CONC-004', accountId: a[7].id, clientName: a[7].client.name, projectName: a[7].project.name,
    unitNumber: a[7].unitNumber, accountNumber: a[7].accountNumber, entidadLegal: a[7].legalEntity.name,
    tipoCobro: a[7].chargeType,
    caseType: 'pago_duplicado', title: 'Posible duplicidad en parcialidad 8',
    description: 'Se detectó un posible pago duplicado en la parcialidad 8 del cliente. Monto duplicado: $41,200 MXN. Pendiente confirmación con tesorería.',
    priority: 'alta', status: 'en_revision', assignee: 'Tomás Peterson', openDate: '2026-03-18',
    sla: '48h', origin: 'cobranza', relatedAmount: 41200,
    markPendingConciliation: true, adjustBandejaPriority: true, forceVisibility: true, blockProcess: true, requiresSpecialFollowUp: true,
    lastMovementDate: '2026-03-27', nextAction: 'Confirmar con tesorería y procesar devolución si procede',
    comments: ['Se detectó posible duplicidad en pago de parcialidad 8', 'Verificando con tesorería'],
    history: [
      { id: 'h1', date: '2026-03-18T10:00:00', user: 'Tomás Peterson', action: 'Caso creado', detail: 'Se detectó posible duplicidad al revisar movimientos de la cuenta.' },
      { id: 'h2', date: '2026-03-20T14:00:00', user: 'Tomás Peterson', action: 'Escalamiento interno', detail: 'Se escaló a tesorería para validación cruzada.' },
    ],
  },
  {
    id: 'CONC-005', accountId: a[23].id, clientName: a[23].client.name, projectName: a[23].project.name,
    unitNumber: a[23].unitNumber, accountNumber: a[23].accountNumber, entidadLegal: a[23].legalEntity.name,
    tipoCobro: a[23].chargeType,
    caseType: 'pago_no_reflejado', title: 'Pago STP no reflejado en estado de cuenta',
    description: 'Cliente indica que pagó por STP pero no se refleja en su cuenta. Monto: $28,750 MXN.',
    priority: 'alta', status: 'abierta', assignee: 'Luz Ochoa', openDate: '2026-03-26',
    sla: '48h', origin: 'cliente', relatedAmount: 28750,
    markPendingConciliation: true, adjustBandejaPriority: true, forceVisibility: false, blockProcess: false, requiresSpecialFollowUp: false,
    lastMovementDate: '2026-03-26', nextAction: 'Solicitar comprobante y rastrear con banco',
    comments: ['Cliente indica que pagó por STP pero no se refleja en su cuenta'],
    history: [
      { id: 'h1', date: '2026-03-26T11:00:00', user: 'Luz Ochoa', action: 'Caso creado', detail: 'Se abre caso por reporte directo del cliente vía WhatsApp.' },
    ],
  },
  {
    id: 'CONC-006', accountId: a[50].id, clientName: a[50].client.name, projectName: a[50].project.name,
    unitNumber: a[50].unitNumber, accountNumber: a[50].accountNumber, entidadLegal: a[50].legalEntity.name,
    tipoCobro: a[50].chargeType,
    caseType: 'pago_duplicado', title: 'Doble cargo reportado por cliente',
    description: 'Cliente reporta doble cargo en su estado de cuenta bancario. Monto: $36,400 MXN por parcialidad.',
    priority: 'alta', status: 'escalada', assignee: 'Tomás Peterson', openDate: '2026-03-27',
    sla: '48h', origin: 'cliente', relatedAmount: 36400,
    markPendingConciliation: true, adjustBandejaPriority: true, forceVisibility: true, blockProcess: true, requiresSpecialFollowUp: true,
    lastMovementDate: '2026-03-29', nextAction: 'Resolución pendiente de tesorería',
    comments: ['Cliente reporta doble cargo en su estado de cuenta', 'Verificando con tesorería', 'Escalado a dirección financiera'],
    history: [
      { id: 'h1', date: '2026-03-27T09:00:00', user: 'Tomás Peterson', action: 'Caso creado', detail: 'Se abre caso por reporte del cliente sobre doble cargo.' },
      { id: 'h2', date: '2026-03-28T10:00:00', user: 'Tomás Peterson', action: 'Verificación con tesorería', detail: 'Se solicitó cruce de información a tesorería.' },
      { id: 'h3', date: '2026-03-29T09:00:00', user: 'Tomás Peterson', action: 'Caso escalado', detail: 'Se escala a dirección financiera para resolución.', previousValue: 'En revisión', newValue: 'Escalada' },
    ],
  },
  {
    id: 'CONC-007', accountId: a[35].id, clientName: a[35].client.name, projectName: a[35].project.name,
    unitNumber: a[35].unitNumber, accountNumber: a[35].accountNumber, entidadLegal: a[35].legalEntity.name,
    tipoCobro: a[35].chargeType,
    caseType: 'aclaracion_saldo', title: 'Diferencia de saldo entre sistema y cliente',
    description: 'Cliente reporta diferencia de $12,500 MXN entre su control y el estado de cuenta del sistema.',
    priority: 'media', status: 'resuelta', assignee: 'Luz Ochoa', openDate: '2026-03-22',
    sla: '72h', origin: 'cliente', relatedAmount: 12500,
    markPendingConciliation: false, adjustBandejaPriority: false, forceVisibility: false, blockProcess: false, requiresSpecialFollowUp: false,
    lastMovementDate: '2026-03-24',
    comments: ['Se aclaró diferencia por cargo de mantenimiento no comunicado'],
    history: [
      { id: 'h1', date: '2026-03-22T10:00:00', user: 'Luz Ochoa', action: 'Caso creado', detail: 'Cliente solicita aclaración de saldo.' },
      { id: 'h2', date: '2026-03-23T11:00:00', user: 'Luz Ochoa', action: 'Análisis completado', detail: 'Se identificó diferencia por cargo de servicios no notificado.' },
      { id: 'h3', date: '2026-03-24T09:00:00', user: 'Luz Ochoa', action: 'Caso resuelto', detail: 'Se aclaró diferencia con cliente y se emitió estado de cuenta corregido.' },
    ],
  },
  {
    id: 'CONC-008', accountId: a[56].id, clientName: a[56].client.name, projectName: a[56].project.name,
    unitNumber: a[56].unitNumber, accountNumber: a[56].accountNumber, entidadLegal: a[56].legalEntity.name,
    tipoCobro: a[56].chargeType,
    caseType: 'pago_mal_aplicado', title: 'Monto depositado no coincide con parcialidad',
    description: 'El monto depositado por el cliente no coincide con el monto de la parcialidad mensual. Diferencia de $3,200 MXN.',
    priority: 'media', status: 'abierta', assignee: 'Tomás Peterson', openDate: '2026-03-24',
    sla: '48h', origin: 'cobranza', relatedAmount: 3200,
    markPendingConciliation: true, adjustBandejaPriority: false, forceVisibility: false, blockProcess: false, requiresSpecialFollowUp: false,
    lastMovementDate: '2026-03-26', nextAction: 'Contactar cliente para aclarar diferencia de monto',
    comments: ['Monto depositado no coincide con parcialidad mensual'],
    history: [
      { id: 'h1', date: '2026-03-24T14:00:00', user: 'Tomás Peterson', action: 'Caso creado', detail: 'Se detectó inconsistencia de monto en revisión diaria.' },
    ],
  },
  {
    id: 'CONC-009', accountId: a[65].id, clientName: a[65].client.name, projectName: a[65].project.name,
    unitNumber: a[65].unitNumber, accountNumber: a[65].accountNumber, entidadLegal: a[65].legalEntity.name,
    tipoCobro: a[65].chargeType,
    caseType: 'transferencia_no_identificada', title: 'Pago directo a cuenta de desarrolladora',
    description: 'Se detectó pago directo a la cuenta de la desarrolladora en lugar de la cuenta concentradora. Se reclasificó y concilió.',
    priority: 'media', status: 'archivada', assignee: 'Luz Ochoa', openDate: '2026-03-15',
    sla: '72h', origin: 'relacion_pagos', relatedAmount: 55000,
    markPendingConciliation: false, adjustBandejaPriority: false, forceVisibility: false, blockProcess: false, requiresSpecialFollowUp: false,
    lastMovementDate: '2026-03-18', archiveReason: 'resuelto_fuera_flujo', archiveComment: 'Pago reclasificado y conciliado directamente con tesorería.',
    comments: ['Pago directo a cuenta de desarrolladora', 'Se reclasificó y concilió'],
    history: [
      { id: 'h1', date: '2026-03-15T10:00:00', user: 'Luz Ochoa', action: 'Caso creado', detail: 'Se detectó pago a cuenta incorrecta en relación de pagos.' },
      { id: 'h2', date: '2026-03-17T11:00:00', user: 'Luz Ochoa', action: 'Reclasificación', detail: 'Se reclasificó pago a cuenta concentradora correcta.' },
      { id: 'h3', date: '2026-03-18T09:00:00', user: 'Luz Ochoa', action: 'Caso archivado', detail: 'Resuelto fuera del flujo. Pago conciliado con tesorería.' },
    ],
  },
  {
    id: 'CONC-010', accountId: a[43].id, clientName: a[43].client.name, projectName: a[43].project.name,
    unitNumber: a[43].unitNumber, accountNumber: a[43].accountNumber, entidadLegal: a[43].legalEntity.name,
    tipoCobro: a[43].chargeType,
    caseType: 'evidencia_incompleta', title: 'Pagos de terceros detectados – revisión PLD',
    description: 'Se detectaron pagos de terceros en la cuenta. Pendiente revisión PLD antes de conciliar.',
    priority: 'critica', status: 'escalada', assignee: 'Tomás Peterson', openDate: '2026-03-20',
    sla: '24h', origin: 'sistema', relatedAmount: 92000,
    markPendingConciliation: true, adjustBandejaPriority: true, forceVisibility: true, blockProcess: true, requiresSpecialFollowUp: true,
    lastMovementDate: '2026-03-29', nextAction: 'Esperar dictamen de área PLD',
    comments: ['Pagos de terceros detectados', 'Pendiente revisión PLD', 'Escalado a compliance'],
    history: [
      { id: 'h1', date: '2026-03-20T08:00:00', user: 'Sistema', action: 'Alerta automática', detail: 'Sistema detectó pagos de terceros en la cuenta.' },
      { id: 'h2', date: '2026-03-20T09:00:00', user: 'Tomás Peterson', action: 'Caso creado', detail: 'Se abre caso por alerta PLD automática.' },
      { id: 'h3', date: '2026-03-22T14:00:00', user: 'Tomás Peterson', action: 'Caso escalado', detail: 'Escalado a área de compliance/PLD para dictamen.' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────
export function getActiveCasesForAccount(accountId: string): ConciliacionCase[] {
  return mockConciliaciones.filter(c => c.accountId === accountId && !['resuelta', 'archivada'].includes(c.status));
}

export function getHighestPriorityForAccount(accountId: string): ConciliacionPriority | null {
  const active = getActiveCasesForAccount(accountId);
  if (active.length === 0) return null;
  const order: ConciliacionPriority[] = ['critica', 'alta', 'media', 'baja'];
  for (const p of order) {
    if (active.some(c => c.priority === p)) return p;
  }
  return null;
}

export function isFueraSLA(c: ConciliacionCase): boolean {
  if (['resuelta', 'archivada'].includes(c.status)) return false;
  const hours = parseInt(c.sla) || 48;
  const openTime = new Date(c.openDate + 'T09:00:00').getTime();
  const now = new Date('2026-03-31T12:00:00').getTime();
  return (now - openTime) > hours * 3600000;
}

export function addConciliacionHistoryEntry(caseId: string, entry: Omit<ConciliacionHistoryEntry, 'id'>): void {
  const caso = mockConciliaciones.find(c => c.id === caseId);
  if (caso) {
    caso.history.push({ ...entry, id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
    caso.lastMovementDate = new Date().toISOString().split('T')[0];
  }
}

export function addConciliacionBitacoraEntry(accountId: string, title: string, description: string, user: string) {
  addBitacoraEntry({
    id: `bit-conc-${Date.now()}`,
    accountId,
    category: 'cobranza',
    eventType: 'actualizacion_saldo',
    title,
    description,
    user,
    date: new Date().toISOString(),
    origin: 'Conciliación',
    result: 'Registrado',
  });
}
