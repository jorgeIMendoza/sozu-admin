import { createContext, useContext, useState, ReactNode } from "react";

interface CobranzaImpersonationContextType {
  impersonatedEmail: string | null;
  impersonatedName: string | null;
  impersonatedPersonaId: number | null;
  setImpersonated: (email: string, name: string, personaId: number) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const CobranzaImpersonationContext = createContext<CobranzaImpersonationContextType>({
  impersonatedEmail: null,
  impersonatedName: null,
  impersonatedPersonaId: null,
  setImpersonated: () => {},
  clearImpersonation: () => {},
  isImpersonating: false,
});

export function CobranzaImpersonationProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<number | null>(null);

  const setImpersonated = (e: string, n: string, pid: number) => {
    setEmail(e);
    setName(n);
    setPersonaId(pid);
  };

  const clearImpersonation = () => {
    setEmail(null);
    setName(null);
    setPersonaId(null);
  };

  return (
    <CobranzaImpersonationContext.Provider
      value={{
        impersonatedEmail: email,
        impersonatedName: name,
        impersonatedPersonaId: personaId,
        setImpersonated,
        clearImpersonation,
        isImpersonating: !!email,
      }}
    >
      {children}
    </CobranzaImpersonationContext.Provider>
  );
}

export const useCobranzaImpersonation = () => useContext(CobranzaImpersonationContext);
