/**
 * @deprecated F.3.C — Pre-apartado del 18.7.A reemplazado por el modelo del hold del 18.9.F
 * (FormalReservation + ApartadoProvisionalDashboard). Archivo en cuarentena: se conserva
 * para servir a clientes con PRE-XXX activos al rollout. Ningún cliente nuevo entra acá
 * (CTA removido en F.3.A; ruta de entrada removida en F.3.C). No usar para nuevas
 * funcionalidades. Migración: src/lib/formal-reservation-data.ts y
 * src/components/apartado-provisional/.
 */
import { useState } from "react";
import { X, AlertTriangle, Check, Loader2 } from "lucide-react";
import { formatMXN } from "@/lib/offers/offer-data";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  amountMXN: number;
  cardLast4?: string;
  propertyLabel: string;
}

const CancelPreReservationModal = ({
  open,
  onClose,
  onConfirm,
  amountMXN,
  cardLast4,
  propertyLabel,
}: Props) => {
  const [step, setStep] = useState<"confirm" | "processing" | "done">("confirm");

  if (!open) return null;

  const handleConfirm = async () => {
    setStep("processing");
    await new Promise((res) => setTimeout(res, 1200));
    await onConfirm();
    setStep("done");
  };

  const handleClose = () => {
    setStep("confirm");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        {step === "confirm" && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">
                ¿Cancelar pre-apartado?
              </h2>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm leading-relaxed text-foreground">
                  <p>
                    Estás a punto de cancelar tu pre-apartado de{" "}
                    <span className="font-semibold">{propertyLabel}</span>.
                  </p>
                  <p>
                    Esto liberará la unidad y procesaremos el reembolso de{" "}
                    <span className="font-semibold tabular-nums">
                      {formatMXN(amountMXN)}
                    </span>{" "}
                    a tu tarjeta termina en {cardLast4 ?? "****"}.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  El reembolso aparecerá en tu estado de cuenta entre{" "}
                  <span className="font-semibold text-foreground">
                    3 y 5 días hábiles
                  </span>
                  , dependiendo de tu banco. No habrá ningún cargo.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="flex-1 h-11 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Mantener pre-apartado
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors"
                >
                  Sí, cancelar
                </button>
              </div>
            </div>
          </>
        )}

        {step === "processing" && (
          <div className="py-10 text-center">
            <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
            <h3 className="text-base font-semibold text-foreground mb-1">
              Procesando cancelación…
            </h3>
            <p className="text-sm text-muted-foreground">
              Liberando la retención de tu tarjeta
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-4">
              <Check className="w-7 h-7 text-success" strokeWidth={3} />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Pre-apartado cancelado
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Tu reembolso de{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatMXN(amountMXN)}
              </span>{" "}
              está siendo procesado. Llegará a tu tarjeta entre 3 y 5 días hábiles.
            </p>
            <button
              onClick={handleClose}
              className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CancelPreReservationModal;
