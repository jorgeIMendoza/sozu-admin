import { createContext, useContext, useState, ReactNode } from "react";

/**
 * Impersonación del Portal Condominio ("Ver como").
 *
 * Solo para roles con `roles.puede_impersonar`. Al impersonar a un usuario de
 * condominio (ej. Supervisor Condominio / Operador Condomino), el portal se ve
 * COMO ese usuario: su ROL define los menús visibles y su EMAIL define los
 * condominios accesibles (proyectos_acceso). Espejo de CobranzaImpersonation.
 */

interface CondominioImpersonationContextType {
  impersonatedEmail: string | null;
  impersonatedName: string | null;
  impersonatedPersonaId: number | null;
  impersonatedRolId: number | null;
  setImpersonated: (email: string, name: string, personaId: number | null, rolId: number | null) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const STORAGE_KEY = "sozu-condominio-impersonation";

const CondominioImpersonationContext = createContext<CondominioImpersonationContextType>({
  impersonatedEmail: null,
  impersonatedName: null,
  impersonatedPersonaId: null,
  impersonatedRolId: null,
  setImpersonated: () => {},
  clearImpersonation: () => {},
  isImpersonating: false,
});

interface Persisted {
  email: string | null;
  name: string | null;
  personaId: number | null;
  rolId: number | null;
}

function readPersisted(): Persisted {
  if (typeof window === "undefined") return { email: null, name: null, personaId: null, rolId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { email: null, name: null, personaId: null, rolId: null };
    const p = JSON.parse(raw);
    return {
      email: p.email ?? null,
      name: p.name ?? null,
      personaId: p.personaId ?? null,
      rolId: p.rolId ?? null,
    };
  } catch {
    return { email: null, name: null, personaId: null, rolId: null };
  }
}

export function CondominioImpersonationProvider({ children }: { children: ReactNode }) {
  const initial = readPersisted();
  const [email, setEmail] = useState<string | null>(initial.email);
  const [name, setName] = useState<string | null>(initial.name);
  const [personaId, setPersonaId] = useState<number | null>(initial.personaId);
  const [rolId, setRolId] = useState<number | null>(initial.rolId);

  const persist = (p: Persisted) => {
    try {
      if (p.email == null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* noop */
    }
  };

  const setImpersonated = (e: string, n: string, pid: number | null, rid: number | null) => {
    setEmail(e);
    setName(n);
    setPersonaId(pid);
    setRolId(rid);
    persist({ email: e, name: n, personaId: pid, rolId: rid });
  };

  const clearImpersonation = () => {
    setEmail(null);
    setName(null);
    setPersonaId(null);
    setRolId(null);
    persist({ email: null, name: null, personaId: null, rolId: null });
  };

  return (
    <CondominioImpersonationContext.Provider
      value={{
        impersonatedEmail: email,
        impersonatedName: name,
        impersonatedPersonaId: personaId,
        impersonatedRolId: rolId,
        setImpersonated,
        clearImpersonation,
        isImpersonating: !!email,
      }}
    >
      {children}
    </CondominioImpersonationContext.Provider>
  );
}

export const useCondominioImpersonation = () => useContext(CondominioImpersonationContext);
