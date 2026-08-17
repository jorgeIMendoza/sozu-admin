import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface PersonalUser {
  id: string;
  nombre: string;
  email: string;
  rol_nombre: string;
  tipo_personal?: string | null;
}

interface Ctx {
  impersonatedUser: PersonalUser | null;
  setImpersonatedUser: (u: PersonalUser | null) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const PortalPersonalImpersonationContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "sozu-portal-personal-impersonated";

export function PortalPersonalImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUserState] = useState<PersonalUser | null>(() => {
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

  const setImpersonatedUser = useCallback((u: PersonalUser | null) => setImpersonatedUserState(u), []);
  const clearImpersonation = useCallback(() => setImpersonatedUserState(null), []);

  return (
    <PortalPersonalImpersonationContext.Provider
      value={{ impersonatedUser, setImpersonatedUser, clearImpersonation, isImpersonating: !!impersonatedUser }}
    >
      {children}
    </PortalPersonalImpersonationContext.Provider>
  );
}

export function usePortalPersonalImpersonation() {
  const ctx = useContext(PortalPersonalImpersonationContext);
  if (!ctx)
    throw new Error(
      "usePortalPersonalImpersonation must be used within PortalPersonalImpersonationProvider",
    );
  return ctx;
}
