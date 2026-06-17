export type MeasurementPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface VolumeRule {
  id: string;
  name: string;
  period: MeasurementPeriod;
  minUnits: number;
  maxUnits: number | null;
  commissionPct: number;
  incrementalPct: number;
  description: string;
  validFrom: string;
  validTo: string;
  active: boolean;
}

export interface SaleAmountRule {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  bonusPct: number;
  description: string;
  validFrom: string;
  validTo: string;
  active: boolean;
}

export interface DownPaymentRule {
  id: string;
  name: string;
  minPct: number;
  maxPct: number | null;
  bonusPct: number;
  description: string;
  validFrom: string;
  validTo: string;
  active: boolean;
}

export interface BrokerIncentiveConfig {
  baseCommissionPct: number;
  volumeEnabled: boolean;
  saleAmountEnabled: boolean;
  downPaymentEnabled: boolean;
  volumeRules: VolumeRule[];
  saleAmountRules: SaleAmountRule[];
  downPaymentRules: DownPaymentRule[];
}

export interface BrokerSimulation {
  unitPrice: number;
  unitsSold: number;
  downPaymentPct: number;
  period: MeasurementPeriod;
}

export interface OperationInput {
  id: string;
  unitPrice: number;
  downPaymentPct: number;
  date: string;
  label: string;
}

export interface DownPaymentEvaluation {
  ruleId: string | null;
  ruleName: string | null;
  ruleCondition: string | null;
  operationDownPaymentPct: number;
  meetsCondition: boolean;
  bonusPct: number;
  reason: string;
}

export interface OperationBreakdown {
  operationId: string;
  operationLabel: string;
  unitPrice: number;
  downPaymentPct: number;
  date: string;
  baseCommission: number;
  volumeBonus: number;
  saleAmountBonus: number;
  downPaymentEvaluation: DownPaymentEvaluation;
  downPaymentBonus: number;
  finalCommission: number;
  finalAmount: number;
  appliedRules: string[];
}

export interface BrokerCommissionBreakdown {
  baseCommission: number;
  volumeBonus: number;
  saleAmountBonus: number;
  downPaymentBonus: number;
  finalCommission: number;
  appliedRules: string[];
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  brokerName: string;
  channelId: string;
  period: MeasurementPeriod;
  accumulatedSales: number;
  saleAmount: number;
  downPaymentPct: number;
  baseCommission: number;
  volumeBonus: number;
  saleAmountBonus: number;
  downPaymentBonus: number;
  finalCommission: number;
  finalAmount: number;
  appliedRuleIds: string[];
  appliedRuleNames: string[];
  operationId?: string;
  operationLabel?: string;
  downPaymentEvaluation?: DownPaymentEvaluation;
}

export const DEFAULT_BROKER_CONFIG: BrokerIncentiveConfig = {
  baseCommissionPct: 2.0,
  volumeEnabled: true,
  saleAmountEnabled: true,
  downPaymentEnabled: true,
  volumeRules: [
    {
      id: 'vr-1', name: 'Nivel Inicial', period: 'semiannual',
      minUnits: 1, maxUnits: 2, commissionPct: 2.0, incrementalPct: 0,
      description: '1–2 departamentos en el semestre',
      validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
    },
    {
      id: 'vr-2', name: 'Nivel Intermedio', period: 'semiannual',
      minUnits: 3, maxUnits: 4, commissionPct: 2.5, incrementalPct: 0.5,
      description: '3–4 departamentos en el semestre',
      validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
    },
    {
      id: 'vr-3', name: 'Nivel Alto', period: 'semiannual',
      minUnits: 5, maxUnits: null, commissionPct: 3.0, incrementalPct: 1.0,
      description: '5 o más departamentos en el semestre',
      validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
    },
  ],
  saleAmountRules: [
    {
      id: 'sa-1', name: 'Bono Premium', minAmount: 15000000, maxAmount: 18000000,
      bonusPct: 0.25, description: 'Ventas desde $15M',
      validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
    },
    {
      id: 'sa-2', name: 'Bono Premium Plus', minAmount: 18000000, maxAmount: null,
      bonusPct: 0.5, description: 'Ventas desde $18M',
      validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
    },
  ],
  downPaymentRules: [
    {
      id: 'dp-1', name: 'Enganche Alto', minPct: 40, maxPct: 50,
      bonusPct: 0.25, description: '40% de enganche',
      validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
    },
    {
      id: 'dp-2', name: 'Enganche Premium', minPct: 50, maxPct: null,
      bonusPct: 0.5, description: '50%+ de enganche',
      validFrom: '2025-01-01', validTo: '2025-12-31', active: true,
    },
  ],
};