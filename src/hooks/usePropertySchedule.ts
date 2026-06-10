import { useFormalReservationStore, type PaymentItem } from "@/lib/offers/formal-reservation-data";

export interface PropertyScheduleInfo {
  source: "expediente" | "legacy" | "none";
  schedule: PaymentItem[];
  apartadoPaidItem: PaymentItem | null;
  nextPendingPayment: PaymentItem | null;
  totalPaidMXN: number;
  totalRemainingMXN: number;
  totalPriceMXN: number;
  percentPaid: number;
  formalReservationId: string | null;
}

/**
 * Detecta si una propiedad tiene schedule del expediente (flujo refactorizado 18.9)
 * y lo devuelve como source of truth. Si no, cae a "legacy" o "none" para que el
 * caller renderice su fallback original.
 *
 * SWAP POINT: en producción `offerId` puede mapearse contra `propertyId` real.
 */
export const usePropertySchedule = (offerId: string): PropertyScheduleInfo => {
  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find(
      (r) =>
        r.offerId === offerId &&
        (r.status === "pago_recibido" ||
          r.status === "expediente_en_curso" ||
          r.status === "expediente_completo"),
    ),
  );

  const scheduleFromExpediente = formalReservation?.expediente?.planPagos?.data?.schedule;

  if (!scheduleFromExpediente || scheduleFromExpediente.length === 0) {
    return {
      source: formalReservation ? "legacy" : "none",
      schedule: [],
      apartadoPaidItem: null,
      nextPendingPayment: null,
      totalPaidMXN: 0,
      totalRemainingMXN: 0,
      totalPriceMXN: 0,
      percentPaid: 0,
      formalReservationId: formalReservation?.id ?? null,
    };
  }

  const apartadoPaidItem = scheduleFromExpediente.find((p) => p.type === "apartado") ?? null;
  const nextPendingPayment =
    scheduleFromExpediente.find((p) => p.status === "programado") ?? null;

  const totalPaidMXN = scheduleFromExpediente
    .filter((p) => p.status === "pagado")
    .reduce((sum, p) => sum + p.montoMXN, 0);

  const totalRemainingMXN = scheduleFromExpediente
    .filter((p) => p.status === "programado")
    .reduce((sum, p) => sum + p.montoMXN, 0);

  const totalPriceMXN =
    formalReservation?.expediente?.planPagos?.data?.totalPriceMXN ??
    totalPaidMXN + totalRemainingMXN;
  const percentPaid = totalPriceMXN > 0 ? Math.round((totalPaidMXN / totalPriceMXN) * 100) : 0;

  return {
    source: "expediente",
    schedule: scheduleFromExpediente,
    apartadoPaidItem,
    nextPendingPayment,
    totalPaidMXN,
    totalRemainingMXN,
    totalPriceMXN,
    percentPaid,
    formalReservationId: formalReservation?.id ?? null,
  };
};
