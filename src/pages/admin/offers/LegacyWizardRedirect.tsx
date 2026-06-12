import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";

/**
 * Redirect inteligente: cualquier ruta del wizard legacy aterriza aquí y se
 * redirige al paso correspondiente del flujo refactorizado 18.9.A-C según el
 * estado real del FormalReservation.
 */
const LegacyWizardRedirect = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId),
  );

  useEffect(() => {
    if (formalReservation) {
      // eslint-disable-next-line no-console
      console.log("[Legacy Redirect] FR encontrado:", {
        id: formalReservation.id,
        status: formalReservation.status,
        hasFiscalIdentity: !!formalReservation.fiscalIdentity,
        hasPayment: !!formalReservation.payment,
        hasExpediente: !!formalReservation.expediente,
      });
    } else {
      // eslint-disable-next-line no-console
      console.log("[Legacy Redirect] FR no encontrado:", formalReservationId);
    }
  }, [formalReservation, formalReservationId]);

  if (!formalReservation) return <Navigate to="/" replace />;

  if (
    formalReservation.status === "pago_recibido" ||
    formalReservation.status === "expediente_en_curso"
  ) {
    return (
      <Navigate
        to={`/en-adquisicion/${formalReservation.id}/expediente`}
        replace
      />
    );
  }

  if (formalReservation.status === "expediente_completo") {
    return <Navigate to="/en-adquisicion" replace />;
  }

  // 18.10.A: el wizard pre-hold se eliminó; cualquier ruta legacy lleva a /reservar.
  return <Navigate to={`/apartar/${formalReservation.id}/reservar`} replace />;
};

export default LegacyWizardRedirect;
