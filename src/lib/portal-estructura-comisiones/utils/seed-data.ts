import type { Project, Role, Channel, Scenario, RoleAssignment, CommercialPoliciesConfig } from '../types/simulator';

const uid = () => crypto.randomUUID();

export const defaultChannels: Channel[] = [
  { id: 'ch-inmobiliaria', name: 'Inmobiliaria Externa', externalCommissionPct: 4, minCommissionPct: 3.5, maxCommissionPct: 5, active: true },
  { id: 'ch-broker', name: 'Broker Independiente', externalCommissionPct: 2.5, minCommissionPct: 2, maxCommissionPct: 3, active: true },
  { id: 'ch-embajador', name: 'Embajador', externalCommissionPct: 1, minCommissionPct: 0.5, maxCommissionPct: 1.5, active: true },
  { id: 'ch-referido', name: 'Referido', externalCommissionPct: 1, minCommissionPct: 0.5, maxCommissionPct: 1.5, active: true },
  { id: 'ch-interno', name: 'Canal Interno', externalCommissionPct: 0, minCommissionPct: 0, maxCommissionPct: 0, active: true },
];

export const defaultRoles: Role[] = [
  { id: 'role-dir-sozu', name: 'Director SOZU', type: 'strategic', belongsTo: 'sozu_central', participatesInCommission: true },
  { id: 'role-mkt', name: 'Marketing', type: 'operative', belongsTo: 'sozu_central', participatesInCommission: false },
  { id: 'role-alianzas', name: 'Alianzas/Onboarding', type: 'operative', belongsTo: 'sozu_central', participatesInCommission: true },
  { id: 'role-data', name: 'Data & IA', type: 'support', belongsTo: 'sozu_central', participatesInCommission: false },
  { id: 'role-dir-com', name: 'Director Comercial Desarrollo', type: 'strategic', belongsTo: 'project', participatesInCommission: true },
  { id: 'role-admin-com', name: 'Admin Comercial', type: 'operative', belongsTo: 'project', participatesInCommission: true },
  { id: 'role-asesor', name: 'Asesor de Ventas', type: 'operative', belongsTo: 'project', participatesInCommission: true },
];

export const defaultProjects: Project[] = [
  {
    id: 'proj-daiku', name: 'DAIKU', totalUnits: 160, averagePrice: 11700000,
    stage: 'Preventa', startDate: '2025-01-01', endDate: '2027-12-31',
    salesStartDate: '2025-01-01', deliveryDate: '2027-12-31',
    monthlyAbsorption: 5, totalCommissionPct: 6,
    channelMix: { 'ch-inmobiliaria': 30, 'ch-broker': 25, 'ch-embajador': 15, 'ch-referido': 10, 'ch-interno': 20 },
    monthlyForecast: [3, 4, 5, 5, 6, 5, 4, 5, 6, 5, 4, 4],
  },
  {
    id: 'proj-monocolo', name: 'Monócolo', totalUnits: 145, averagePrice: 11700000,
    stage: 'Preventa', startDate: '2025-03-01', endDate: '2028-06-30',
    salesStartDate: '2025-03-01', deliveryDate: '2028-06-30',
    monthlyAbsorption: 4, totalCommissionPct: 6,
    channelMix: { 'ch-inmobiliaria': 35, 'ch-broker': 20, 'ch-embajador': 15, 'ch-referido': 10, 'ch-interno': 20 },
    monthlyForecast: [2, 3, 4, 4, 5, 4, 4, 4, 5, 4, 3, 3],
  },
  {
    id: 'proj-bottura', name: 'Bottura', totalUnits: 203, averagePrice: 2900000,
    stage: 'Preventa', startDate: '2021-02-01', endDate: '2026-07-31',
    salesStartDate: '2021-02-01', deliveryDate: '2026-07-31',
    monthlyAbsorption: 5, totalCommissionPct: 5,
    channelMix: { 'ch-inmobiliaria': 30, 'ch-broker': 25, 'ch-embajador': 15, 'ch-referido': 10, 'ch-interno': 20 },
    monthlyForecast: [3, 4, 5, 5, 6, 5, 4, 5, 6, 5, 4, 4],
  },
  {
    id: 'proj-margot', name: 'Margot', totalUnits: 322, averagePrice: 2600000,
    stage: 'Preventa', startDate: '2019-06-01', endDate: '2024-06-30',
    salesStartDate: '2019-06-01', deliveryDate: '2024-06-30',
    monthlyAbsorption: 5, totalCommissionPct: 5,
    channelMix: { 'ch-inmobiliaria': 30, 'ch-broker': 25, 'ch-embajador': 15, 'ch-referido': 10, 'ch-interno': 20 },
    monthlyForecast: [3, 4, 5, 5, 6, 5, 4, 5, 6, 5, 4, 4],
  },
];

export const defaultRoleAssignments: RoleAssignment[] = [
  { id: uid(), roleId: 'role-dir-sozu', projectId: null, headcount: 1, baseSalary: 80000, fixedBonus: 0, benefitsPct: 35 },
  { id: uid(), roleId: 'role-mkt', projectId: null, headcount: 2, baseSalary: 35000, fixedBonus: 0, benefitsPct: 30 },
  { id: uid(), roleId: 'role-alianzas', projectId: null, headcount: 1, baseSalary: 40000, fixedBonus: 5000, benefitsPct: 30 },
  { id: uid(), roleId: 'role-data', projectId: null, headcount: 1, baseSalary: 45000, fixedBonus: 0, benefitsPct: 30 },
  { id: uid(), roleId: 'role-dir-com', projectId: 'proj-daiku', headcount: 1, baseSalary: 55000, fixedBonus: 10000, benefitsPct: 35 },
  { id: uid(), roleId: 'role-admin-com', projectId: 'proj-daiku', headcount: 1, baseSalary: 25000, fixedBonus: 0, benefitsPct: 30 },
  { id: uid(), roleId: 'role-asesor', projectId: 'proj-daiku', headcount: 3, baseSalary: 18000, fixedBonus: 0, benefitsPct: 30 },
  { id: uid(), roleId: 'role-dir-com', projectId: 'proj-monocolo', headcount: 1, baseSalary: 55000, fixedBonus: 10000, benefitsPct: 35 },
  { id: uid(), roleId: 'role-admin-com', projectId: 'proj-monocolo', headcount: 1, baseSalary: 25000, fixedBonus: 0, benefitsPct: 30 },
  { id: uid(), roleId: 'role-asesor', projectId: 'proj-monocolo', headcount: 2, baseSalary: 18000, fixedBonus: 0, benefitsPct: 30 },
];

export const defaultScenarios: Scenario[] = [
  {
    id: 'sc-externo', name: 'Enfoque Externo',
    description: '70% de ventas a través de canales externos',
    projectIds: ['proj-daiku', 'proj-monocolo'],
    commissionMode: 'on_sale_value', totalCommissionPct: 6,
    channelMix: { 'ch-inmobiliaria': 35, 'ch-broker': 25, 'ch-embajador': 10, 'ch-referido': 5, 'ch-interno': 25 },
    channelExternalPcts: { 'ch-inmobiliaria': 4, 'ch-broker': 2.5, 'ch-embajador': 1, 'ch-referido': 1, 'ch-interno': 0 },
    commissionRules: [],
    roleAssignments: defaultRoleAssignments,
    monthlyUnits: [5, 7, 9, 9, 11, 9, 8, 9, 11, 9, 7, 7],
    isGroup: true,
  },
  {
    id: 'sc-balanceado', name: 'Balanceado',
    description: '40% canal interno, balance entre externo e interno',
    projectIds: ['proj-daiku', 'proj-monocolo'],
    commissionMode: 'on_sale_value', totalCommissionPct: 6,
    channelMix: { 'ch-inmobiliaria': 20, 'ch-broker': 15, 'ch-embajador': 10, 'ch-referido': 15, 'ch-interno': 40 },
    channelExternalPcts: { 'ch-inmobiliaria': 4, 'ch-broker': 2.5, 'ch-embajador': 1, 'ch-referido': 1, 'ch-interno': 0 },
    commissionRules: [],
    roleAssignments: defaultRoleAssignments,
    monthlyUnits: [5, 7, 9, 9, 11, 9, 8, 9, 11, 9, 7, 7],
    isGroup: true,
  },
];

export const defaultCommercialPolicies: CommercialPoliciesConfig = {
  enabled: true,
  policies: [
    { id: 'cp-1', name: 'Conservadora', downPaymentPct: 30, installmentsPct: 40, deliveryPct: 30, mixPct: 20, discountPct: 0 },
    { id: 'cp-2', name: 'Moderada', downPaymentPct: 35, installmentsPct: 35, deliveryPct: 30, mixPct: 25, discountPct: 1 },
    { id: 'cp-3', name: 'Estándar', downPaymentPct: 40, installmentsPct: 30, deliveryPct: 30, mixPct: 20, discountPct: 2 },
    { id: 'cp-4', name: 'Agresiva', downPaymentPct: 50, installmentsPct: 20, deliveryPct: 30, mixPct: 15, discountPct: 3 },
    { id: 'cp-5', name: 'Flexible', downPaymentPct: 20, installmentsPct: 50, deliveryPct: 30, mixPct: 20, discountPct: 0 },
  ],
  discountHistory: [],
};