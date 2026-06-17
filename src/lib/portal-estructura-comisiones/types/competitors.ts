export type CompetitorType = 'directa' | 'indirecta' | 'aspiracional' | 'financiera';

export interface Competitor {
  id: string;
  name: string;
  zone: string;
  pricePerSqm: number;
  averageTicket: number;
  averageSqm: number;
  monthlyAbsorption: number;
  constructionProgressPct: number;
  mainPolicy: string;
  maxDiscountPct: number;
  type: CompetitorType;
  notes?: string;
  createdAt: string;
}

export type Diagnosis = 'competitive' | 'slightly_above' | 'overpriced' | 'opportunity';

export interface BenchmarkComparison {
  ownPricePerSqm: number;
  marketAvgPricePerSqm: number;
  diffPct: number;
  diagnosis: Diagnosis;
}