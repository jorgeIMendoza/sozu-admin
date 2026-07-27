import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

/**
 * Impersonación del Portal Socio Bancario.
 * Un Super Admin (roles.puede_impersonar) puede ver el portal como un
 * usuario con rol Administrador de Proyecto (rol_id = 2): el sidebar se
 * filtra por los permisos del rol impersonado, no por los del usuario real.
 */

export const SOCIO_BANCARIO_IMPERSONATED_ROL_ID = 2;

export interface SocioBancarioImpersonatedUser {
  id: string;
  nombre: string;
  email: string;
  rol_id: number;
  rol_nombre: string;
}

interface Ctx {
  impersonatedUser: SocioBancarioImpersonatedUser | null;
  setImpersonatedUser: (u: SocioBancarioImpersonatedUser | null) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const SocioBancarioImpersonationContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "sozu-sb-impersonated-project-admin";

export function SocioBancarioImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUserState] = useState<SocioBancarioImpersonatedUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (impersonatedUser) localStorage.setItem(STORAGE_KEY, JSON.stringify(impersonatedUser));
    else localStorage.removeItem(STORAGE_KEY);
  }, [impersonatedUser]);

  const setImpersonatedUser = useCallback(
    (u: SocioBancarioImpersonatedUser | null) => setImpersonatedUserState(u),
    [],
  );
  const clearImpersonation = useCallback(() => setImpersonatedUserState(null), []);

  return (
    <SocioBancarioImpersonationContext.Provider
      value={{
        impersonatedUser,
        setImpersonatedUser,
        clearImpersonation,
        isImpersonating: !!impersonatedUser,
      }}
    >
      {children}
    </SocioBancarioImpersonationContext.Provider>
  );
}

export function useSocioBancarioImpersonation() {
  const ctx = useContext(SocioBancarioImpersonationContext);
  if (!ctx) {
    throw new Error(
      "useSocioBancarioImpersonation must be used within SocioBancarioImpersonationProvider",
    );
  }
  return ctx;
}
