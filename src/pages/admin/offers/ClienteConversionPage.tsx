import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2,
  ArrowRight,
  Download,
  Sparkles,
  ShieldCheck,
  Wallet,
  FileCheck,
} from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { useOfferStore } from "@/lib/offers/offer-data";

const ClienteConversionPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();

  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );

  const offer = useOfferStore((s) =>
    formalReservation ? s.offers.find((o) => o.id === formalReservation.offerId) : undefined
  );

  const propertyLabel = offer
    ? `${offer.property.projectName} · ${offer.property.unitModel} ${offer.property.unitNumber}`
    : "Tu propiedad apartada";

  useEffect(() => {
    if (!formalReservation || formalReservation.status !== "pago_recibido") return;
    // SWAP POINT: notificación push real al cliente
    console.log("[SOZU] Notificación push:", {
      title: "¡Bienvenido como cliente SOZU!",
      message: `Tu apartado de ${propertyLabel} se completó. ID: ${formalReservation.cuentaCobranzaId}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formalReservation?.id, formalReservation?.status]);

  if (!formalReservation || formalReservation.status !== "pago_recibido") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-xl font-bold text-foreground">Apartado no encontrado</h1>
          <p className="text-sm text-muted-foreground">
            No pudimos cargar la información de tu apartado.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const payment = formalReservation.payment!;
  const fiscalIdentity = formalReservation.fiscalIdentity;
  const virtualCLABE = formalReservation.propertyVirtualCLABE ?? "";
  const appliedFromPre = formalReservation.appliedAmountMXN ?? 0;
  const totalApartado = (payment.amountMXN ?? 0) + appliedFromPre;
  const detectedAt = new Date(payment.detectedAt);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-success/5">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-8">
        {/* Hero ceremonial */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center shadow-lg shadow-success/20">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider text-success">
            Conversión completada
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            ¡Ahora eres cliente SOZU!
          </h1>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
            Tu apartado de <span className="font-semibold text-foreground">{propertyLabel}</span> se procesó exitosamente.
            La propiedad ya está reservada formalmente a tu nombre.
          </p>
        </div>

        {/* Card ID Cuenta */}
        <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/20 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Tu nueva identidad en SOZU
            </p>
          </div>
          <div className="p-6 text-center space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              ID de Cuenta de Cobranza
            </p>
            <p className="text-2xl md:text-3xl font-mono tabular-nums font-bold text-foreground tracking-wide">
              {formalReservation.cuentaCobranzaId}
            </p>
            <p className="text-xs text-muted-foreground">
              Guarda este ID. Lo usarás para cualquier consulta sobre tu apartado.
            </p>
          </div>
        </div>

        {/* Validaciones */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Tu proceso de validación
          </h2>
          <div className="space-y-2">
            <ValidationStep
              icon={ShieldCheck}
              label="Identidad fiscal validada"
              detail={`RFC ${fiscalIdentity?.rfc ?? "—"}`}
              extra="Verificado con el SAT"
            />
            <ValidationStep
              icon={FileCheck}
              label="Cuenta de cobranza"
              detail={`CLABE ${virtualCLABE.match(/.{1,4}/g)?.join(" ") ?? virtualCLABE}`}
              extra={`Vinculada al RFC ${payment.emisorRFC || fiscalIdentity?.rfc || "—"}`}
            />
            <ValidationStep
              icon={Wallet}
              label="Pago recibido"
              detail={`$${payment.amountMXN.toLocaleString("es-MX")} MXN vía SPEI`}
              extra={`Tracking ${payment.speiTrackingKey}`}
            />
          </div>
        </div>

        {/* Resumen */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <p className="text-sm font-semibold text-foreground">Resumen del apartado</p>
          </div>
          <div className="p-5 space-y-3">
            {appliedFromPre > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pre-apartado aplicado</span>
                <span className="font-mono tabular-nums font-semibold text-success">
                  +${appliedFromPre.toLocaleString("es-MX")}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pago de hoy</span>
              <span className="font-mono tabular-nums font-semibold text-foreground">
                +${payment.amountMXN.toLocaleString("es-MX")}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-sm font-semibold text-foreground">Total apartado</span>
              <span className="font-mono tabular-nums text-lg font-bold text-foreground">
                ${totalApartado.toLocaleString("es-MX")} MXN
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Procesado el{" "}
              {detectedAt.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              a las{" "}
              {detectedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* Banner siguiente paso */}
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            📋 Próximo paso: completa tu expediente
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            En el portal te pediremos completar tus datos personales y subir documentos
            para preparar tu contrato preliminar. Toma 10-15 minutos.
          </p>
        </div>

        {/* CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate(`/en-adquisicion/${formalReservation.id}/expediente`)}
            className="h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            Ir a mi expediente
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              console.log("[SOZU] Descargar comprobante:", formalReservation.cuentaCobranzaId)
            }
            className="h-12 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar comprobante
          </button>
        </div>
      </div>
    </div>
  );
};

const ValidationStep = ({
  icon: Icon,
  label,
  detail,
  extra,
}: {
  icon: React.ElementType;
  label: string;
  detail: string;
  extra?: string;
}) => (
  <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
    <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4 text-success" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
      {extra && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{extra}</p>}
    </div>
    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-1" />
  </div>
);

export default ClienteConversionPage;
