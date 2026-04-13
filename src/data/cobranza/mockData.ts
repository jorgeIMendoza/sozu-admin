import type { Account, KPIData, Installment, FinancialMovement, Communication, AccountDocument, PaymentPromise, Incident, WeeklyFlowData, PLDStatus, LegalStatus, LegalEntity, ChargeType } from '@/types/cobranza';

// ── Core Catalogs ───────────────────────────────────────────────
export const projects = [
  { id: 'p1', name: 'Margot', location: 'Zapopan, Jalisco', totalUnits: 64 },
  { id: 'p2', name: 'Bottura', location: 'Zapopan, Jalisco', totalUnits: 85 },
  { id: 'p3', name: 'Daiku', location: 'Guadalajara, Jalisco', totalUnits: 120 },
  { id: 'p4', name: 'Monócolo', location: 'Guadalajara, Jalisco', totalUnits: 48 },
];

export const executives = ['Luz Ochoa', 'Tomás Peterson'];

export const mockLegalEntities: LegalEntity[] = [
  { id: 'le-1', name: 'Tallwood', rfc: 'TWD201015AB1' },
  { id: 'le-2', name: 'Real Estate Ventures', rfc: 'REV190820CD3' },
  { id: 'le-3', name: 'Komakai', rfc: 'KOM210312EF5' },
  { id: 'le-4', name: 'Corporativo Jmdq', rfc: 'CJM180605GH7' },
  { id: 'le-5', name: 'Hevi Holding', rfc: 'HHO190420MN4' },
  { id: 'le-6', name: 'DZOG CAPITAL', rfc: 'DZC220115KL2' },
];

// Project ↔ Legal Entity mapping
export const projectLegalEntities: Record<string, string[]> = {
  p1: ['le-1', 'le-6'],           // Margot → Tallwood, DZOG CAPITAL
  p2: ['le-3', 'le-4', 'le-5'],   // Bottura → Komakai, Corporativo Jmdq, Hevi Holding
  p3: ['le-1', 'le-2'],           // Daiku → Tallwood, Real Estate Ventures
  p4: ['le-2', 'le-3', 'le-6'],   // Monócolo → Real Estate Ventures, Komakai, DZOG CAPITAL
};

export const paymentOrigins = ['STP', 'Efectivo', 'Cheque', 'Transferencia', 'STP manual'] as const;

// ── Charge configurations (flat ChargeType) ─────────────────────
const chargeTypes: ChargeType[] = [
  'propiedad', 'propiedad', 'propiedad', 'propiedad',
  'estacionamiento', 'bodega', 'propiedad', 'paquete_muebles',
  'propiedad', 'condensadora', 'propiedad', 'servicios',
  'propiedad', 'estacionamiento', 'propiedad', 'servicios',
  'propiedad', 'bodega', 'propiedad', 'paquete_muebles',
];

function randomDate(start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().split('T')[0];
}

// ── Collection Comments ─────────────────────────────────────────
export interface CollectionComment {
  id: string;
  accountId: string;
  date: string;
  author: string;
  content: string;
  result?: string;
  nextStep?: string;
}

export const mockCollectionComments: Record<string, CollectionComment[]> = {};

// ── Client names (100) ──────────────────────────────────────────
const clientNames = [
  'Roberto García López', 'María Fernanda Herrera Solís', 'Juan Pablo Martínez Ríos',
  'Andrea Sánchez Vega', 'Luis Alberto Domínguez Torres', 'Gabriela Torres Ruiz',
  'Fernando Castillo Núñez', 'Patricia Morales Díaz', 'Alejandro Reyes Soto',
  'Carolina Jiménez Flores', 'Miguel Ángel Vargas Leal', 'Daniela Rojas Medina',
  'Ricardo Peña Aguilar', 'Valeria Ortiz Campos', 'Héctor Navarro Gil',
  'Mariana Espinoza León', 'Jorge Eduardo Ríos Bravo', 'Claudia Delgado Paz',
  'Sergio Ibarra Coronado', 'Ana Lucía Montoya Reyes', 'Pablo Guerrero Silva',
  'Natalia Cruz Estrada', 'Raúl Figueroa Bravo', 'Isabela Paredes Ramos',
  'Óscar Villalobos Cano', 'Renata Salazar Duarte', 'Ernesto Leal Ochoa',
  'Camila Contreras Vera', 'Tomás Acosta Galindo', 'Lucía Medrano Solís',
  'Diego Armando Fuentes', 'Sofía Rangel Montes', 'Eduardo Cervantes Parra',
  'Regina Mendoza Ávila', 'Arturo Bernal Castro', 'Ximena Rosas Valdez',
  'Guillermo Tapia Serrano', 'Lorena Estrada Quintero', 'Iván Sandoval Peña',
  'Paulina Aguirre Trejo', 'Rafael Cisneros Luna', 'Martha Guzmán Orozco',
  'Emilio Zavala Rincón', 'Adriana Camacho Solano', 'Francisco Javier Mora',
  'Paola Noriega Beltrán', 'Alberto Mejía Sepúlveda', 'Verónica Padilla Lara',
  'Enrique Cárdenas Huerta', 'Mónica Villegas Romero', 'Javier Alonso Téllez',
  'Sandra Bermúdez Arce', 'César Augusto Portillo', 'Karina Monroy Esquivel',
  'Manuel Alejandro Durán', 'Teresa Gallegos Ponce', 'Rodrigo Guevara Nieto',
  'Julieta Barragán Olvera', 'Octavio Robles Heredia', 'Alicia Carmona Suárez',
  'Hugo Enrique Palomino', 'Elisa Vázquez Miranda', 'Salvador Hinojosa Cantú',
  'Marcela Arellano Chávez', 'Ramón Velázquez Peralta', 'Irene Castellanos Franco',
  'Gonzalo Esparza Macías', 'Claudia Romero Tovar', 'Luis Fernando Acuña',
  'Adrián Salinas Cortés', 'Beatriz Salgado Nava', 'Germán Solís Ramos',
  'Vanessa Pacheco Landa', 'Damián Olvera Jaime', 'Laura Patricia Quiroz',
  'Nicolás Andrade Marín', 'Denisse Bustamante Prado', 'Pedro Iñiguez Serna',
  'Catalina Rubio Zúñiga', 'Aldo Martín Garza', 'Fabiola Lozano Cuevas',
  'Mauricio Carranza Meza', 'Elena Barrientos Cruz', 'Ignacio Plascencia Gil',
  'Leticia Segura Villar', 'José Manuel Ayala Ríos', 'Samantha Pineda Solano',
  'Rubén Osorio Benítez', 'Karla Yolanda Tejeda', 'Alfredo Pantoja Díaz',
  'Dalia Montalvo Espino', 'Cristian Zarate Melo', 'Rebeca Escobedo Torres',
  'Felipe de Jesús Prado', 'Araceli Vega Contreras', 'Víctor Hugo Landeros',
  'Tania Gabriela Nájera', 'Omar Alejandro Soto', 'Gloria Ivette Moreno',
  'Lorenzo Méndez Aranda', 'Angélica Valdés Zamora',
];

const models = ['Studio', 'Loft', 'Suite', 'Penthouse', 'Garden', 'Sky', 'Flat', 'Junior'];
const buildings = ['Torre A', 'Torre B', 'Torre C', 'Torre Norte', 'Torre Sur', 'Torre Poniente'];

// Account ID formats
function accountIdStr(i: number, ct: ChargeType): string {
  const num = 1700 + i;
  if (ct === 'bodega' || ct === 'paquete_muebles' || ct === 'condensadora' || ct === 'estacionamiento') return `CCP-${String(num).padStart(6, '0')}`;
  if (ct === 'servicios') return `CCS-${String(num).padStart(6, '0')}`;
  return `CC-${String(num).padStart(6, '0')}`;
}

function clabe(i: number): string {
  return `6461802874001${String(10000 + i * 37).padStart(5, '0')}`;
}

// Price by charge type
function priceForCharge(ct: ChargeType): number {
  if (ct === 'propiedad') {
    const prices = [2850000, 3200000, 3750000, 4100000, 4500000, 5200000, 6800000, 3950000];
    return prices[Math.floor(Math.random() * prices.length)];
  }
  if (ct === 'estacionamiento') return [280000, 350000, 420000][Math.floor(Math.random() * 3)];
  if (ct === 'bodega') return [180000, 220000, 260000][Math.floor(Math.random() * 3)];
  if (ct === 'paquete_muebles') return [150000, 195000, 240000][Math.floor(Math.random() * 3)];
  if (ct === 'condensadora') return [85000, 110000, 135000][Math.floor(Math.random() * 3)];
  // servicios
  return [35000, 48000, 65000, 82000][Math.floor(Math.random() * 4)];
}

function generateAccounts(): Account[] {
  const count = 100;
  const overduePattern = [0,0,0,0,0,1,0,0,0,0, 1,2,0,0,0,0,0,1,3,0, 0,0,2,0,0,0,1,0,0,0, 0,0,0,0,1,0,0,2,0,0, 0,0,0,3,0,0,0,0,1,0, 0,0,0,0,0,0,2,0,0,0, 1,0,0,0,0,3,0,0,0,0, 0,0,1,0,0,0,0,0,2,0, 0,0,0,0,0,1,0,0,0,0, 0,0,3,0,0,0,0,0,0,1];
  const paymentDays = [5, 10, 15, 20, 25, 28];

  return Array.from({ length: count }, (_, i) => {
    const proj = projects[i % 4];
    const ct = chargeTypes[i % chargeTypes.length];
    const overdueInstallments = overduePattern[i];
    const totalPrice = priceForCharge(ct);
    const totalInstallments = ct === 'propiedad' ? [36, 48, 60][i % 3] : (ct === 'bodega' || ct === 'paquete_muebles' || ct === 'condensadora' || ct === 'estacionamiento') ? [12, 18, 24][i % 3] : [6, 12][i % 2];
    const currentInstallment = Math.min(Math.floor(totalInstallments * 0.4) + (i % 8), totalInstallments);
    const paidAmount = Math.round(totalPrice * (currentInstallment - overdueInstallments) / totalInstallments);
    const overdueAmount = overdueInstallments * Math.round(totalPrice / totalInstallments);
    const conciliationPending = i === 4 || i === 23 || i === 56;
    const docIncomplete = i === 7 || i === 31 || i === 62;

    let status: Account['status'];
    let priority: Account['priority'];
    if (overdueInstallments >= 3) { status = 'vencida_3_plus'; priority = 'purple'; }
    else if (overdueInstallments === 2) { status = 'vencida_2'; priority = 'red'; }
    else if (overdueInstallments === 1) { status = 'vencida_1'; priority = 'yellow'; }
    else if (conciliationPending) { status = 'conciliacion'; priority = 'blue'; }
    else if (docIncomplete) { status = 'doc_incompleta'; priority = 'gray'; }
    else { status = 'al_corriente'; priority = 'green'; }

    const suggestedActions: Record<string, string> = {
      green: 'Sin acción requerida',
      yellow: 'Enviar recordatorio de pago',
      red: 'Llamada de seguimiento urgente',
      purple: 'Escalar a prelegal',
      blue: 'Revisar conciliación pendiente',
      gray: 'Solicitar documentación faltante',
    };

    const paymentDay = paymentDays[i % paymentDays.length];
    const exec = executives[i % 2];

    // PLD status
    let pldStatus: PLDStatus = 'validado';
    if (i === 18) pldStatus = 'pendiente_revision';
    if (i === 43) pldStatus = 'alerta_terceros';
    if (i === 65) pldStatus = 'bloqueado_pld';

    // Legal status
    let legalStatus: LegalStatus = 'sin_accion';
    if (i === 18) legalStatus = 'prelegal';
    if (i === 43) legalStatus = 'notificacion_preparacion';
    if (i === 65) legalStatus = 'vobo_juridico_pendiente';
    if (i === 92) legalStatus = 'prelegal';

    // Legal entity
    const projLEs = projectLegalEntities[proj.id];
    const leId = projLEs[i % projLEs.length];
    const legalEntity = mockLegalEntities.find(le => le.id === leId)!;

    const name = clientNames[i];
    const accId = accountIdStr(i, ct);
    const internalId = `ACC-${String(i + 1).padStart(4, '0')}`;

    // Collection comments for overdue accounts
    if (overdueInstallments > 0 || conciliationPending) {
      mockCollectionComments[internalId] = [
        {
          id: `cc-${i}-1`, accountId: internalId,
          date: '2026-03-28 14:30', author: exec,
          content: overdueInstallments >= 3
            ? 'Cliente contactado, indica que está juntando dinero. Se le dio plazo hasta fin de mes.'
            : overdueInstallments >= 2
              ? 'Se envió recordatorio urgente. Cliente dice que paga la próxima semana.'
              : conciliationPending
                ? 'Revisando conciliación con tesorería. Pago reportado pero no ubicado.'
                : 'Se envió recordatorio por WhatsApp. Sin respuesta aún.',
          result: overdueInstallments >= 2 ? 'Compromiso verbal' : 'Sin respuesta',
          nextStep: overdueInstallments >= 3 ? 'Esperar pago o escalar a legal' : 'Dar seguimiento en 3 días',
        },
        {
          id: `cc-${i}-2`, accountId: internalId,
          date: '2026-03-22 10:15', author: exec,
          content: overdueInstallments >= 2
            ? 'Segunda llamada sin éxito. Se dejó mensaje de voz.'
            : 'Se verificó que el pago no ha entrado. Se hará seguimiento.',
          result: 'Sin contacto',
          nextStep: 'Reintentar llamada',
        },
      ];
    }

    return {
      id: internalId,
      accountId: accId,
      accountNumber: `SOZU-${proj.name.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
      clabe: clabe(i),
      clientId: `cli-${i + 1}`,
      client: {
        id: `cli-${i + 1}`,
        name,
        email: `${name.split(' ')[0].toLowerCase()}.${(name.split(' ')[1] || '').toLowerCase()}@gmail.com`,
        phone: `+52 33 ${String(1000 + (i * 73) % 9000)} ${String(1000 + (i * 41) % 9000)}`,
        rfc: `${name.substring(0, 4).toUpperCase()}${80 + (i % 20)}${String(1000 + i * 7).substring(0, 4)}`,
      },
      projectId: proj.id,
      project: proj,
      building: buildings[i % buildings.length],
      unitNumber: ct === 'propiedad'
        ? `${Math.floor(i / 6) + 1}${String.fromCharCode(65 + (i % 6))}${String(101 + i).substring(0, 2)}`
        : ct === 'servicios'
          ? `S-${String(i + 1).padStart(3, '0')}`
          : `P-${String(i + 1).padStart(3, '0')}`,
      model: ct === 'propiedad' ? models[i % models.length] : '',
      totalPrice,
      paidAmount,
      balance: totalPrice - paidAmount,
      overdueAmount,
      paymentDay,
      currentInstallment,
      totalInstallments,
      overdueInstallments,
      lastPaymentDate: overdueInstallments > 0 ? randomDate('2025-10-01', '2026-01-15') : randomDate('2026-02-15', '2026-03-28'),
      nextDueDate: randomDate('2026-03-28', '2026-04-30'),
      status,
      priority,
      assignedExecutive: exec,
      seller: exec, // kept for backward compat
      legalEntity,
      chargeType: ct,
      chargeCategory: ct,
      chargeSubtype: ct,
      documentationComplete: !docIncomplete,
      conciliationPending,
      fullyReconciled: !conciliationPending && overdueInstallments === 0 && i % 5 !== 3,
      activePromise: (overdueInstallments >= 1 && i % 3 === 0) ? {
        id: `prom-${i}`,
        accountId: internalId,
        promiseDate: randomDate('2026-03-28', '2026-04-15'),
        amount: Math.round(totalPrice / totalInstallments),
        channel: (['llamada', 'whatsapp', 'email'] as const)[i % 3],
        notes: 'Cliente se compromete a realizar pago antes de la fecha indicada',
        registeredBy: exec,
        status: 'activa',
        createdAt: randomDate('2026-03-15', '2026-03-28'),
        type: overdueInstallments >= 3 ? 'rescate_penalizacion' as const : 'simple' as const,
      } : null,
      lastContactChannel: overdueInstallments > 0 ? (['email', 'whatsapp', 'llamada'] as const)[i % 3] : null,
      suggestedAction: suggestedActions[priority],
      separationDate: randomDate('2024-01-01', '2024-12-31'),
      contractDate: randomDate('2024-02-01', '2025-01-31'),
      estimatedDelivery: randomDate('2026-06-01', '2027-12-31'),
      pldStatus,
      legalStatus,
    };
  });
}

export const mockAccounts = generateAccounts();

// ── Weekly Flow vs Obra ─────────────────────────────────────────
export const mockWeeklyFlow: WeeklyFlowData[] = [
  { week: 9, range: '24 Feb – 28 Feb', projected: 1200000, collected: 1350000, obraProvision: 980000, difference: 150000, deficit: 0, status: 'ok' },
  { week: 10, range: '03 Mar – 07 Mar', projected: 1100000, collected: 980000, obraProvision: 1050000, difference: -120000, deficit: 70000, status: 'atencion' },
  { week: 11, range: '10 Mar – 14 Mar', projected: 1350000, collected: 1100000, obraProvision: 1200000, difference: -250000, deficit: 100000, status: 'alto' },
  { week: 12, range: '17 Mar – 21 Mar', projected: 1250000, collected: 850000, obraProvision: 1150000, difference: -400000, deficit: 300000, status: 'critico' },
  { week: 13, range: '24 Mar – 28 Mar', projected: 1400000, collected: 1250000, obraProvision: 1100000, difference: -150000, deficit: 0, status: 'atencion' },
  { week: 14, range: '31 Mar – 04 Abr', projected: 1300000, collected: 0, obraProvision: 1050000, difference: -1300000, deficit: 1050000, status: 'critico' },
];

// ── Financial Analytics Data ────────────────────────────────────
export const mockFinancialMetrics = {
  collectedMonth: 6480000,
  collectedYTD: 22650000,
  collectedTotal: 108500000,
  toCollectMonth: 4850000,
  toCollectTotal: 38200000,
  overdueBalance: 12750000,
  upcomingBalance: 25450000,
  reconciledAmount: 102300000,
  inReviewAmount: 2850000,
  noCEPAmount: 3350000,
  exceptionAmount: 1200000,
  recoveryRate: 81.2,
  collectedVsTarget: 89.5,
  scheduledMonth: 7200000,
  collectedByProject: [
    { project: 'Margot', collected: 6200000, toCollect: 9800000, overdue: 3200000, reconciled: 5800000, noCEP: 400000 },
    { project: 'Bottura', collected: 7850000, toCollect: 11350000, overdue: 3800000, reconciled: 7200000, noCEP: 650000 },
    { project: 'Daiku', collected: 8500000, toCollect: 12050000, overdue: 3550000, reconciled: 7900000, noCEP: 600000 },
    { project: 'Monócolo', collected: 4100000, toCollect: 5000000, overdue: 2200000, reconciled: 3800000, noCEP: 300000 },
  ],
  collectedByMonth: [
    { month: 'Oct 2025', collected: 5200000, target: 6000000, overdue: 3100000 },
    { month: 'Nov 2025', collected: 5800000, target: 6000000, overdue: 3400000 },
    { month: 'Dic 2025', collected: 4900000, target: 6000000, overdue: 3900000 },
    { month: 'Ene 2026', collected: 6500000, target: 6500000, overdue: 3500000 },
    { month: 'Feb 2026', collected: 6100000, target: 6500000, overdue: 3200000 },
    { month: 'Mar 2026', collected: 6480000, target: 7200000, overdue: 2800000 },
  ],
  periodSummary: [
    { period: 'Ene 2026', target: 6500000, collected: 6500000, pending: 0, variance: 0, pct: 100 },
    { period: 'Feb 2026', target: 6500000, collected: 6100000, pending: 400000, variance: -400000, pct: 93.8 },
    { period: 'Mar 2026', target: 7200000, collected: 6480000, pending: 720000, variance: -720000, pct: 90.0 },
  ],
  collectedByLegalEntity: [
    { entity: 'Tallwood', collected: 5200000, toCollect: 8400000, overdue: 2800000, reconciled: 4800000, noCEP: 400000 },
    { entity: 'Real Estate Ventures', collected: 4800000, toCollect: 7200000, overdue: 2500000, reconciled: 4400000, noCEP: 400000 },
    { entity: 'Komakai', collected: 4100000, toCollect: 6800000, overdue: 2200000, reconciled: 3700000, noCEP: 400000 },
    { entity: 'Corporativo Jmdq', collected: 3200000, toCollect: 5100000, overdue: 1800000, reconciled: 2900000, noCEP: 300000 },
    { entity: 'Hevi Holding', collected: 2800000, toCollect: 4500000, overdue: 1500000, reconciled: 2500000, noCEP: 300000 },
    { entity: 'DZOG CAPITAL', collected: 2550000, toCollect: 4200000, overdue: 1350000, reconciled: 2300000, noCEP: 250000 },
  ],
  collectedByChargeType: [
    { type: 'Propiedad', collected: 16200000, toCollect: 27000000, overdue: 9500000 },
    { type: 'Producto', collected: 4300000, toCollect: 7200000, overdue: 2100000 },
    { type: 'Servicio', collected: 1550000, toCollect: 3350000, overdue: 750000 },
  ],
};

export const mockKPIs: KPIData = {
  totalPortfolio: 146700000,
  currentPortfolio: 108500000,
  overduePortfolio: 38200000,
  overdueByProject: [
    { project: 'Margot', amount: 9800000 },
    { project: 'Bottura', amount: 11350000 },
    { project: 'Daiku', amount: 12050000 },
    { project: 'Monócolo', amount: 5000000 },
  ],
  accounts1Overdue: mockAccounts.filter(a => a.overdueInstallments === 1).length,
  accounts2Overdue: mockAccounts.filter(a => a.overdueInstallments === 2).length,
  accounts3PlusOverdue: mockAccounts.filter(a => a.overdueInstallments >= 3).length,
  activePromises: mockAccounts.filter(a => a.activePromise).length,
  brokenPromises: 4,
  paymentsToday: 5,
  pendingConciliation: 3,
  incompleteDocumentation: 3,
  legalCases: 2,
  monthlyRecovery: 6480000,
  agingData: [
    { range: '1-30 días', amount: 12500000, count: 12 },
    { range: '31-60 días', amount: 9200000, count: 7 },
    { range: '61-90 días', amount: 8100000, count: 5 },
    { range: '90+ días', amount: 8400000, count: 4 },
  ],
  upcomingDue7: 12,
  upcomingDue15: 22,
  upcomingDue30: 38,
};

// ── Automation rules ────────────────────────────────────────────
export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  channel: string;
  active: boolean;
  lastRun: string | null;
  runsThisMonth: number;
}

export const mockAutomationRules: AutomationRule[] = [
  { id: 'auto-1', name: 'Recordatorio día 5', trigger: 'Día de pago = 5, 5 días antes', action: 'Enviar recordatorio con resumen de cuenta', channel: 'WhatsApp + Email', active: true, lastRun: '2026-03-01', runsThisMonth: 14 },
  { id: 'auto-2', name: 'Recordatorio día 15', trigger: 'Día de pago = 15, 5 días antes', action: 'Enviar recordatorio con resumen de cuenta', channel: 'WhatsApp + Email', active: true, lastRun: '2026-03-10', runsThisMonth: 11 },
  { id: 'auto-3', name: 'Recordatorio fin de mes', trigger: 'Día de pago = 28, 5 días antes', action: 'Enviar recordatorio con resumen de cuenta', channel: 'WhatsApp + Email', active: true, lastRun: '2026-03-23', runsThisMonth: 13 },
  { id: 'auto-4', name: '1 parcialidad vencida → Alerta', trigger: '1 parcialidad vencida detectada', action: 'Notificación automática + alerta preventiva', channel: 'Email + Sistema', active: true, lastRun: '2026-03-26', runsThisMonth: 8 },
  { id: 'auto-5', name: '2 parcialidades → Seguimiento intensivo', trigger: '2 parcialidades vencidas', action: 'Notificación automática + prioridad alta + sugerir llamada', channel: 'Email + WhatsApp + Sistema', active: true, lastRun: '2026-03-25', runsThisMonth: 4 },
  { id: 'auto-6', name: '3+ vencidas → Prelegal', trigger: '3+ parcialidades vencidas', action: 'Prelegal + notificación formal + alerta legal + 30 días subsanar', channel: 'Email + WhatsApp + Sistema + Legal', active: true, lastRun: '2026-03-20', runsThisMonth: 3 },
  { id: 'auto-7', name: 'Mensaje de bienvenida', trigger: 'Registro de apartado', action: 'Enviar bienvenida + registrar en timeline', channel: 'WhatsApp + Email', active: true, lastRun: '2026-03-27', runsThisMonth: 6 },
  { id: 'auto-8', name: 'Promesa por vencer', trigger: 'Promesa a 2 días de vencer', action: 'Recordatorio de compromiso', channel: 'WhatsApp', active: true, lastRun: '2026-03-26', runsThisMonth: 9 },
  { id: 'auto-9', name: 'Promesa vencida sin pago', trigger: 'Promesa vencida sin pago registrado', action: 'Marcar incumplida + subir prioridad + alertar ejecutivo', channel: 'Sistema', active: true, lastRun: '2026-03-24', runsThisMonth: 4 },
  { id: 'auto-10', name: 'Documento crítico faltante', trigger: 'Documento crítico sin cargar > 30 días', action: 'Alerta interna + warning en cuenta', channel: 'Sistema', active: true, lastRun: '2026-03-22', runsThisMonth: 2 },
  { id: 'auto-11', name: 'Caso fuera de SLA', trigger: 'Caso abierto > SLA definido', action: 'Alertar responsable y supervisor', channel: 'Email + Sistema', active: true, lastRun: '2026-03-27', runsThisMonth: 5 },
  { id: 'auto-12', name: 'No respuesta a recordatorio', trigger: 'Sin respuesta a recordatorio 3 días', action: 'Crear tarea de llamada', channel: 'Sistema', active: true, lastRun: '2026-03-25', runsThisMonth: 11 },
  { id: 'auto-13', name: 'Alerta PLD bloqueante', trigger: 'Alerta PLD activa + intento de avanzar legal', action: 'Bloquear avance + notificar responsable PLD', channel: 'Sistema', active: true, lastRun: '2026-03-18', runsThisMonth: 1 },
  { id: 'auto-14', name: 'VoBo jurídico aprobado', trigger: 'VoBo jurídico aprobado en expediente legal', action: 'Generar envío a notario + programar entrega', channel: 'Sistema + Email', active: true, lastRun: '2026-03-15', runsThisMonth: 1 },
];

// ── Message templates ───────────────────────────────────────────
export interface MessageTemplate {
  id: string;
  name: string;
  channel: 'email' | 'whatsapp' | 'ambos';
  category: string;
  subject?: string;
  preview: string;
  variables: string[];
}

export const mockTemplates: MessageTemplate[] = [
  { id: 'tpl-1', name: 'Bienvenida', channel: 'ambos', category: 'Onboarding', subject: 'Bienvenido a SOZU', preview: 'Estimado/a {{nombre_cliente}}, bienvenido/a al proyecto {{proyecto}}...', variables: ['nombre_cliente', 'proyecto', 'unidad', 'ejecutivo', 'telefono_cobranza'] },
  { id: 'tpl-2', name: 'Cómo ingresar a la plataforma', channel: 'whatsapp', category: 'Onboarding', preview: 'Hola {{nombre_cliente}}, te compartimos cómo ingresar a tu portal: {{link_portal}}', variables: ['nombre_cliente', 'link_portal'] },
  { id: 'tpl-3', name: 'Recordatorio de pago', channel: 'ambos', category: 'Cobranza', subject: 'Recordatorio de pago — Parcialidad {{parcialidad_numero}}', preview: 'Tu pago de {{monto}} vence el día {{fecha_pago}}.', variables: ['nombre_cliente', 'monto', 'parcialidad_numero', 'fecha_pago', 'proyecto'] },
  { id: 'tpl-4', name: 'Seguimiento por falta de pago', channel: 'whatsapp', category: 'Cobranza', preview: 'Hola {{nombre_cliente}}, notamos que tu parcialidad {{parcialidad_numero}} aún no ha sido cubierta...', variables: ['nombre_cliente', 'parcialidad_numero', 'saldo_vencido'] },
  { id: 'tpl-5', name: 'Estado de cuenta', channel: 'email', category: 'Información', subject: 'Tu estado de cuenta — {{proyecto}} {{unidad}}', preview: 'Adjunto encontrarás tu estado de cuenta actualizado al {{mes}}...', variables: ['nombre_cliente', 'proyecto', 'unidad', 'mes'] },
  { id: 'tpl-6', name: 'Pago no reflejado', channel: 'ambos', category: 'Aclaraciones', subject: 'Aclaración de pago', preview: 'Estamos revisando tu pago. Te confirmaremos en breve...', variables: ['nombre_cliente', 'monto', 'fecha_pago'] },
  { id: 'tpl-7', name: 'No podré realizar mi pago', channel: 'whatsapp', category: 'Cobranza', preview: 'Entendemos tu situación, {{nombre_cliente}}. Te sugerimos agendar una llamada...', variables: ['nombre_cliente', 'ejecutivo'] },
  { id: 'tpl-8', name: 'Promesa creada', channel: 'ambos', category: 'Compromisos', subject: 'Confirmación de compromiso de pago', preview: 'Queda registrado tu compromiso de pago por {{monto}} para el {{fecha_pago}}...', variables: ['nombre_cliente', 'monto', 'fecha_pago'] },
  { id: 'tpl-9', name: 'Promesa incumplida', channel: 'ambos', category: 'Compromisos', subject: 'Compromiso de pago no cumplido', preview: 'Notamos que el compromiso de pago registrado para {{fecha_pago}} no fue cubierto...', variables: ['nombre_cliente', 'monto', 'fecha_pago'] },
  { id: 'tpl-10', name: 'Notificación 3+ parcialidades', channel: 'email', category: 'Legal', subject: 'Aviso importante — Parcialidades vencidas', preview: 'Le informamos que su cuenta presenta {{parcialidad_numero}} parcialidades vencidas...', variables: ['nombre_cliente', 'parcialidad_numero', 'saldo_vencido'] },
  { id: 'tpl-11', name: 'Entrega y escrituración', channel: 'email', category: 'Información', subject: 'Información sobre entrega', preview: 'Te compartimos la fecha estimada de entrega de tu departamento en {{proyecto}}...', variables: ['nombre_cliente', 'proyecto', 'unidad'] },
  { id: 'tpl-12', name: 'Penalidad por entrega tardía', channel: 'email', category: 'Legal', subject: 'Sobre la penalización por entrega', preview: 'Respecto a la cláusula de penalización por entrega tardía...', variables: ['nombre_cliente', 'proyecto', 'unidad'] },
  { id: 'tpl-13', name: 'Crédito hipotecario', channel: 'email', category: 'Información', subject: 'Información de crédito hipotecario', preview: 'Le compartimos la información sobre el proceso de crédito hipotecario...', variables: ['nombre_cliente', 'proyecto'] },
  { id: 'tpl-14', name: 'Solicitud de factura', channel: 'email', category: 'Información', subject: 'Factura — {{proyecto}}', preview: 'En atención a su solicitud de factura...', variables: ['nombre_cliente', 'proyecto', 'monto'] },
  { id: 'tpl-15', name: 'Devolución por pago incorrecto', channel: 'email', category: 'Aclaraciones', subject: 'Devolución de pago', preview: 'Procedemos con la devolución del monto de {{monto}}...', variables: ['nombre_cliente', 'monto'] },
  { id: 'tpl-16', name: 'Notificación formal prelegal', channel: 'email', category: 'Legal', subject: 'Notificación formal — {{proyecto}} {{unidad}}', preview: 'Por medio de la presente se le notifica formalmente...', variables: ['nombre_cliente', 'proyecto', 'unidad', 'parcialidad_numero', 'saldo_vencido'] },
];

export const templateSuggestionByCase: Record<string, string> = {
  solicitud_comprobante: 'tpl-5',
  solicitud_edo_cuenta: 'tpl-5',
  pago_no_reflejado: 'tpl-6',
  renegociacion: 'tpl-7',
  penalizacion: 'tpl-10',
  duda_entrega: 'tpl-11',
  solicitud_contrato: 'tpl-5',
  actualizacion_documental: 'tpl-5',
  aclaracion_saldo: 'tpl-6',
  aclaracion_pagos: 'tpl-6',
  entrega_escrituracion: 'tpl-11',
  penalidad_entrega_tardia: 'tpl-12',
  credito_hipotecario: 'tpl-13',
  solicitud_factura: 'tpl-14',
  devolucion_pago: 'tpl-15',
  problemas_plataforma: 'tpl-2',
  otro: 'tpl-3',
};

// ── Installments, Movements, Communications, Documents, Incidents ──
export function getInstallments(accountId: string): Installment[] {
  const account = mockAccounts.find(a => a.id === accountId);
  if (!account) return [];
  const monthlyAmount = Math.round(account.totalPrice / account.totalInstallments);
  return Array.from({ length: account.totalInstallments }, (_, i) => {
    const num = i + 1;
    const dueDate = new Date(2024, 6 + i, account.paymentDay);
    const isPaid = num < account.currentInstallment - account.overdueInstallments + 1;
    const isOverdue = !isPaid && num <= account.currentInstallment;
    return {
      id: `inst-${accountId}-${num}`,
      accountId,
      number: num,
      dueDate: dueDate.toISOString().split('T')[0],
      amount: monthlyAmount,
      status: isPaid ? 'pagado' : isOverdue ? 'vencido' : 'pendiente',
      paidDate: isPaid ? randomDate('2024-07-01', '2026-03-15') : null,
      daysOverdue: isOverdue ? Math.floor((Date.now() - dueDate.getTime()) / 86400000) : 0,
      paymentRef: isPaid ? `REF-${100000 + i * 73}` : undefined,
    };
  });
}

export function getMovements(accountId: string): FinancialMovement[] {
  const installments = getInstallments(accountId);
  const movements: FinancialMovement[] = [];
  let balance = 0;
  const account = mockAccounts.find(a => a.id === accountId);
  if (!account) return [];
  const monthlyAmount = Math.round(account.totalPrice / account.totalInstallments);

  installments.forEach((inst, i) => {
    balance += monthlyAmount;
    movements.push({
      id: `mov-c-${accountId}-${i}`, accountId, date: inst.dueDate, type: 'cargo',
      concept: `Parcialidad ${inst.number}`, amount: monthlyAmount, balance, reconciled: true,
    });
    if (inst.status === 'pagado' && inst.paidDate) {
      balance -= monthlyAmount;
      movements.push({
        id: `mov-p-${accountId}-${i}`, accountId, date: inst.paidDate, type: 'pago',
        concept: `Pago parcialidad ${inst.number}`, amount: -monthlyAmount, balance,
        reference: inst.paymentRef,
        paymentMethod: ['STP', 'Transferencia', 'STP manual'][i % 3],
        reconciled: true,
      });
    }
  });
  return movements.slice(-20);
}

export function getCommunications(accountId: string): Communication[] {
  const account = mockAccounts.find(a => a.id === accountId);
  if (!account) return [];
  return [
    { id: `com-1-${accountId}`, accountId, date: '2026-03-25', channel: 'email', direction: 'outbound', subject: 'Recordatorio de pago - Parcialidad mensual', content: 'Estimado cliente, le recordamos que su próxima fecha de pago es...', user: account.assignedExecutive, result: 'Enviado' },
    { id: `com-2-${accountId}`, accountId, date: '2026-03-20', channel: 'llamada', direction: 'outbound', subject: 'Seguimiento de saldo vencido', content: 'Se contactó al cliente para dar seguimiento al saldo vencido.', user: account.assignedExecutive, result: 'Promesa de pago registrada' },
    { id: `com-3-${accountId}`, accountId, date: '2026-03-12', channel: 'whatsapp', direction: 'outbound', subject: 'Envío de estado de cuenta', content: 'Se envió estado de cuenta actualizado al cliente vía WhatsApp.', user: account.assignedExecutive, result: 'Leído' },
    { id: `com-4-${accountId}`, accountId, date: '2026-02-28', channel: 'nota_interna', direction: 'outbound', subject: 'Revisión de expediente', content: 'Se revisó expediente completo. Documentación al corriente.', user: account.assignedExecutive },
  ];
}

export function getDocuments(accountId: string): AccountDocument[] {
  const account = mockAccounts.find(a => a.id === accountId);
  const docComplete = account?.documentationComplete ?? true;
  return [
    { id: `doc-1-${accountId}`, accountId, name: 'Identificación oficial (INE)', category: 'Identificación', status: 'validado', uploadDate: '2024-08-15', validatedBy: 'Luz Ochoa', notes: '', critical: true },
    { id: `doc-2-${accountId}`, accountId, name: 'Contrato de compraventa', category: 'Legal', status: 'validado', uploadDate: '2024-09-01', validatedBy: 'Depto. Legal', notes: 'Firmado por ambas partes', critical: true },
    { id: `doc-3-${accountId}`, accountId, name: 'Comprobante de domicilio', category: 'Identificación', status: docComplete ? 'validado' : 'pendiente', uploadDate: docComplete ? '2024-08-20' : null, validatedBy: docComplete ? 'Luz Ochoa' : null, notes: docComplete ? '' : 'Documento vencido, se requiere actualización', critical: true },
    { id: `doc-4-${accountId}`, accountId, name: 'Constancia de situación fiscal', category: 'Fiscal', status: docComplete ? 'recibido' : 'pendiente', uploadDate: docComplete ? '2024-08-25' : null, validatedBy: null, notes: '', critical: false },
    { id: `doc-5-${accountId}`, accountId, name: 'Comprobante pago de apartado', category: 'Pagos', status: 'validado', uploadDate: '2024-07-10', validatedBy: 'Tomás Peterson', notes: '', critical: true },
    { id: `doc-6-${accountId}`, accountId, name: 'CURP', category: 'Identificación', status: 'validado', uploadDate: '2024-08-16', validatedBy: 'Luz Ochoa', notes: '', critical: false },
  ];
}

export function getIncidents(accountId: string): Incident[] {
  const account = mockAccounts.find(a => a.id === accountId);
  if (!account?.conciliationPending) return [];
  return [
    { id: `inc-1-${accountId}`, accountId, type: 'pago_no_reflejado', priority: 'alta', openDate: '2026-03-22', sla: '48 horas', assignee: account.assignedExecutive, status: 'en_revision', comments: ['Cliente reporta transferencia del 20 de marzo', 'Se solicitó comprobante CEP'] },
  ];
}

// ── Search index helper ─────────────────────────────────────────
export function searchAccounts(query: string): Account[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().replace(/[-\s]/g, '');

  return mockAccounts
    .map(a => {
      let score = 0;
      const idNorm = a.accountId.toLowerCase().replace(/[-\s]/g, '');
      const clabeNorm = a.clabe;
      const nameNorm = a.client.name.toLowerCase();
      const accountNumNorm = a.accountNumber.toLowerCase().replace(/[-\s]/g, '');

      if (idNorm === q) score = 100;
      else if (idNorm.includes(q)) score = 90;
      else if (clabeNorm === q) score = 95;
      else if (clabeNorm.includes(q)) score = 85;
      else if (nameNorm === q) score = 80;
      else if (nameNorm.includes(q)) score = 70;
      else if (accountNumNorm.includes(q)) score = 75;
      else if (a.client.email.toLowerCase().includes(q)) score = 50;
      else if (a.client.phone.replace(/\s/g, '').includes(q)) score = 50;
      else if (a.project.name.toLowerCase().includes(q)) score = 40;
      else if (a.legalEntity.name.toLowerCase().includes(q)) score = 45;
      else if (a.unitNumber.toLowerCase().includes(q)) score = 35;

      return { account: a, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.account)
    .slice(0, 10);
}
