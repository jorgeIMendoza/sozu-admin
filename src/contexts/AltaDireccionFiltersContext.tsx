import { createContext, useContext, useState, ReactNode } from "react";

export type AltaDireccionFilters = {
  projectId: string | null;
  channel: string | null;
  period: string | null;
  search: string | null;
};

const DEFAULTS: AltaDireccionFilters = {
  projectId: null,
  channel: null,
  period: null,
  search: null,
};

type Ctx = {
  filters: AltaDireccionFilters;
  setFilter: <K extends keyof AltaDireccionFilters>(k: K, v: AltaDireccionFilters[K]) => void;
  resetFilters: () => void;
};

const AltaDireccionFiltersContext = createContext<Ctx | undefined>(undefined);

export function AltaDireccionFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<AltaDireccionFilters>(DEFAULTS);
  const setFilter: Ctx["setFilter"] = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const resetFilters = () => setFilters(DEFAULTS);
  return (
    <AltaDireccionFiltersContext.Provider value={{ filters, setFilter, resetFilters }}>
      {children}
    </AltaDireccionFiltersContext.Provider>
  );
}

export function useAltaDireccionFilters() {
  const ctx = useContext(AltaDireccionFiltersContext);
  if (!ctx) throw new Error("useAltaDireccionFilters must be used inside AltaDireccionFiltersProvider");
  return ctx;
}