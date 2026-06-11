import { useState } from "react";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";
import CancelarFunnelModal from "./CancelarFunnelModal";

/**
 * (18.10.C) Entry point del funnel de cancelación tipo Netflix.
 * Toda la lógica del funnel vive en `CancelarFunnelModal`.
 */
const CancelarApartadoButton = ({
  formalReservation,
}: {
  formalReservation: FormalReservation;
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  // Defensivo: solo mostrar si hay hold activo.
  if (!formalReservation.hold || formalReservation.hold.status !== "active") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full text-[10px] text-muted-foreground hover:text-foreground/70 underline-offset-2 hover:underline transition-colors py-1"
      >
        Liberar mi apartado
      </button>

      <CancelarFunnelModal
        formalReservation={formalReservation}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};

export default CancelarApartadoButton;
