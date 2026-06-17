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

const ProjectAdminImpersonationContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "sozu-ec-impersonated-project-admin";

export function ProjectAdminImpersonationProvider({ children }: { children: ReactNode }) {
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
    <ProjectAdminImpersonationContext.Provider
      value={{
        impersonatedUser,
        setImpersonatedUser,
        clearImpersonation,
        isImpersonating: !!impersonatedUser,
      }}
    >
      {children}
    </ProjectAdminImpersonationContext.Provider>
  );
}

export function useProjectAdminImpersonation() {
  const ctx = useContext(ProjectAdminImpersonationContext);
  if (!ctx) throw new Error("useProjectAdminImpersonation must be used within ProjectAdminImpersonationProvider");
  return ctx;
}