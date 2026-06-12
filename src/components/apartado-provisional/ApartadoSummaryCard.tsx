import { Home, CreditCard } from "lucide-react";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";
import { getOfferById } from "@/lib/offers/offer-data";

const ApartadoSummaryCard = ({ formalReservation }: { formalReservation: FormalReservation }) => {
  const hold = formalReservation.hold;
  if (!hold) return null;

  const offer = getOfferById(formalReservation.offerId);
  const developmentName = offer?.property?.projectName ?? "Tu unidad";
  const propertyLabel = offer
    ? `${offer.property.unitModel} ${offer.property.unitNumber}`
    : "Sin código";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="bg-muted/30 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Home className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            Tu unidad reservada
          </span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {developmentName}
          </p>
          <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">
            {propertyLabel}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              ID Apartado
            </p>
            <p className="text-xs font-mono font-semibold text-foreground mt-0.5">
              {formalReservation.id}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <CreditCard className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wide">Retenido</span>
            </div>
            <p className="text-xs font-semibold text-foreground tabular-nums mt-0.5">
              ${hold.amountMXN.toLocaleString("es-MX")}
              <span className="text-muted-foreground font-normal ml-1">
                en ****{hold.cardLast4}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApartadoSummaryCard;
