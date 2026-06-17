import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Competitor } from '../types/competitors';

const STORAGE_KEY = 'sozu-ec-competitors-state';

export interface ImportLog {
  id: string; date: string; user: string; fileName: string;
  imported: number; updated: number; skipped: number; errors: number;
}

interface CompetitorsState {
  competitors: Competitor[];
  importHistory: ImportLog[];
}

interface CompetitorsContextType extends CompetitorsState {
  addCompetitor: (c: Competitor) => void;
  updateCompetitor: (c: Competitor) => void;
  deleteCompetitor: (id: string) => void;
  logImport: (log: ImportLog) => void;
}

const Ctx = createContext<CompetitorsContextType | null>(null);

const seed: Competitor[] = [
  {
    id: 'demo-1', name: 'Vista Reforma', zone: 'Polanco',
    pricePerSqm: 95000, averageTicket: 9500000, averageSqm: 100,
    monthlyAbsorption: 4, constructionProgressPct: 45,
    mainPolicy: '30/60/10', maxDiscountPct: 5, type: 'directa',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-2', name: 'Torre Altura', zone: 'Roma Norte',
    pricePerSqm: 88000, averageTicket: 7900000, averageSqm: 90,
    monthlyAbsorption: 6, constructionProgressPct: 70,
    mainPolicy: '25/35/40', maxDiscountPct: 8, type: 'directa',
    createdAt: new Date().toISOString(),
  },
];

function load(): CompetitorsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { competitors: parsed.competitors ?? seed, importHistory: parsed.importHistory ?? [] };
    }
  } catch { /* */ }
  return { competitors: seed, importHistory: [] };
}

export function CompetitorsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CompetitorsState>(load);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  const addCompetitor = useCallback((c: Competitor) => setState(s => ({ ...s, competitors: [...s.competitors, c] })), []);
  const updateCompetitor = useCallback((c: Competitor) => setState(s => ({ ...s, competitors: s.competitors.map(x => x.id === c.id ? c : x) })), []);
  const deleteCompetitor = useCallback((id: string) => setState(s => ({ ...s, competitors: s.competitors.filter(x => x.id !== id) })), []);
  const logImport = useCallback((log: ImportLog) => setState(s => ({ ...s, importHistory: [log, ...s.importHistory].slice(0, 50) })), []);

  return <Ctx.Provider value={{ ...state, addCompetitor, updateCompetitor, deleteCompetitor, logImport }}>{children}</Ctx.Provider>;
}

export function useCompetitors() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCompetitors must be used within CompetitorsProvider');
  return v;
}