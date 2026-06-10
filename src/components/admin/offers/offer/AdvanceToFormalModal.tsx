/**
 * @deprecated F.3.C — Pre-apartado del 18.7.A reemplazado por el modelo del hold del 18.9.F
 * (FormalReservation + ApartadoProvisionalDashboard). Archivo en cuarentena: se conserva
 * para servir a clientes con PRE-XXX activos al rollout. Ningún cliente nuevo entra acá
 * (CTA removido en F.3.A; ruta de entrada removida en F.3.C). No usar para nuevas
 * funcionalidades. Migración: src/lib/formal-reservation-data.ts y
 * src/components/apartado-provisional/.
 */
import { X, ChevronRight, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Agent } from "@/lib/offers/agent-data";
import type { PreReservation } from "@/lib/offers/offer-data";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";

interface Props {
  open: boolean;
  onClose: () => void;
  agent?: Agent;
  offerId: string;
  preReservation?: PreReservation;
}

const AdvanceToFormalModal = ({ open, onClose, agent, offerId, preReservation }: Props) => {
  const navigate = useNavigate();
  const initiateFormalReservation = useFormalReservationStore((s) => s.initiateFormalReservation);
  const reservations = useFormalReservationStore((s) => s.reservations);

  if (!open) return null;

  const handleAdvance = () => {
    if (!preReservation) return;
    const existing = reservations.find((r) => r.preReservationId === preReservation.id);
    if (!existing) {
      initiateFormalReservation({
        preReservationId: preReservation.id,
        prospectId: preReservation.prospectId,
        offerId: preReservation.offerId,
        agentId: preReservation.originatingAgentId,
        appliedAmountMXN: preReservation.amountMXN ?? 5000,
      });
    }
    onClose();
    navigate(`/mi-pre-apartado/${preReservation.id}/apartar-formal`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">
            Avanzar al apartado formal
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Te guiaremos en <span className="font-semibold text-foreground">6 pasos</span>: identidad,
            datos, plan, documentos, contrato y firma con MIFIEL. Toma alrededor de 15-20 minutos
            si tienes tus documentos a la mano. Puedes pausar y retomar cuando quieras.
          </p>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Lo que sigue:</h4>
            <ul className="space-y-2 text-xs leading-relaxed text-foreground">
              <li className="flex gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                Identificas tu <span className="font-semibold">tipo de comprador</span> (persona física o moral).
              </li>
              <li className="flex gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                Capturas <span className="font-semibold">datos personales</span> (RFC, CURP, domicilio).
              </li>
              <li className="flex gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                Confirmas tu <span className="font-semibold">plan de financiamiento</span>.
              </li>
              <li className="flex gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                Subes <span className="font-semibold">documentos</span>, revisas y <span className="font-semibold">firmas</span> el contrato.
              </li>
              <li className="flex gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                Tus <span className="font-semibold">$5,000 retenidos</span> se aplican al enganche.
              </li>
            </ul>
          </div>

          {agent && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <img
                src={agent.photoUrl}
                alt={agent.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="text-[11px] text-muted-foreground">Tu agente acompaña el proceso</p>
                <p className="text-sm font-semibold text-foreground">{agent.fullName}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Volver
            </button>
            <button
              onClick={handleAdvance}
              disabled={!preReservation}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Comenzar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvanceToFormalModal;
