export interface Project {
  id: string;
  name: string;
  totalUnits: number;
  averagePrice: number;
  stage: string;
  startDate: string;
  endDate: string;
  salesStartDate: string;
  deliveryDate: string;
  monthlyAbsorption: number;
  totalCommissionPct: number;
  channelMix: Record<string, number>;
  monthlyForecast: number[];
}

export type RoleType = 'strategic' | 'operative' | 'support';
export type RoleBelongsTo = 'sozu_central' | 'project';

export interface Role {
  id: string;
  name: string;
  type: RoleType;
  belongsTo: RoleBelongsTo;
  participatesInCommission: boolean;
}

export interface RoleAssignment {
  id: string;
  roleId: string;
  projectId: string | null;
  headcount: number;
  baseSalary: number;
  fixedBonus: number;
  benefitsPct: number;
}

export interface ChannelProfile {
  shortDescription?: string;
  longDescription?: string;
  objective?: string;
  idealProfile?: string;
  requirements?: string[];
  benefits?: string[];
  restrictions?: string[];
  baseCommission?: string;
  maxCommission?: string;
  inventoryAccess?: string;
  materialsAccess?: string;
  attentionPriority?: string;
  color?: string;
  badge?: string;
  icon?: string;
  imageUrl?: string;
  blocks?: {
    general?: boolean;
    requirements?: boolean;
    benefits?: boolean;
    restrictions?: boolean;
    visual?: boolean;
  };
}

export interface ChannelHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: 'created' | 'updated' | 'activated' | 'deactivated' | 'deleted' | 'duplicated';
  field?: string;
  previousValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
  note?: string;
}

export interface Channel {
  id: string;
  name: string;
  externalCommissionPct: number;
  minCommissionPct: number;
  maxCommissionPct: number;
  active: boolean;
  profile?: ChannelProfile;
  code?: string;
  description?: string;
  category?: string;
  baseCommissionPct?: number;
  participatesInScaling?: boolean;
  participatesInBonuses?: boolean;
  participatesInSimulators?: boolean;
  requiresOnboarding?: boolean;
  requiresTraining?: boolean;
  requiresApproval?: boolean;
  leadProtectionDays?: number;
  history?: ChannelHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export type CommissionMode = 'on_sale_value' | 'on_internal_remainder';

export interface CommissionRule {
  id: string;
  scenarioId: string;
  channelId: string;
  roleId: string;
  percentage: number;
  pool: 'sozu' | 'project';
}

/** Config real del Motor de Comisiones — única y global, independiente de escenarios de simulación. Siempre Modo A (sobre venta); solo los Escenarios de Simulación permiten Modo B. */
export interface MotorConfig {
  totalCommissionPct: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  projectIds: string[];
  commissionMode: CommissionMode;
  totalCommissionPct: number;
  channelMix: Record<string, number>;
  channelExternalPcts: Record<string, number>;
  commissionRules: CommissionRule[];
  roleAssignments: RoleAssignment[];
  monthlyUnits: number[];
  isGroup: boolean;
}

export interface ScenarioResults {
  scenarioId: string;
  totalSalesAmount: number;
  totalCommissionAmount: number;
  totalExternalCommission: number;
  totalInternalCommission: number;
  monthlyFixedCost: number;
  monthlyVariableCost: number;
  sozuMargin: number;
  projectMargin: number;
  cacCommercial: number;
  costPerUnit: number;
  sozuNetProfit: number;
  payoutRatio: Record<string, number>;
  channelBreakdown: ChannelBreakdown[];
  roleBreakdown: RoleBreakdown[];
  monthlyPL: MonthlyPL[];
}

export interface ChannelBreakdown {
  channelId: string;
  channelName: string;
  salesPct: number;
  salesAmount: number;
  totalCommission: number;
  externalCommission: number;
  internalCommission: number;
  rolePayments: { roleId: string; roleName: string; amount: number; pct: number }[];
}

export interface RoleBreakdown {
  roleId: string;
  roleName: string;
  pool: 'sozu' | 'project';
  headcount: number;
  baseSalary: number;
  totalFixedCost: number;
  totalCommissionEarned: number;
  totalCost: number;
  payoutRatio: number;
}

export interface MonthlyPL {
  month: number;
  label: string;
  units: number;
  salesAmount: number;
  totalCommission: number;
  externalCommission: number;
  internalCommission: number;
  fixedCosts: number;
  variableCosts: number;
  sozuMargin: number;
  netProfit: number;
}

export interface CommercialPolicy {
  id: string;
  name: string;
  downPaymentPct: number;
  installmentsPct: number;
  deliveryPct: number;
  mixPct: number;
  discountPct: number;
}

export interface PolicyDiscountChange {
  id: string;
  policyId: string;
  policyName: string;
  previousDiscount: number;
  newDiscount: number;
  user: string;
  timestamp: string;
}

export interface CommercialPoliciesConfig {
  enabled: boolean;
  policies: CommercialPolicy[];
  discountHistory?: PolicyDiscountChange[];
}

export interface WeightedCollectionKPIs {
  weightedDownPayment: number;
  weightedInstallments: number;
  weightedDelivery: number;
  avgInitialCollection: number;
  avgDeferredCollection: number;
  avgFinalCollection: number;
}

export interface AppState {
  projects: Project[];
  roles: Role[];
  channels: Channel[];
  scenarios: Scenario[];
  roleAssignments: RoleAssignment[];
  commercialPolicies: CommercialPoliciesConfig;
  /** Matriz de comisión por canal × puesto — única y compartida, independiente de escenario. */
  commissionRules: CommissionRule[];
  /** Config real del Motor de Comisiones (Modo A/B + Comisión Total) — única y compartida, independiente de escenario. */
  motorConfig: MotorConfig;
}