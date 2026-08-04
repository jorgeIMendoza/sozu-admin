import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

/**
 * Impersonación del Portal Socio Bancario ("Ver como").
 *
 * Un Super Admin (roles.puede_impersonar) puede ver el portal TAL COMO lo ve un
 * usuario de banco (rol 'Socio Bancario'): el scope de desarrollos se resuelve
 * por el banco (id_socio_bancario) del usuario impersonado, no por el del usuario
 * real. Sirve para validar exactamente qué ve cada usuario dado de alta.
 *
 * Solo afecta el scope de datos del portal (useSocioProyecto). No cambia
 * permisos de menú ni la sesión real; es una vista de validación en cliente.
 */

export interface ImpersonatedSocioUser {
  /** Identificador del usuario de banco (email; usuarios no tiene PK numérica). */
  email: string;
  nombre: string;
  /** Banco al que pertenece el usuario — define el scope de desarrollos. */
  idSocioBancario: number;
  bancoNombre: string | null;
}

interface Ctx {
  impersonatedUser: ImpersonatedSocioUser | null;
  setImpersonatedUser: (u: ImpersonatedSocioUser | null) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const SocioBancarioImpersonationContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "sozu-sb-impersonated-user";

export function SocioBancarioImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUserState] = useState<ImpersonatedSocioUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ImpersonatedSocioUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (impersonatedUser) localStorage.setItem(STORAGE_KEY, JSON.stringify(impersonatedUser));
    else localStorage.removeItem(STORAGE_KEY);
  }, [impersonatedUser]);

  const setImpersonatedUser = useCallback(
    (u: ImpersonatedSocioUser | null) => setImpersonatedUserState(u),
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

export function useSocioBancarioImpersonation(): Ctx {
  const ctx = useContext(SocioBancarioImpersonationContext);
  if (!ctx) {
    throw new Error(
      "useSocioBancarioImpersonation must be used within SocioBancarioImpersonationProvider",
    );
  }
  return ctx;
}

/**
 * Accesor no-lanzante para hooks que pueden renderizarse antes de que el
 * provider monte (o fuera del portal). Devuelve "sin impersonación".
 */
export function useSocioBancarioImpersonationOptional(): Ctx {
  return (
    useContext(SocioBancarioImpersonationContext) ?? {
      impersonatedUser: null,
      setImpersonatedUser: () => {},
      clearImpersonation: () => {},
      isImpersonating: false,
    }
  );
}
