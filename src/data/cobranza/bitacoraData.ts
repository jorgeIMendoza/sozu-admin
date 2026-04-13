import { mockAccounts } from './mockData';

export type BitacoraCategory = 'comunicacion' | 'nota_interna' | 'cobranza' | 'atencion' | 'documentacion' | 'venta' | 'legal' | 'sistema';

export type BitacoraEventType =
  // Comunicación
  | 'llamada' | 'email' | 'whatsapp' | 'sms'
  // Nota interna
  | 'observacion' | 'contexto_cliente' | 'seguimiento_manual' | 'actualizacion_caso'
  // Cobranza
  | 'recordatorio_enviado' | 'promesa_creada' | 'promesa_vencida' | 'compromiso_incumplido' | 'seguimiento_mora' | 'actualizacion_saldo'
  // Atención
  | 'solicitud_comprobante' | 'solicitud_edocuenta' | 'aclaracion_pagos' | 'renegociacion' | 'entrega_escrituracion' | 'factura' | 'devolucion' | 'penalidad'
  // Documentación
  | 'documento_recibido' | 'documento_validado' | 'documento_rechazado' | 'documento_modificado' | 'expediente_actualizado'
  // Venta / onboarding
  | 'apartado_recibido' | 'bienvenida_enviada' | 'alta_cliente' | 'expediente_inicial' | 'contrato_enviado_firma' | 'contrato_firmado' | 'actualizacion_datos'
  // Legal
  | 'escalado_legal' | 'revision_juridica' | 'notificacion_formal' | 'notificacion_entregada' | 'notificacion_reprogramada' | 'demanda_preparada' | 'convenio_terminacion' | 'rescision' | 'liberacion_comercial' | 'avance_rescision'
  // Sistema
  | 'recordatorio_automatico' | 'alerta_mora' | 'alerta_pld' | 'fuera_sla' | 'cambio_estatus';

export interface BitacoraEntry {
  id: string;
  accountId: string;
  category: BitacoraCategory;
  eventType: BitacoraEventType;
  title: string;
  description: string;
  user: string;
  date: string;
  origin: string;
  result?: string;
}

export const categoryLabels: Record<BitacoraCategory, string> = {
  comunicacion: 'Comunicación',
  nota_interna: 'Nota interna',
  cobranza: 'Cobranza',
  atencion: 'Atención',
  documentacion: 'Documentación',
  venta: 'Venta',
  legal: 'Legal',
  sistema: 'Sistema',
};

export const eventTypeLabels: Record<BitacoraEventType, string> = {
  llamada: 'Llamada', email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS',
  observacion: 'Observación', contexto_cliente: 'Contexto del cliente', seguimiento_manual: 'Seguimiento manual', actualizacion_caso: 'Actualización de caso',
  recordatorio_enviado: 'Recordatorio enviado', promesa_creada: 'Promesa creada', promesa_vencida: 'Promesa vencida', compromiso_incumplido: 'Compromiso incumplido', seguimiento_mora: 'Seguimiento de mora', actualizacion_saldo: 'Actualización de saldo',
  solicitud_comprobante: 'Solicitud de comprobante', solicitud_edocuenta: 'Solicitud de estado de cuenta', aclaracion_pagos: 'Aclaración de pagos', renegociacion: 'Renegociación', entrega_escrituracion: 'Entrega y escrituración', factura: 'Factura', devolucion: 'Devolución', penalidad: 'Penalidad',
  documento_recibido: 'Documento recibido', documento_validado: 'Documento validado', documento_rechazado: 'Documento rechazado', documento_modificado: 'Documento modificado', expediente_actualizado: 'Expediente actualizado',
  apartado_recibido: 'Apartado recibido', bienvenida_enviada: 'Bienvenida enviada', alta_cliente: 'Alta de cliente', expediente_inicial: 'Expediente inicial recibido', contrato_enviado_firma: 'Contrato enviado a firma', contrato_firmado: 'Contrato firmado', actualizacion_datos: 'Actualización de datos',
  escalado_legal: 'Escalado a legal', revision_juridica: 'Revisión jurídica', notificacion_formal: 'Notificación formal generada', notificacion_entregada: 'Notificación entregada', notificacion_reprogramada: 'Notificación reprogramada', demanda_preparada: 'Demanda preparada', convenio_terminacion: 'Convenio de terminación', rescision: 'Rescisión', liberacion_comercial: 'Liberación comercial', avance_rescision: 'Avance de rescisión',
  recordatorio_automatico: 'Recordatorio automático', alerta_mora: 'Alerta por mora', alerta_pld: 'Alerta PLD', fuera_sla: 'Fuera de SLA', cambio_estatus: 'Cambio de estatus',
};

export const categoryEventTypes: Record<BitacoraCategory, BitacoraEventType[]> = {
  comunicacion: ['llamada', 'email', 'whatsapp', 'sms'],
  nota_interna: ['observacion', 'contexto_cliente', 'seguimiento_manual', 'actualizacion_caso'],
  cobranza: ['recordatorio_enviado', 'promesa_creada', 'promesa_vencida', 'compromiso_incumplido', 'seguimiento_mora', 'actualizacion_saldo'],
  atencion: ['solicitud_comprobante', 'solicitud_edocuenta', 'aclaracion_pagos', 'renegociacion', 'entrega_escrituracion', 'factura', 'devolucion', 'penalidad'],
  documentacion: ['documento_recibido', 'documento_validado', 'documento_rechazado', 'documento_modificado', 'expediente_actualizado'],
  venta: ['apartado_recibido', 'bienvenida_enviada', 'alta_cliente', 'expediente_inicial', 'contrato_enviado_firma', 'contrato_firmado', 'actualizacion_datos'],
  legal: ['escalado_legal', 'revision_juridica', 'notificacion_formal', 'notificacion_entregada', 'notificacion_reprogramada', 'demanda_preparada', 'convenio_terminacion', 'rescision', 'liberacion_comercial', 'avance_rescision'],
  sistema: ['recordatorio_automatico', 'alerta_mora', 'alerta_pld', 'fuera_sla', 'cambio_estatus'],
};

export const resultOptions = [
  'Enviado', 'Leído', 'Registrado', 'Validado', 'Rechazado', 'Escalado', 'Cumplido', 'Vencido', 'Pendiente', 'Completado',
];

function seedBitacora(accountId: string): BitacoraEntry[] {
  const account = mockAccounts.find(a => a.id === accountId);
  if (!account) return [];
  const exec = account.assignedExecutive;
  const isLegal = account.legalStatus !== 'sin_accion';

  const entries: BitacoraEntry[] = [
    // Venta / onboarding
    { id: `bit-v1-${accountId}`, accountId, category: 'venta', eventType: 'apartado_recibido', title: 'Apartado recibido', description: 'Se recibió pago de apartado. Cliente asignado a unidad.', user: 'Ventas', date: account.separationDate + 'T09:00:00', origin: 'Venta', result: 'Registrado' },
    { id: `bit-v2-${accountId}`, accountId, category: 'venta', eventType: 'alta_cliente', title: 'Alta de cliente en sistema', description: `Cliente ${account.client.name} dado de alta. RFC: ${account.client.rfc || 'Pendiente'}. Proyecto: ${account.project.name}, Unidad: ${account.unitNumber}.`, user: 'Ventas', date: account.separationDate + 'T10:30:00', origin: 'Venta', result: 'Completado' },
    { id: `bit-v3-${accountId}`, accountId, category: 'venta', eventType: 'bienvenida_enviada', title: 'Kit de bienvenida enviado', description: 'Se envió correo de bienvenida con información de la unidad, datos de pago y contacto del ejecutivo asignado.', user: 'Sistema', date: account.separationDate + 'T11:00:00', origin: 'Sistema', result: 'Enviado' },
    { id: `bit-v4-${accountId}`, accountId, category: 'venta', eventType: 'expediente_inicial', title: 'Expediente inicial recibido', description: 'Se recibió expediente documental inicial del área comercial. Documentos básicos de identificación integrados.', user: 'Ventas', date: new Date(new Date(account.separationDate).getTime() + 7 * 86400000).toISOString().split('T')[0] + 'T14:00:00', origin: 'Venta', result: 'Registrado' },
    { id: `bit-v5-${accountId}`, accountId, category: 'venta', eventType: 'contrato_enviado_firma', title: 'Contrato enviado a firma', description: 'Se generó contrato de compraventa y se envió al cliente para revisión y firma ante notario.', user: 'Depto. Legal', date: account.contractDate + 'T10:00:00', origin: 'Legal', result: 'Enviado' },
    { id: `bit-v6-${accountId}`, accountId, category: 'venta', eventType: 'contrato_firmado', title: 'Contrato firmado', description: 'Contrato de compraventa firmado por ambas partes. Expediente legal completo.', user: 'Depto. Legal', date: new Date(new Date(account.contractDate).getTime() + 14 * 86400000).toISOString().split('T')[0] + 'T16:00:00', origin: 'Legal', result: 'Completado' },
    // Documentación
    { id: `bit-d1-${accountId}`, accountId, category: 'documentacion', eventType: 'documento_validado', title: 'INE validada', description: 'Identificación oficial del cliente validada por el equipo de cobranza.', user: 'Luz Ochoa', date: '2024-08-16T09:30:00', origin: 'Documentación', result: 'Validado' },
    { id: `bit-d2-${accountId}`, accountId, category: 'documentacion', eventType: 'documento_recibido', title: 'Comprobante de domicilio recibido', description: 'Se recibió comprobante de domicilio del cliente vía correo electrónico.', user: 'Tomás Peterson', date: '2024-08-20T11:00:00', origin: 'Documentación', result: 'Registrado' },
    // Cobranza
    { id: `bit-c1-${accountId}`, accountId, category: 'sistema', eventType: 'recordatorio_automatico', title: 'Recordatorio automático de pago', description: `Se envió recordatorio automático de pago. Próximo vencimiento: ${account.nextDueDate}.`, user: 'Sistema', date: '2026-03-01T08:00:00', origin: 'Sistema', result: 'Enviado' },
    { id: `bit-c2-${accountId}`, accountId, category: 'comunicacion', eventType: 'email', title: 'Recordatorio de pago - Parcialidad mensual', description: 'Estimado cliente, le recordamos que su próxima fecha de pago es el día indicado en su calendario. Le agradecemos su puntualidad.', user: exec, date: '2026-03-25T09:15:00', origin: 'Cobranza', result: 'Enviado' },
    { id: `bit-c3-${accountId}`, accountId, category: 'comunicacion', eventType: 'llamada', title: 'Seguimiento de saldo vencido', description: 'Se contactó al cliente para dar seguimiento al saldo vencido. El cliente menciona que realizará el pago a más tardar el viernes.', user: exec, date: '2026-03-20T10:30:00', origin: 'Cobranza', result: 'Promesa de pago registrada' },
    { id: `bit-c4-${accountId}`, accountId, category: 'comunicacion', eventType: 'whatsapp', title: 'Envío de estado de cuenta', description: 'Se envió estado de cuenta actualizado al cliente vía WhatsApp. Incluye desglose de parcialidades y saldos.', user: exec, date: '2026-03-12T14:20:00', origin: 'Cobranza', result: 'Leído' },
    { id: `bit-c5-${accountId}`, accountId, category: 'nota_interna', eventType: 'observacion', title: 'Revisión de expediente', description: 'Se revisó expediente completo del caso. Documentación al corriente. No se detectan inconsistencias.', user: exec, date: '2026-02-28T16:45:00', origin: 'Cobranza' },
  ];

  // Add overdue alerts
  if (account.overdueInstallments > 0) {
    entries.push({
      id: `bit-a1-${accountId}`, accountId, category: 'sistema', eventType: 'alerta_mora',
      title: `Alerta: ${account.overdueInstallments} parcialidad(es) vencida(s)`,
      description: `La cuenta presenta ${account.overdueInstallments} parcialidad(es) vencida(s) con un saldo de $${account.overdueAmount.toLocaleString('es-MX')} MXN.`,
      user: 'Sistema', date: '2026-03-15T07:00:00', origin: 'Sistema', result: 'Escalado',
    });
    entries.push({
      id: `bit-cb1-${accountId}`, accountId, category: 'cobranza', eventType: 'seguimiento_mora',
      title: 'Seguimiento preventivo de mora',
      description: 'Se inicia seguimiento por parcialidades vencidas. Se establece contacto con el cliente para regularización.',
      user: exec, date: '2026-03-16T09:00:00', origin: 'Cobranza', result: 'Registrado',
    });
  }

  // Promise entries
  if (account.activePromise) {
    entries.push({
      id: `bit-p1-${accountId}`, accountId, category: 'cobranza', eventType: 'promesa_creada',
      title: 'Promesa de pago registrada',
      description: `Cliente se compromete a pagar $${account.activePromise.amount.toLocaleString('es-MX')} MXN para el ${account.activePromise.promiseDate}. ${account.activePromise.notes}`,
      user: account.activePromise.registeredBy, date: account.activePromise.createdAt + 'T11:00:00', origin: 'Cobranza', result: 'Registrado',
    });
  }

  // PLD alert
  if (account.pldStatus !== 'validado') {
    entries.push({
      id: `bit-pld-${accountId}`, accountId, category: 'sistema', eventType: 'alerta_pld',
      title: 'Alerta PLD activada',
      description: `Se detectó alerta de Prevención de Lavado de Dinero en esta cuenta. Estatus: ${account.pldStatus}. Se requiere revisión del área de cumplimiento.`,
      user: 'Sistema', date: '2026-03-10T08:00:00', origin: 'Sistema', result: 'Pendiente',
    });
  }

  // Legal entries
  if (isLegal) {
    entries.push({
      id: `bit-l1-${accountId}`, accountId, category: 'legal', eventType: 'escalado_legal',
      title: 'Caso escalado a área legal',
      description: 'Se escala caso al departamento jurídico por incumplimiento reiterado de obligaciones contractuales.',
      user: exec, date: '2026-02-20T10:00:00', origin: 'Legal', result: 'Escalado',
    });
    if (['notificacion_preparacion', 'enviada_notario', 'programada_entrega', 'entregada'].includes(account.legalStatus)) {
      entries.push({
        id: `bit-l2-${accountId}`, accountId, category: 'legal', eventType: 'notificacion_formal',
        title: 'Notificación formal generada',
        description: 'Se generó notificación formal de incumplimiento contractual para entrega al cliente por conducto notarial.',
        user: 'Depto. Legal', date: '2026-02-25T14:00:00', origin: 'Legal', result: 'Registrado',
      });
    }
  }

  // Atención
  entries.push({
    id: `bit-at1-${accountId}`, accountId, category: 'atencion', eventType: 'solicitud_edocuenta',
    title: 'Cliente solicita estado de cuenta',
    description: 'El cliente contactó para solicitar estado de cuenta actualizado. Se le envió vía correo electrónico.',
    user: exec, date: '2026-03-05T11:30:00', origin: 'Atención', result: 'Enviado',
  });

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const bitacoraCache: Record<string, BitacoraEntry[]> = {};

export function getBitacoraEntries(accountId: string): BitacoraEntry[] {
  if (!bitacoraCache[accountId]) {
    bitacoraCache[accountId] = seedBitacora(accountId);
  }
  return bitacoraCache[accountId];
}

export function addBitacoraEntry(entry: BitacoraEntry) {
  if (!bitacoraCache[entry.accountId]) {
    bitacoraCache[entry.accountId] = seedBitacora(entry.accountId);
  }
  bitacoraCache[entry.accountId] = [entry, ...bitacoraCache[entry.accountId]];
}
