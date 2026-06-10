import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import {
  ArrowRight,
  Download,
  Clock,
  CreditCard,
  ShieldCheck,
  Calendar,
  Hash,
} from "lucide-react";

const ApartadoProvisionalActivadoPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();

  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );

  useEffect(() => {
    if (formalReservation && formalReservation.status !== "apartado_provisional") {
      navigate("/", { replace: true });
    }
  }, [formalReservation, navigate]);

  if (!formalReservation || !formalReservation.hold) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">Apartado no encontrado</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const hold = formalReservation.hold;
  const expiresAt = new Date(hold.expiresAt);
  const now = new Date();
  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(
    0,
    Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  );

  const expiresFormatted = expiresAt.toLocaleString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-8">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
            <Clock className="w-10 h-10 text-primary" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Apartado provisional activado
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Tu unidad está reservada
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Tienes <strong className="text-foreground">{daysRemaining} días y {hoursRemaining} horas</strong>{" "}
            para revisar el contrato y completar tu apartado con la transferencia SPEI.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/20 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Retención activa en tu tarjeta
            </p>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Monto retenido
            </p>
            <p className="text-3xl font-bold tabular-nums text-foreground">
              ${hold.amountMXN.toLocaleString("es-MX")} MXN
            </p>
            <p className="text-sm text-muted-foreground">
              {hold.cardBrand.toUpperCase()} terminación ****{hold.cardLast4}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-primary/15">
              No es un cobro — se liberará automáticamente cuando completes tu pago o expire
              el plazo.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold text-foreground">Información importante</p>
          </div>
          <div className="divide-y divide-border">
            <InfoRow
              icon={Calendar}
              label="Vence el"
              detail={expiresFormatted}
            />
            <InfoRow
              icon={CreditCard}
              label="Tu retención"
              detail={`$${hold.amountMXN.toLocaleString("es-MX")} MXN · ${hold.cardBrand.toUpperCase()} ****${hold.cardLast4}`}
              extra={`Authorization ID: ${hold.holdAuthorizationId}`}
            />
            <InfoRow
              icon={Hash}
              label="ID del apartado"
              detail={formalReservation.id}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 space-y-2">
          <p className="text-sm font-semibold text-foreground">
            📋 Siguiente paso: revisa tu contrato
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            En tu dashboard tendrás el contrato preliminar completo para revisar con calma.
            También puedes contactar a tu asesor para resolver dudas antes de avanzar con tu
            pago.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate(`/apartado-provisional/${formalReservation.id}`)}
            className="h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            Ir a mi dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => console.log("Mock: descarga comprobante del hold")}
            className="h-12 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar comprobante
          </button>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-success" />
          <p className="leading-relaxed">
            Tu retención está protegida bajo estándar PCI-DSS. En ningún momento SOZU recibe
            el dinero — solo está bloqueado en tu línea de crédito.
          </p>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({
  icon: Icon,
  label,
  detail,
  extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  extra?: string;
}) => (
  <div className="flex items-start gap-3 px-5 py-4">
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div className="flex-1 space-y-0.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{detail}</p>
      {extra && (
        <p className="text-xs text-muted-foreground font-mono">{extra}</p>
      )}
    </div>
  </div>
);

export default ApartadoProvisionalActivadoPage;
