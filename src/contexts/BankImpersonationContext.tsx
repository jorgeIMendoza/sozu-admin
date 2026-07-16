import { createContext, useContext, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBancosConvenio,
  type BancoConvenio,
} from "@/hooks/usePortalBancos/useBancosConvenio";

/**
 * Scope del Portal Bancos ("Ver como").
 *
 * Para roles con `puede_impersonar` (Super Admin) hay dos modos:
 *   - "all" → vista global: ve TODO lo de todos los bancos (default).
 *   - <id de banco> → ve como el Admin de ese banco (solo ese banco).
 * Los usuarios con banco vinculado (usuarios.id_banco) y sin impersonar quedan
 * siempre acotados a su propio banco.
 */

/** `"all"` = Super Admin ve todo · number = un banco · null = sin elegir. */
export type BancoSelection = number | "all" | null;

interface BankScopeContextType {
  selection: BancoSelection;
  setSelection: (s: BancoSelection) => void;
}

const STORAGE_KEY = "sozu-portal-bancos-selected";

const BankScopeContext = createContext<BankScopeContextType>({
  selection: null,
  setSelection: () => {},
});

export function BankImpersonationProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<BancoSelection>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    if (raw === "all") return "all";
    return Number(raw) || null;
  });

  const setSelection = (s: BancoSelection) => {
    setSelectionState(s);
    try {
      if (s == null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, String(s));
    } catch {
      /* noop */
    }
  };

  return (
    <BankScopeContext.Provider value={{ selection, setSelection }}>
      {children}
    </BankScopeContext.Provider>
  );
}

export function useBancoScope() {
  return useContext(BankScopeContext);
}

export type BancoResolvedScope =
  | { kind: "all" }
  | { kind: "banco"; id: number };

/**
 * Scope resuelto:
 * - Usuario con banco vinculado (usuarios.id_banco) y SIN impersonar → su banco.
 * - Rol con puede_impersonar (Super Admin) → el banco elegido, o "all" por
 *   defecto (ver todo).
 */
export function useBancoResolvedScope(): BancoResolvedScope {
  const { profile } = useAuth();
  const { selection } = useBancoScope();
  const canImpersonate = profile?.puede_impersonar === true;

  if (!canImpersonate && profile?.id_banco != null) {
    return { kind: "banco", id: profile.id_banco };
  }
  if (selection === "all") return { kind: "all" };
  if (typeof selection === "number") return { kind: "banco", id: selection };
  // Super Admin sin selección explícita → ver todo.
  return { kind: "all" };
}

/**
 * Banco con convenio actualmente en scope, o `null` si es la vista global
 * ("all" / Super Administrador). Devuelve `null` también mientras no cargan
 * los convenios.
 */
export function useCurrentBanco(): BancoConvenio | null {
  const scope = useBancoResolvedScope();
  const { data: convenios = [] } = useBancosConvenio();
  if (scope.kind === "all") return null;
  return convenios.find((b) => b.id_banco === scope.id) ?? null;
}

/**
 * Scope para las queries de solicitudes: id de banco (un banco) o `"all"`
 * (todos los bancos, vista Super Administrador).
 */
export function useSolicitudScope(): number | "all" {
  const scope = useBancoResolvedScope();
  return scope.kind === "all" ? "all" : scope.id;
}
