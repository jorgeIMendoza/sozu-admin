import { createContext, useContext, useState, ReactNode } from "react";

interface CrmImpersonationContextType {
  impersonatedCrmUserEmail: string | null;
  impersonatedCrmUserId: string | null;
  impersonatedCrmUserName: string | null;
  impersonatedCrmUserRolId: number | null;
  setImpersonatedCrmUser: (
    email: string | null,
    userId: string | null,
    name: string | null,
    rolId: number | null,
  ) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const CrmImpersonationContext = createContext<CrmImpersonationContextType>({
  impersonatedCrmUserEmail: null,
  impersonatedCrmUserId: null,
  impersonatedCrmUserName: null,
  impersonatedCrmUserRolId: null,
  setImpersonatedCrmUser: () => {},
  clearImpersonation: () => {},
  isImpersonating: false,
});

export function CrmImpersonationProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [rolId, setRolId] = useState<number | null>(null);

  const setImpersonatedCrmUser = (
    e: string | null,
    u: string | null,
    n: string | null,
    r: number | null,
  ) => {
    setEmail(e);
    setUserId(u);
    setName(n);
    setRolId(r);
  };

  const clearImpersonation = () => {
    setEmail(null);
    setUserId(null);
    setName(null);
    setRolId(null);
  };

  return (
    <CrmImpersonationContext.Provider
      value={{
        impersonatedCrmUserEmail: email,
        impersonatedCrmUserId: userId,
        impersonatedCrmUserName: name,
        impersonatedCrmUserRolId: rolId,
        setImpersonatedCrmUser,
        clearImpersonation,
        isImpersonating: !!email,
      }}
    >
      {children}
    </CrmImpersonationContext.Provider>
  );
}

export function useCrmImpersonation() {
  return useContext(CrmImpersonationContext);
}