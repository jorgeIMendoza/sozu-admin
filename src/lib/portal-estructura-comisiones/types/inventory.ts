export type UnitStatus =
  | 'available'
  | 'sold'
  | 'blocked'
  | 'aportante'
  | 'apartado'
  | 'reserved_internal';

export type AuthorizedChannel = 'internal' | 'brokers' | 'both' | 'committee' | 'invitation';

export interface InventoryUnit {
  id: string;
  projectId: string;
  unitId: string;
  tower?: string;
  level: string;
  model: string;
  sqm: number;
  listPrice: number;
  currentPrice: number;
  status: UnitStatus;
  estimatedDelivery?: string;
  createdAt: string;
  updatedAt: string;
  deptNumber?: string;
  sqmInterior?: number;
  sqmTerrace?: number;
  sqmSellable?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  storage?: number;
  orientation?: string;
  view?: string;
  pricePerSqm?: number;
  authorizedChannel?: AuthorizedChannel;
  allowedPolicyId?: string;
  maxDiscountPct?: number;
  comments?: string;
}

export type IncrementType = 'manual' | 'by_absorption' | 'by_time';
export type IncrementFrequency = 'monthly' | 'quarterly' | 'per_hit';

export interface PricingRule {
  id: string;
  projectId: string;
  model: string;
  basePrice: number;
  incrementPct: number;
  incrementType: IncrementType;
  frequency: IncrementFrequency;
  absorptionThresholdPct?: number;
  intervalMonths?: number;
  active: boolean;
  createdAt: string;
}

export interface PriceHistoryEntry {
  id: string;
  projectId: string;
  model: string;
  previousPrice: number;
  newPrice: number;
  incrementPct: number;
  rule: string;
  appliedAt: string;
}

export interface InventoryUploadLog {
  id: string;
  projectId: string;
  fileName: string;
  unitsCount: number;
  uploadedAt: string;
}

export interface InventoryKPIs {
  totalValue: number;
  averagePrice: number;
  availableUnits: number;
  soldUnits: number;
  blockedUnits: number;
  totalUnits: number;
  models: string[];
}