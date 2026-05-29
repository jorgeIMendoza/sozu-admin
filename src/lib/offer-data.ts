import { create } from "zustand";

export interface PreReservation {
  id: string;
  status: "active" | "expired" | "completed";
  createdAt: string;
  propertyId: string;
}

interface OfferStore {
  preReservations: PreReservation[];
}

export const useOfferStore = create<OfferStore>(() => ({
  preReservations: [],
}));
