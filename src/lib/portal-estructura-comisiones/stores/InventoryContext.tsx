import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { InventoryUnit, PricingRule, PriceHistoryEntry, InventoryUploadLog } from '../types/inventory';

const STORAGE_KEY = 'sozu-ec-inventory-state';

interface InventoryState {
  units: InventoryUnit[];
  pricingRules: PricingRule[];
  priceHistory: PriceHistoryEntry[];
  uploadLogs: InventoryUploadLog[];
}

interface InventoryContextType extends InventoryState {
  importUnits: (projectId: string, units: InventoryUnit[], fileName: string) => void;
  updateUnit: (unit: InventoryUnit) => void;
  deleteUnit: (id: string) => void;
  getProjectUnits: (projectId: string) => InventoryUnit[];
  addPricingRule: (rule: PricingRule) => void;
  updatePricingRule: (rule: PricingRule) => void;
  deletePricingRule: (id: string) => void;
  getProjectRules: (projectId: string) => PricingRule[];
  applyIncrement: (projectId: string, model: string, incrementPct: number, ruleName: string) => void;
  simulateIncrement: (projectId: string, model: string, incrementPct: number) => { unitId: string; current: number; simulated: number }[];
  getProjectHistory: (projectId: string) => PriceHistoryEntry[];
  getProjectLogs: (projectId: string) => InventoryUploadLog[];
}

const InventoryContext = createContext<InventoryContextType | null>(null);

function loadState(): InventoryState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { units: [], pricingRules: [], priceHistory: [], uploadLogs: [] };
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InventoryState>(loadState);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  const update = useCallback((fn: (s: InventoryState) => InventoryState) => setState(prev => fn(prev)), []);

  const importUnits = useCallback((projectId: string, newUnits: InventoryUnit[], fileName: string) => {
    update(s => {
      const filtered = s.units.filter(u => u.projectId !== projectId);
      const log: InventoryUploadLog = {
        id: crypto.randomUUID(), projectId, fileName,
        unitsCount: newUnits.length, uploadedAt: new Date().toISOString(),
      };
      return { ...s, units: [...filtered, ...newUnits], uploadLogs: [...s.uploadLogs, log] };
    });
  }, [update]);

  const updateUnit = useCallback((unit: InventoryUnit) => {
    update(s => ({ ...s, units: s.units.map(u => u.id === unit.id ? { ...unit, updatedAt: new Date().toISOString() } : u) }));
  }, [update]);

  const deleteUnit = useCallback((id: string) => update(s => ({ ...s, units: s.units.filter(u => u.id !== id) })), [update]);
  const getProjectUnits = useCallback((projectId: string) => state.units.filter(u => u.projectId === projectId), [state.units]);
  const addPricingRule = useCallback((rule: PricingRule) => update(s => ({ ...s, pricingRules: [...s.pricingRules, rule] })), [update]);
  const updatePricingRule = useCallback((rule: PricingRule) =>
    update(s => ({ ...s, pricingRules: s.pricingRules.map(r => r.id === rule.id ? rule : r) })), [update]);
  const deletePricingRule = useCallback((id: string) => update(s => ({ ...s, pricingRules: s.pricingRules.filter(r => r.id !== id) })), [update]);
  const getProjectRules = useCallback((projectId: string) => state.pricingRules.filter(r => r.projectId === projectId), [state.pricingRules]);

  const applyIncrement = useCallback((projectId: string, model: string, incrementPct: number, ruleName: string) => {
    update(s => {
      const now = new Date().toISOString();
      const newUnits = s.units.map(u => {
        if (u.projectId !== projectId || u.model !== model) return u;
        const newPrice = Math.round(u.currentPrice * (1 + incrementPct / 100));
        return { ...u, currentPrice: newPrice, updatedAt: now };
      });
      const affected = s.units.filter(u => u.projectId === projectId && u.model === model);
      const historyEntries: PriceHistoryEntry[] = affected.map(u => ({
        id: crypto.randomUUID(), projectId, model,
        previousPrice: u.currentPrice,
        newPrice: Math.round(u.currentPrice * (1 + incrementPct / 100)),
        incrementPct, rule: ruleName, appliedAt: now,
      }));
      return { ...s, units: newUnits, priceHistory: [...s.priceHistory, ...historyEntries] };
    });
  }, [update]);

  const simulateIncrement = useCallback((projectId: string, model: string, incrementPct: number) =>
    state.units.filter(u => u.projectId === projectId && u.model === model).map(u => ({
      unitId: u.unitId, current: u.currentPrice,
      simulated: Math.round(u.currentPrice * (1 + incrementPct / 100)),
    })), [state.units]);

  const getProjectHistory = useCallback((projectId: string) => state.priceHistory.filter(h => h.projectId === projectId), [state.priceHistory]);
  const getProjectLogs = useCallback((projectId: string) => state.uploadLogs.filter(l => l.projectId === projectId), [state.uploadLogs]);

  const ctx: InventoryContextType = {
    ...state, importUnits, updateUnit, deleteUnit, getProjectUnits,
    addPricingRule, updatePricingRule, deletePricingRule, getProjectRules,
    applyIncrement, simulateIncrement, getProjectHistory, getProjectLogs,
  };

  return <InventoryContext.Provider value={ctx}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}