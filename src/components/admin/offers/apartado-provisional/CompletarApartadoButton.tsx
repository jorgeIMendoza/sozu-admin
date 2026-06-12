import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X, FileCheck } from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";

const CompletarApartadoButton = ({
  formalReservation,
}: {
  formalReservation: FormalReservation;
}) => {
  const navigate = useNavigate();
  const acceptContrato = useFormalReservationStore((s) => s.acceptContratoDuringProvisional);
  const [modalOpen, setModalOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleProceed = () => {
    if (!acceptedTerms) return;
    acceptContrato(formalReservation.id);
    navigate(`/apartar/${formalReservation.id}/completar`);
  };


  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        Completar mi apartado
        <ArrowRight className="w-4 h-4" />
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Confirmar tu apartado</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                <div className="flex items-start gap-2 mb-2">
                  <FileCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs font-semibold text-foreground">
                    Estás por completar tu apartado
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  En el siguiente paso harás la transferencia SPEI de{" "}
                  <strong className="text-foreground">$20,000 MXN</strong> desde tu cuenta bancaria
                  a la CLABE de tu unidad. Al confirmar, la retención de{" "}
                  <strong className="text-foreground">
                    ${formalReservation.hold?.amountMXN.toLocaleString("es-MX")}
                  </strong>{" "}
                  en tu tarjeta se liberará automáticamente.
                </p>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-primary flex-shrink-0"
                />
                <span className="text-[11px] text-foreground leading-relaxed">
                  He leído el contrato preliminar y acepto sus términos. Entiendo las cláusulas
                  sobre obligaciones, penalidades, garantías y plazos descritas en el documento.
                </span>
              </label>

              <p className="text-[10px] text-muted-foreground text-center">
                Si tienes dudas, contacta a tu asesor antes de avanzar.
              </p>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 h-11 rounded-xl bg-card border border-border text-foreground text-xs font-semibold hover:border-foreground/30 transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleProceed}
                disabled={!acceptedTerms}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                Ir al pago
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CompletarApartadoButton;
