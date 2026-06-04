import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useCondominios } from "@/hooks/condominio/useCondominioData";
import type { CondominioRef } from "@/types/condominio";

const STORAGE_KEY = "condominio.proyectoId";

interface CondominioContextValue {
  condominios: CondominioRef[];
  proyectoId: number | null;
  setProyectoId: (id: number) => void;
  isLoading: boolean;
  error: unknown;
}

const CondominioContext = createContext<CondominioContextValue | undefined>(undefined);

export function CondominioProvider({ children }: { children: ReactNode }) {
  const { data: condominios = [], isLoading, error } = useCondominios();
  const [proyectoId, setProyectoIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  // Default: primer condominio disponible si no hay selección válida.
  useEffect(() => {
    if (condominios.length === 0) return;
    const valido = proyectoId != null && condominios.some((c) => c.id === proyectoId);
    if (!valido) {
      setProyectoIdState(condominios[0].id);
      localStorage.setItem(STORAGE_KEY, String(condominios[0].id));
    }
  }, [condominios, proyectoId]);

  const setProyectoId = (id: number) => {
    setProyectoIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const value = useMemo<CondominioContextValue>(
    () => ({ condominios, proyectoId, setProyectoId, isLoading, error }),
    [condominios, proyectoId, isLoading, error],
  );

  return <CondominioContext.Provider value={value}>{children}</CondominioContext.Provider>;
}

export function useCondominio() {
  const ctx = useContext(CondominioContext);
  if (!ctx) throw new Error("useCondominio debe usarse dentro de CondominioProvider");
  return ctx;
}
