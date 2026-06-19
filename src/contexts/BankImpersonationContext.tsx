import { createContext, useContext, useState, ReactNode } from "react";
import {
  useBancosConvenio,
  type BancoConvenio,
} from "@/hooks/usePortalBancos/useBancosConvenio";

/**
 * Scope por banco del Portal Bancos.
 *
 * Antes era una impersonación de agentes mock; ahora simplemente determina qué
 * banco con convenio (real) se está viendo en las pantallas operativas. El
 * selector solo se muestra a Super Admin (ver `BankImpersonationSelector`).
 */

interface BankScopeContextType {
  selectedBancoId: number | null;
  setSelectedBancoId: (id: number | null) => void;
}

const STORAGE_KEY = "sozu-portal-bancos-selected";

const BankScopeContext = createContext<BankScopeContextType>({
  selectedBancoId: null,
  setSelectedBancoId: () => {},
});

export function BankImpersonationProvider({ children }: { children: ReactNode }) {
  const [selectedBancoId, setSelectedBancoIdState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) || null : null;
  });

  const setSelectedBancoId = (id: number | null) => {
    setSelectedBancoIdState(id);
    try {
      if (id == null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* noop */
    }
  };

  return (
    <BankScopeContext.Provider value={{ selectedBancoId, setSelectedBancoId }}>
      {children}
    </BankScopeContext.Provider>
  );
}

export function useBancoScope() {
  return useContext(BankScopeContext);
}

/**
 * Banco con convenio actualmente seleccionado. Si no hay selección explícita,
 * cae al primer convenio activo. Devuelve `null` mientras no haya convenios
 * (p.ej. DDL pendiente).
 */
export function useCurrentBanco(): BancoConvenio | null {
  const { selectedBancoId } = useBancoScope();
  const { data: convenios = [] } = useBancosConvenio();
  if (convenios.length === 0) return null;
  if (selectedBancoId != null) {
    const match = convenios.find((b) => b.id_banco === selectedBancoId);
    if (match) return match;
  }
  return convenios.find((b) => b.activo) ?? convenios[0];
}
