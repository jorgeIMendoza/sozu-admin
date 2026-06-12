// ── Reventa: tipos, datos mock e helpers ──
// Flujo de habilitación de reventa post-entrega.
// Calcula 3 escenarios de precio, utilidad neta, ROI, TIR, ISR estimado.

import { create } from "zustand";
import type { InvestmentProperty } from "@/lib/offers/mock-data";

// ── Constantes parametrizables ──
// La comisión es VARIABLE según condiciones SOZU (temporada, cliente, mercado).
// Por default 5% + IVA 16%.
export const RESALE_CONFIG = {
  commissionRate: 0.05,
  ivaRate: 0.16,
  conservativeDiscount: 0.05,
  aggressivePremium: 0.06,
  isrRateRange: { min: 0.10, max: 0.18 },
  exclusivityMonths: 6,
  cancellationDays: 5,
  defaultYearsHeld: 1.5,
};

// ── Escenarios de precio ──

export type ScenarioId = "conservador" | "sugerido" | "agresivo";

export interface ResaleScenario {
  id: ScenarioId;
  label: string;
  tagline: string;
  pricePerM2: number;
  totalPrice: number;
  commission: number;
  ivaOnCommission: number;
  totalDeductions: number;
  netToClient: number;
  grossProfit: number;
  estimatedISRRange: { min: number; max: number };
  urgencyTier: "high" | "balanced" | "premium";
  recommended: boolean;
}

// ── Rendimiento ──

export interface ResaleEarnings {
  initialInvestment: number;
  netSale: number;
  grossAppreciation: number;
  grossAppreciationPct: number;
  netProfit: number;
  roiNet: number;
  irr: number;
  yearsHeld: number;
}

// ── Proceso ──

export type SignatureStatus =
  | "not_started"
  | "contract_generated"
  | "contract_accepted"
  | "client_signing"
  | "client_signed"
  | "sozu_signing"
  | "completed";

export interface ContractBinding {
  clientFullName: string;
  clientRFC: string;
  clientEmail: string;
  propertyAddress: string;
  unitNumber: string;
  projectName: string;
  m2: number;
  selectedScenarioId: ScenarioId;
  listingPrice: number;
  commissionRate: number;
  ivaRate: number;
  exclusivityMonths: number;
  cancellationDays: number;
  generatedAt: string;
}

export interface ResaleProcess {
  propertyId: string;
  status: SignatureStatus;
  selectedScenarioId?: ScenarioId;
  contract?: ContractBinding;
  mifielDocumentId?: string;
  clientSignedAt?: string;
  sozuSignedAt?: string;
  completedAt?: string;
}

// ── Datos de crecimiento histórico del proyecto ──

export interface ProjectGrowthPoint {
  monthKey: string;
  monthDisplay: string;
  pricePerM2: number;
  label?: "start" | "end";
}

export interface ProjectGrowthData {
  projectName: string;
  points: ProjectGrowthPoint[];
  cagr: number;
}

function calcCAGR(start: number, end: number, months: number): number {
  return (Math.pow(end / start, 12 / months) - 1) * 100;
}

const margotPoints: ProjectGrowthPoint[] = [
  { monthKey: "2023-01", monthDisplay: "Ene '23", pricePerM2: 35000, label: "start" },
  { monthKey: "2023-04", monthDisplay: "Abr '23", pricePerM2: 37500 },
  { monthKey: "2023-07", monthDisplay: "Jul '23", pricePerM2: 39800 },
  { monthKey: "2023-10", monthDisplay: "Oct '23", pricePerM2: 42200 },
  { monthKey: "2024-01", monthDisplay: "Ene '24", pricePerM2: 44500 },
  { monthKey: "2024-04", monthDisplay: "Abr '24", pricePerM2: 47000 },
  { monthKey: "2024-07", monthDisplay: "Jul '24", pricePerM2: 50256, label: "end" },
];

const margotGrowth: ProjectGrowthData = {
  projectName: "Margot",
  points: margotPoints,
  cagr: calcCAGR(35000, 50256, 18),
};

export function getProjectGrowthData(projectName: string): ProjectGrowthData | undefined {
  if (projectName.toLowerCase().includes("margot")) return margotGrowth;
  return undefined;
}

// ── Mock store ──

interface ResaleState {
  processes: Record<string, ResaleProcess>;
  ensure: (propertyId: string) => void;
  setSelectedScenario: (propertyId: string, scenarioId: ScenarioId) => void;
  generateContract: (propertyId: string, contract: ContractBinding) => void;
  acceptContract: (propertyId: string) => void;
  startSignature: (propertyId: string) => void;
  completeSignature: (propertyId: string) => void;
  resetResaleProcess: (propertyId: string) => void;
}

export const useResaleStore = create<ResaleState>((set, get) => ({
  processes: {},
  ensure: (propertyId) => {
    if (get().processes[propertyId]) return;
    set({
      processes: { ...get().processes, [propertyId]: { propertyId, status: "not_started" } },
    });
  },
  setSelectedScenario: (propertyId, scenarioId) => {
    const cur = get().processes[propertyId] ?? { propertyId, status: "not_started" as SignatureStatus };
    set({ processes: { ...get().processes, [propertyId]: { ...cur, selectedScenarioId: scenarioId } } });
  },
  generateContract: (propertyId, contract) => {
    const cur = get().processes[propertyId] ?? { propertyId, status: "not_started" as SignatureStatus };
    set({
      processes: {
        ...get().processes,
        [propertyId]: {
          ...cur,
          contract,
          status: "contract_generated",
          mifielDocumentId: `MIFIEL-MOCK-${Date.now().toString(36).toUpperCase()}`,
        },
      },
    });
  },
  acceptContract: (propertyId) => {
    const cur = get().processes[propertyId];
    if (!cur) return;
    set({ processes: { ...get().processes, [propertyId]: { ...cur, status: "contract_accepted" } } });
  },
  startSignature: (propertyId) => {
    const cur = get().processes[propertyId];
    if (!cur) return;
    set({ processes: { ...get().processes, [propertyId]: { ...cur, status: "client_signing" } } });
  },
  completeSignature: (propertyId) => {
    const now = new Date().toISOString();
    const cur = get().processes[propertyId];
    if (!cur) return;
    set({
      processes: {
        ...get().processes,
        [propertyId]: {
          ...cur,
          status: "completed",
          clientSignedAt: now,
          sozuSignedAt: now,
          completedAt: now,
        },
      },
    });
  },
  resetResaleProcess: (propertyId) => {
    const next = { ...get().processes };
    delete next[propertyId];
    set({ processes: next });
  },
}));

// ── Helpers ──

/** Parses area like "78.0 m²" → 78. */
export function parseAreaM2(area: string | number): number {
  if (typeof area === "number") return area;
  const n = parseFloat(area);
  return Number.isFinite(n) ? n : 0;
}

// ── Cálculos ──

export function calculateScenarios(property: InvestmentProperty): ResaleScenario[] {
  const m2 = parseAreaM2(property.property.area);
  const initialPrice = property.financials.initialPrice;
  const suggestedTotal = property.financials.currentEstimatedValue;

  const build = (
    id: ScenarioId, label: string, tagline: string,
    totalPrice: number, urgencyTier: "high" | "balanced" | "premium",
    recommended: boolean
  ): ResaleScenario => {
    const commission = totalPrice * RESALE_CONFIG.commissionRate;
    const ivaOnCommission = commission * RESALE_CONFIG.ivaRate;
    const totalDeductions = commission + ivaOnCommission;
    const netToClient = totalPrice - totalDeductions;
    const grossProfit = netToClient - initialPrice;
    const profitForISR = Math.max(0, totalPrice - initialPrice);
    return {
      id, label, tagline,
      pricePerM2: m2 > 0 ? totalPrice / m2 : 0,
      totalPrice, commission, ivaOnCommission, totalDeductions,
      netToClient, grossProfit,
      estimatedISRRange: {
        min: profitForISR * RESALE_CONFIG.isrRateRange.min,
        max: profitForISR * RESALE_CONFIG.isrRateRange.max,
      },
      urgencyTier, recommended,
    };
  };

  return [
    build("conservador", "Conservador", "Vende en ≤30 días",
      suggestedTotal * (1 - RESALE_CONFIG.conservativeDiscount), "high", false),
    build("sugerido", "Sugerido", "Balance precio/tiempo",
      suggestedTotal, "balanced", true),
    build("agresivo", "Agresivo", "Premium, 60–120 días",
      suggestedTotal * (1 + RESALE_CONFIG.aggressivePremium), "premium", false),
  ];
}

export function calculateEarnings(
  property: InvestmentProperty,
  scenario: ResaleScenario,
  yearsHeld: number = RESALE_CONFIG.defaultYearsHeld
): ResaleEarnings {
  const initial = property.financials.initialPrice;
  const grossAppreciation = scenario.totalPrice - initial;
  const grossAppreciationPct = (grossAppreciation / initial) * 100;
  const netProfit = scenario.netToClient - initial;
  const roiNet = (netProfit / initial) * 100;
  const irr = (Math.pow(scenario.netToClient / initial, 1 / yearsHeld) - 1) * 100;
  return {
    initialInvestment: initial,
    netSale: scenario.netToClient,
    grossAppreciation, grossAppreciationPct,
    netProfit, roiNet, irr, yearsHeld,
  };
}

export function generateContractBinding(
  property: InvestmentProperty, scenario: ResaleScenario
): ContractBinding {
  return {
    clientFullName: "Alejandro García",
    clientRFC: "GARC900101ABC",
    clientEmail: "alejandro.garcia@example.com",
    propertyAddress:
      property.property.address ?? property.property.location ?? "Guadalajara, Jalisco",
    unitNumber: property.property.unitNumber,
    projectName: property.property.projectName,
    m2: parseAreaM2(property.property.area),
    selectedScenarioId: scenario.id,
    listingPrice: scenario.totalPrice,
    commissionRate: RESALE_CONFIG.commissionRate,
    ivaRate: RESALE_CONFIG.ivaRate,
    exclusivityMonths: RESALE_CONFIG.exclusivityMonths,
    cancellationDays: RESALE_CONFIG.cancellationDays,
    generatedAt: new Date().toISOString(),
  };
}

// ── Operaciones sobre el proceso ──

export function getOrCreateResaleProcess(propertyId: string): ResaleProcess {
  const store = useResaleStore.getState();
  if (!store.processes[propertyId]) store.ensure(propertyId);
  return useResaleStore.getState().processes[propertyId];
}

export function useResaleProcess(propertyId: string): ResaleProcess | undefined {
  return useResaleStore((s) => s.processes[propertyId]);
}

export function setSelectedScenario(propertyId: string, scenarioId: ScenarioId): void {
  useResaleStore.getState().setSelectedScenario(propertyId, scenarioId);
}

export function generateContract(propertyId: string, contract: ContractBinding): void {
  useResaleStore.getState().generateContract(propertyId, contract);
}

export function acceptContract(propertyId: string): void {
  useResaleStore.getState().acceptContract(propertyId);
}

// SWAP POINT MIFIEL: en producción reemplazar por integración real.
export async function simulateClientSignature(propertyId: string): Promise<void> {
  useResaleStore.getState().startSignature(propertyId);
  await new Promise((r) => setTimeout(r, 2500));
  useResaleStore.getState().completeSignature(propertyId);
}

// DEMO ONLY
export function resetResaleProcess(propertyId: string): void {
  useResaleStore.getState().resetResaleProcess(propertyId);
}
