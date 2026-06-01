import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type BuyerType =
  | "individual_mexican"
  | "individual_foreign"
  | "legal_entity"
  | "copropiedad";

interface ProspectData {
  fullName: string;
  email: string;
  phone: string;
}

interface HoldData {
  cardLast4: string;
  expiresAt: string; // ISO date +5 days
  folio: string;
}

interface OfertaFlowState {
  ofertaId: string | null;
  prospectData: ProspectData | null;
  emailVerified: boolean;
  buyerType: BuyerType | null;
  holdData: HoldData | null;

  setOfertaId: (id: string) => void;
  setProspect: (data: ProspectData) => void;
  setVerified: () => void;
  setBuyerType: (type: BuyerType) => void;
  activateHold: (cardLast4: string) => HoldData;
  reset: () => void;
}

const initialState = {
  ofertaId: null,
  prospectData: null,
  emailVerified: false,
  buyerType: null,
  holdData: null,
};

export const useOfertaFlowStore = create<OfertaFlowState>()(
  persist(
    (set) => ({
      ...initialState,

      setOfertaId: (id) => set({ ofertaId: id }),

      setProspect: (data) => set({ prospectData: data, emailVerified: false }),

      setVerified: () => set({ emailVerified: true }),

      setBuyerType: (type) => set({ buyerType: type }),

      activateHold: (cardLast4) => {
        const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
        const folio = `PRE-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const holdData: HoldData = { cardLast4, expiresAt, folio };
        set({ holdData });
        return holdData;
      },

      reset: () => set(initialState),
    }),
    {
      name: "sozu-oferta-flow-v1",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
