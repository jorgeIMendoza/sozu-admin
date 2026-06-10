import { useNavigate } from "react-router-dom";
import { Clock, ArrowRight, MapPin } from "lucide-react";
import {
  useOfferById,
  formatMXN,
  formatPropertyTitle,
  type PreReservation,
} from "@/lib/offers/offer-data";

interface Props {
  preReservation: PreReservation;
}

const PreReservationCard = ({ preReservation }: Props) => {
  const navigate = useNavigate();
  const offer = useOfferById(preReservation.offerId);

  const propertyLabel = offer
    ? formatPropertyTitle(offer.property)
    : preReservation.propertyId;

  const expiresAt = new Date(preReservation.reservationExpiresAt);
  const daysLeft = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const isUrgent = daysLeft <= 3;
  const isWarning = daysLeft <= 7 && !isUrgent;

  const interestedPlan = preReservation.interestedPlanId
    ? offer?.paymentPlans.find((p) => p.id === preReservation.interestedPlanId)
    : undefined;

  const pillClass = isUrgent
    ? "bg-destructive/10 text-destructive"
    : isWarning
      ? "bg-warning/15 text-warning"
      : "bg-success/15 text-success";

  const handleClick = () => {
    navigate(`/pre-apartado/${preReservation.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer rounded-2xl border border-border bg-card overflow-hidden hover:border-border-soft hover:shadow-sm transition-all"
    >
      <div className="flex gap-4 p-4">
        {offer?.gallery?.[0] && (
          <img
            src={offer.gallery[0]}
            alt={propertyLabel}
            className="w-[110px] h-[100px] rounded-xl object-cover flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold font-display text-foreground truncate">
                {propertyLabel}
              </p>
              {offer?.location.address && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {offer.location.address}
                </p>
              )}
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${pillClass}`}
            >
              <Clock className="w-3 h-3" />
              {daysLeft} día{daysLeft !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              Retenido{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatMXN(preReservation.amountMXN)}
              </span>
            </span>
            {interestedPlan && (
              <span>
                Plan{" "}
                <span className="font-semibold text-foreground">
                  {interestedPlan.name}
                </span>
                {interestedPlan.discountPct > 0 && (
                  <span className="text-success">
                    {" "}
                    (-{interestedPlan.discountPct}%)
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary group-hover:underline">
              Avanzar al apartado formal
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] text-muted-foreground">Ver detalle</span>
          </div>
        </div>
      </div>

      {isUrgent && (
        <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2">
          <p className="text-[11px] text-destructive font-medium">
            ⏰ Solo {daysLeft} día{daysLeft !== 1 ? "s" : ""} para decidir. Después se libera la retención automáticamente.
          </p>
        </div>
      )}
    </div>
  );
};

export default PreReservationCard;
