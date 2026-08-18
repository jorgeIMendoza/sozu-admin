import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface PersonalUser {
  /** Email del usuario: es la llave de `usuarios` (esa tabla no tiene `id`). */
  id: string;
  nombre: string;
  email: string;
  rol_nombre: string;
  /** `usuarios.rol_id`. Sin él la "Vista del usuario" no puede resolver sus menús. */
  rol_id: number | null;
  id_persona?: number | null;
  auth_user_id?: string | null;
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
      if (!raw) return null;
      const guardado = JSON.parse(raw) as PersonalUser;
      // Lo guardado por versiones anteriores no traía `rol_id`; sin él la vista
      // fiel resolvería con el rol del admin y mentiría. Mejor empezar limpio.
      return typeof guardado?.rol_id === "number" ? guardado : null;
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

/**
 * Variante tolerante para las vistas que se COMPARTEN entre portales (p. ej. los
 * Contactos del CRM, que también sirven "Mis referidos"): fuera del Portal del
 * Personal no hay provider y lanzar sería un falso error. Devuelve `null`.
 */
export function usePortalPersonalImpersonationOpcional(): Ctx | null {
  return useContext(PortalPersonalImpersonationContext);
}
