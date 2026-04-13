import { mockAccounts } from './mockData';
import type { Account } from '@/types/cobranza';

// ── Client Entity ───────────────────────────────────────────────
export type PersonType = 'fisica' | 'moral';
export type ClientStatus = 'activo' | 'en_seguimiento' | 'inactivo' | 'bloqueado';
export type ClientAccountRole = 'titular' | 'copropietario' | 'obligado_solidario' | 'representante';

export interface ClientEntity {
  id: string;
  name: string;
  personType: PersonType;
  rfc: string;
  email: string;
  phone: string;
  clabes: string[];
  status: ClientStatus;
  executiveAssigned: string;
  fiscalAddress?: string;
  curp?: string;
  createdAt: string;
}

export interface ClientAccountLink {
  clientId: string;
  accountId: string; // internal Account.id
  role: ClientAccountRole;
  percentage?: number;
  status: 'activa' | 'cancelada' | 'finalizada';
}

// ── CRM History (distinct from Bitácora) ────────────────────────
export type CRMInteractionType = 'llamada' | 'email' | 'whatsapp' | 'nota' | 'tarea' | 'recordatorio' | 'cambio_estado' | 'escalamiento' | 'respuesta_cliente' | 'error_envio' | 'aviso';

export interface CRMHistoryEntry {
  id: string;
  clientId: string;
  caseId?: string;
  type: CRMInteractionType;
  title: string;
  detail: string;
  executive: string;
  date: string;
  result?: string;
  nextStep?: string;
}

export const crmInteractionLabels: Record<CRMInteractionType, string> = {
  llamada: 'Llamada',
  email: 'Email',
  whatsapp: 'WhatsApp',
  nota: 'Nota interna',
  tarea: 'Tarea',
  recordatorio: 'Recordatorio',
  cambio_estado: 'Cambio de estado',
  escalamiento: 'Escalamiento',
  respuesta_cliente: 'Respuesta del cliente',
  error_envio: 'Error de envío',
  aviso: 'Aviso enviado',
};

// ── Build client entities from mockAccounts ─────────────────────
function buildClients(): { clients: ClientEntity[]; links: ClientAccountLink[]; crmHistory: CRMHistoryEntry[] } {
  const clientMap = new Map<string, ClientEntity>();
  const links: ClientAccountLink[] = [];

  mockAccounts.forEach((acc) => {
    const c = acc.client;
    if (!clientMap.has(c.id)) {
      clientMap.set(c.id, {
        id: c.id,
        name: c.name,
        personType: 'fisica',
        rfc: c.rfc || '',
        email: c.email,
        phone: c.phone,
        clabes: [acc.clabe],
        status: 'activo',
        executiveAssigned: acc.assignedExecutive,
        createdAt: acc.separationDate,
      });
    } else {
      const existing = clientMap.get(c.id)!;
      if (!existing.clabes.includes(acc.clabe)) existing.clabes.push(acc.clabe);
    }
    links.push({
      clientId: c.id,
      accountId: acc.id,
      role: 'titular',
      percentage: 100,
      status: acc.priority === 'gray' ? 'cancelada' : 'activa',
    });
  });

  // Add co-owners for some accounts to demonstrate many-to-many
  const coOwnerPairs: [number, number][] = [[0, 1], [5, 6], [18, 19], [43, 44]];
  coOwnerPairs.forEach(([ownerIdx, accountIdx]) => {
    if (mockAccounts[ownerIdx] && mockAccounts[accountIdx]) {
      links.push({
        clientId: mockAccounts[ownerIdx].client.id,
        accountId: mockAccounts[accountIdx].id,
        role: 'copropietario',
        percentage: 50,
        status: 'activa',
      });
    }
  });

  // CRM history entries
  const crmHistory: CRMHistoryEntry[] = [
    { id: 'CRM-001', clientId: 'cli-1', caseId: 'CASE-001', type: 'whatsapp', title: 'Solicitud de comprobante recibida', detail: 'Cliente solicita comprobante de pago de febrero por WhatsApp.', executive: 'Luz Ochoa', date: '2026-03-28T09:15:00', result: 'Recibido' },
    { id: 'CRM-002', clientId: 'cli-6', caseId: 'CASE-002', type: 'whatsapp', title: 'Reporte de pago no reflejado', detail: 'Cliente reporta transferencia del lunes no reflejada en estado de cuenta.', executive: 'Tomás Peterson', date: '2026-03-27T14:00:00', result: 'En revisión' },
    { id: 'CRM-003', clientId: 'cli-6', caseId: 'CASE-002', type: 'whatsapp', title: 'Solicitud de comprobante', detail: 'Se solicitó comprobante de pago al cliente para verificación.', executive: 'Tomás Peterson', date: '2026-03-27T14:30:00', result: 'Enviado por cliente' },
    { id: 'CRM-004', clientId: 'cli-19', caseId: 'CASE-003', type: 'llamada', title: 'Contacto por reestructura', detail: 'Cliente indica dificultad para cubrir 3 parcialidades vencidas. Dispuesto a negociar.', executive: 'Luz Ochoa', date: '2026-03-26T10:00:00', result: 'Contactado', nextStep: 'Crear propuesta de regularización' },
    { id: 'CRM-005', clientId: 'cli-44', caseId: 'CASE-005', type: 'llamada', title: 'Solicitud de rescate por penalización', detail: 'Cliente con 3+ parcialidades vencidas solicita opciones de rescate.', executive: 'Luz Ochoa', date: '2026-03-24T16:00:00', result: 'Escalado' },
    { id: 'CRM-006', clientId: 'cli-44', caseId: 'CASE-005', type: 'escalamiento', title: 'Caso escalado a supervisor', detail: 'Se escaló caso a supervisor para evaluar propuesta de rescate.', executive: 'Luz Ochoa', date: '2026-03-25T09:00:00' },
    { id: 'CRM-007', clientId: 'cli-11', caseId: 'CASE-009', type: 'email', title: 'Reporte de discrepancia en saldo', detail: 'El monto del estado de cuenta no coincide con cálculo del cliente.', executive: 'Luz Ochoa', date: '2026-03-26T08:30:00', result: 'En revisión' },
    { id: 'CRM-008', clientId: 'cli-51', caseId: 'CASE-016', type: 'email', title: 'Reporte de cobro doble', detail: 'Cliente detectó dos cargos del mismo monto. Solicita devolución.', executive: 'Tomás Peterson', date: '2026-03-25T11:00:00', result: 'En revisión' },
    { id: 'CRM-009', clientId: 'cli-91', caseId: 'CASE-023', type: 'llamada', title: 'Solicitud de regularización', detail: 'Cliente con parcialidades vencidas quiere saber opciones de regularización.', executive: 'Luz Ochoa', date: '2026-03-26T16:00:00', result: 'Contactado' },
    { id: 'CRM-010', clientId: 'cli-26', caseId: 'CASE-011', type: 'llamada', title: 'Solicitud de desglose de saldo', detail: 'Cliente no entiende desglose de saldo pendiente.', executive: 'Luz Ochoa', date: '2026-03-28T11:30:00' },
  ];

  return { clients: Array.from(clientMap.values()), links, crmHistory };
}

const { clients: _clients, links: _links, crmHistory: _crmHistory } = buildClients();

export const mockClients: ClientEntity[] = _clients;
export const mockClientAccountLinks: ClientAccountLink[] = _links;
export const mockCRMHistory: CRMHistoryEntry[] = _crmHistory;

// ── Helpers ─────────────────────────────────────────────────────
export function getClientById(clientId: string): ClientEntity | undefined {
  return mockClients.find(c => c.id === clientId);
}

export function getAccountsForClient(clientId: string): { account: Account; role: ClientAccountRole; percentage?: number }[] {
  return mockClientAccountLinks
    .filter(l => l.clientId === clientId)
    .map(l => {
      const account = mockAccounts.find(a => a.id === l.accountId);
      return account ? { account, role: l.role, percentage: l.percentage } : null;
    })
    .filter(Boolean) as any;
}

export function getClientsForAccount(accountId: string): { client: ClientEntity; role: ClientAccountRole; percentage?: number }[] {
  return mockClientAccountLinks
    .filter(l => l.accountId === accountId)
    .map(l => {
      const client = mockClients.find(c => c.id === l.clientId);
      return client ? { client, role: l.role, percentage: l.percentage } : null;
    })
    .filter(Boolean) as any;
}

export function getCRMHistoryForClient(clientId: string): CRMHistoryEntry[] {
  return mockCRMHistory.filter(h => h.clientId === clientId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function addCRMHistoryEntry(entry: CRMHistoryEntry): void {
  mockCRMHistory.unshift(entry);
}

export function getClientIdFromAccountId(accountId: string): string | undefined {
  const link = mockClientAccountLinks.find(l => l.accountId === accountId && l.role === 'titular');
  return link?.clientId;
}

export const personTypeLabels: Record<PersonType, string> = { fisica: 'Persona física', moral: 'Persona moral' };
export const clientStatusLabels: Record<ClientStatus, string> = { activo: 'Activo', en_seguimiento: 'En seguimiento', inactivo: 'Inactivo', bloqueado: 'Bloqueado' };
export const clientAccountRoleLabels: Record<ClientAccountRole, string> = { titular: 'Titular', copropietario: 'Copropietario', obligado_solidario: 'Obligado solidario', representante: 'Representante' };
