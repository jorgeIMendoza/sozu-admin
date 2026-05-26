import { createContext, useContext, useState, ReactNode } from "react";

interface EmbajadorImpersonationContextType {
  impersonatedEmbajadorId: string | null;
  impersonatedEmbajadorName: string | null;
  impersonatedEmbajadorCode: string | null;
  setImpersonatedEmbajador: (id: string | null, name: string | null, code: string | null) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const EmbajadorImpersonationContext = createContext<EmbajadorImpersonationContextType>({
  impersonatedEmbajadorId: null,
  impersonatedEmbajadorName: null,
  impersonatedEmbajadorCode: null,
  setImpersonatedEmbajador: () => {},
  clearImpersonation: () => {},
  isImpersonating: false,
});

export function EmbajadorImpersonationProvider({ children }: { children: ReactNode }) {
  const [embajadorId, setEmbajadorId] = useState<string | null>(null);
  const [embajadorName, setEmbajadorName] = useState<string | null>(null);
  const [embajadorCode, setEmbajadorCode] = useState<string | null>(null);

  const setImpersonatedEmbajador = (id: string | null, name: string | null, code: string | null) => {
    setEmbajadorId(id);
    setEmbajadorName(name);
    setEmbajadorCode(code);
  };

  const clearImpersonation = () => {
    setEmbajadorId(null);
    setEmbajadorName(null);
    setEmbajadorCode(null);
  };

  return (
    <EmbajadorImpersonationContext.Provider
      value={{
        impersonatedEmbajadorId: embajadorId,
        impersonatedEmbajadorName: embajadorName,
        impersonatedEmbajadorCode: embajadorCode,
        setImpersonatedEmbajador,
        clearImpersonation,
        isImpersonating: !!embajadorId,
      }}
    >
      {children}
    </EmbajadorImpersonationContext.Provider>
  );
}

export function useEmbajadorImpersonation() {
  return useContext(EmbajadorImpersonationContext);
}
