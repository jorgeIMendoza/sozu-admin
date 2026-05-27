import { createContext, useContext, useState, ReactNode } from "react";

export type AdministracionFilters = {
  projectId: string | null;
  channel: string | null;
  period: string | null;
  search: string | null;
};

const DEFAULTS: AdministracionFilters = {
  projectId: null,
  channel: null,
  period: null,
  search: null,
};

type Ctx = {
  filters: AdministracionFilters;
  setFilter: <K extends keyof AdministracionFilters>(k: K, v: AdministracionFilters[K]) => void;
  resetFilters: () => void;
};

const AdministracionFiltersContext = createContext<Ctx | undefined>(undefined);

export function AdministracionFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<AdministracionFilters>(DEFAULTS);
  const setFilter: Ctx["setFilter"] = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const resetFilters = () => setFilters(DEFAULTS);
  return (
    <AdministracionFiltersContext.Provider value={{ filters, setFilter, resetFilters }}>
      {children}
    </AdministracionFiltersContext.Provider>
  );
}

export function useAdministracionFilters() {
  const ctx = useContext(AdministracionFiltersContext);
  if (!ctx) throw new Error("useAdministracionFilters must be used inside AdministracionFiltersProvider");
  return ctx;
}