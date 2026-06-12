import type { PreReservation, OfertaComercial } from "@/lib/offers/offer-data";
import type { Agent } from "@/lib/offers/agent-data";
import type { TemplateContext } from "@/lib/offers/notification-templates";
import { useOfferStore } from "@/lib/offers/offer-data";

/**
 * Construye el contexto para renderizar templates a partir de la reservation,
 * la oferta y el agente.
 */
export function buildTemplateContext(
  reservation: PreReservation,
  offer: OfertaComercial,
  agent?: Agent
): TemplateContext {
  const prospect = useOfferStore
    .getState()
    .prospects.find((p) => p.id === reservation.prospectId);

  const validUntil = new Date(reservation.reservationExpiresAt);
  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const propertyLabel = `${offer.property.projectName} · ${offer.property.unitModel} · ${offer.property.unitNumber}`;

  return {
    firstName: prospect?.fullName.split(" ")[0] ?? "Hola",
    propertyLabel,
    amountMXN: reservation.amountMXN.toLocaleString("es-MX"),
    daysRemaining,
    validUntilDate: validUntil.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    agentFirstName: agent?.firstName ?? "tu agente",
    agentFullName: agent?.fullName ?? "Tu agente SOZU",
    agentPhone: agent?.phone ?? "",
    reservationId: reservation.id,
    offerId: reservation.offerId,
  };
}

/**
 * Calcula la fecha de envío programada para una notificación.
 * = createdAt del pre-apartado + offset en minutos.
 */
export function getScheduledFor(
  reservation: PreReservation,
  offsetMinutes: number
): Date {
  const created = new Date(reservation.createdAt);
  return new Date(created.getTime() + offsetMinutes * 60 * 1000);
}
