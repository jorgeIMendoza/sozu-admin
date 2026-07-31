import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface ProjectAdminUser {
  id: string;
  nombre: string;
  email: string;
  rol_nombre: string;
}

interface Ctx {
  impersonatedUser: ProjectAdminUser | null;
  setImpersonatedUser: (u: ProjectAdminUser | null) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const PortalTicketsImpersonationContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "sozu-tickets-impersonated-project-admin";

export function PortalTicketsImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUserState] = useState<ProjectAdminUser | null>(() => {
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

  const setImpersonatedUser = useCallback((u: ProjectAdminUser | null) => setImpersonatedUserState(u), []);
  const clearImpersonation = useCallback(() => setImpersonatedUserState(null), []);

  return (
    <PortalTicketsImpersonationContext.Provider
      value={{
        impersonatedUser,
        setImpersonatedUser,
        clearImpersonation,
        isImpersonating: !!impersonatedUser,
      }}
    >
      {children}
    </PortalTicketsImpersonationContext.Provider>
  );
}

export function usePortalTicketsImpersonation() {
  const ctx = useContext(PortalTicketsImpersonationContext);
  if (!ctx)
    throw new Error(
      "usePortalTicketsImpersonation must be used within PortalTicketsImpersonationProvider",
    );
  return ctx;
}