import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Home } from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";

const ApartadoLiberadoPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();

  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );

  if (!formalReservation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold text-foreground mb-2">Apartado no encontrado</h1>
          <button
            onClick={() => navigate("/")}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Liberaste tu apartado</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          La unidad quedó disponible para otros clientes y la retención en tu tarjeta de crédito se ha
          devuelto automáticamente. No hubo ningún cargo.
        </p>

        <div className="rounded-xl bg-card border border-border p-4 mb-6 text-left space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">ID Apartado</p>
            <p className="text-xs font-mono text-foreground">{formalReservation.id}</p>
          </div>
          {formalReservation.cancellationReason && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Motivo</p>
              <p className="text-xs text-foreground">{formalReservation.cancellationReason}</p>
            </div>
          )}
          {formalReservation.cancelledAt && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Fecha</p>
              <p className="text-xs text-foreground tabular-nums">
                {new Date(formalReservation.cancelledAt).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mb-3"
        >
          <Home className="w-4 h-4" />
          Explorar unidades disponibles
        </button>

        <p className="text-[10px] text-muted-foreground">
          Si cambias de opinión, puedes iniciar un nuevo apartado con una nueva oferta. Ten en cuenta
          que precios y condiciones pueden haber cambiado.
        </p>
      </div>
    </div>
  );
};

export default ApartadoLiberadoPage;
