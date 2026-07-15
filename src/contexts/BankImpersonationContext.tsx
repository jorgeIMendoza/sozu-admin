import { createContext, useContext, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
 * Banco con convenio actualmente seleccionado.
 *
 * - Usuarios con banco vinculado (usuarios.id_banco — Supervisor/Operador
 *   Banco) y SIN permiso de impersonar: siempre su propio banco.
 * - Roles con puede_impersonar: el banco elegido en el selector "Ver como".
 * - Fallback: primer convenio activo. Devuelve `null` mientras no haya
 *   convenios (p.ej. DDL pendiente).
 */
export function useCurrentBanco(): BancoConvenio | null {
  const { profile } = useAuth();
  const { selectedBancoId } = useBancoScope();
  const { data: convenios = [] } = useBancosConvenio();
  if (convenios.length === 0) return null;

  const canImpersonate = profile?.puede_impersonar === true;
  if (!canImpersonate && profile?.id_banco != null) {
    return convenios.find((b) => b.id_banco === profile.id_banco) ?? null;
  }

  if (selectedBancoId != null) {
    const match = convenios.find((b) => b.id_banco === selectedBancoId);
    if (match) return match;
  }
  return convenios.find((b) => b.activo) ?? convenios[0];
}
