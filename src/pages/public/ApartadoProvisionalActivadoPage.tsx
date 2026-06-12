import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { useOfferById, formatMXN } from "@/lib/offers/offer-data";
import { useAgentById, type Agent } from "@/lib/offers/agent-data";
import { supabase } from "@/integrations/supabase/client";
import PublicShell from "@/components/offer/PublicShell";
import DevelopmentLogo from "@/components/offer/DevelopmentLogo";
import {
  ArrowRight,
  Download,
  CheckCircle2,
  CreditCard,
  MapPin,
  Calendar,
  Hash,
  ShieldCheck,
  FileText,
} from "lucide-react";

const ApartadoProvisionalActivadoPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const navigate = useNavigate();

  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );

  const offer = useOfferById(formalReservation?.offerId ?? "");
  const mockAgent = useAgentById(offer?.agentId ?? "");
  const [agentFromDB, setAgentFromDB] = useState<Agent | undefined>(undefined);
  const agentOfferId = formalReservation?.offerId;
  useEffect(() => {
    if (!agentOfferId) return;
    (async () => {
      const { data: oferta } = await supabase
        .from("ofertas").select("email_creador").eq("id", agentOfferId).single();
      if (!oferta?.email_creador) return;
      const { data: usuario } = await supabase
        .from("usuarios").select("id_persona").eq("email", oferta.email_creador).single();
      if (!usuario?.id_persona) return;
      const { data: persona } = await supabase
        .from("personas").select("nombre_legal, telefono, clave_pais_telefono").eq("id", usuario.id_persona).single();
      if (!persona?.nombre_legal) return;
      const countryCode = (persona.clave_pais_telefono ?? "+52").replace("+", "");
      const rawPhone = (persona.telefono ?? "").replace(/\s/g, "");
      setAgentFromDB({
        id: "", fullName: persona.nombre_legal,
        firstName: persona.nombre_legal.split(" ")[0],
        title: "", photoUrl: "", email: "",
        phone: rawPhone ? `${persona.clave_pais_telefono ?? "+52"} ${persona.telefono ?? ""}` : "",
        whatsapp: rawPhone ? `${countryCode}${rawPhone}` : "",
        isAllied: true,
      });
    })();
  }, [agentOfferId]);
  const agent = agentFromDB ?? mockAgent ?? undefined;

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

  const specs = offer ? [
    offer.property.area,
    offer.property.bedrooms ? `${offer.property.bedrooms} rec.` : null,
    offer.property.bathrooms ? `${offer.property.bathrooms} baños` : null,
  ].filter(Boolean) as string[] : [];

  return (
    <PublicShell
      noFooter
      agent={agent}
      developmentLogoUrl={offer?.development?.logoUrl ?? offer?.development?.logoUrlInverse}
      developmentName={offer?.property.projectName}
    >

      {/* ── DESKTOP: split panel ── */}
      <div className="hidden lg:grid lg:grid-cols-[420px_1fr] lg:h-[calc(100vh-56px)]">

        {/* Left — property confirmed */}
        <div className="relative flex flex-col border-r border-border overflow-hidden">
          <div className="absolute inset-0 bg-muted/[0.07] pointer-events-none" />

          <div className="relative flex flex-col h-full px-12 py-10">

            {/* Logo */}
            <div className="flex justify-center mb-8">
              {offer?.development && (offer.development.logoUrl || offer.development.logoUrlInverse) ? (
                <div className="h-11 flex items-center justify-center">
                  <DevelopmentLogo
                    development={offer.development}
                    developmentName={offer.property.projectName}
                    variant="section"
                    className="!h-full"
                  />
                </div>
              ) : offer ? (
                <p className="text-[10px] uppercase tracking-[0.32em] font-bold text-muted-foreground/40">
                  {offer.property.projectName}
                </p>
              ) : null}
            </div>

            {/* Center — property identity */}
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 min-h-0">
              {offer && (
                <>
                  <div className="space-y-2">
                    <p className="text-[9px] uppercase tracking-[0.32em] font-semibold text-muted-foreground/40">
                      Unidad reservada
                    </p>
                    <h2 className="text-[2.2rem] font-bold text-foreground leading-none tracking-tight">
                      {offer.property.unitModel}
                    </h2>
                    <p className="text-sm text-muted-foreground font-medium">
                      {offer.property.unitNumber}
                    </p>
                  </div>

                  {specs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {specs.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] font-medium text-muted-foreground bg-background/80 px-2.5 py-1 rounded-full border border-border/60"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {offer.location?.address && (
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/55">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {offer.location.address}
                    </p>
                  )}

                  <div className="w-full pt-5 border-t border-border/50 text-center">
                    <p className="text-[9px] uppercase tracking-[0.28em] font-semibold text-muted-foreground/40 mb-2">
                      Precio de lista
                    </p>
                    <p className="text-[2.8rem] font-bold tabular-nums text-foreground leading-none tracking-tight">
                      {formatMXN(offer.property.listPrice)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Hold badge — bottom */}
            <div className="mt-8 flex items-center gap-3 p-3.5 rounded-xl bg-primary/[0.06] border border-primary/20">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                  Retención activa
                </p>
                <p className="text-sm font-bold tabular-nums text-foreground">
                  {formatMXN(hold.amountMXN)} · {hold.cardBrand.toUpperCase()} ****{hold.cardLast4}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Right — success + details */}
        <div className="flex items-center justify-center px-12 overflow-y-auto">
          <div className="w-full max-w-[400px] py-8 space-y-6">

            {/* Success header */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Apartado provisional activado
                </p>
                <h1 className="text-2xl font-bold text-foreground leading-tight">
                  Tu unidad está reservada
                </h1>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Tienes{" "}
                <strong className="text-foreground">
                  {daysRemaining}d {hoursRemaining}h
                </strong>{" "}
                para revisar el contrato y completar tu apartado con transferencia SPEI.
              </p>
            </div>

            {/* Details */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <InfoRow
                icon={Calendar}
                label="Vence el"
                value={expiresFormatted}
              />
              <InfoRow
                icon={CreditCard}
                label="Retención autorizada"
                value={`${formatMXN(hold.amountMXN)} · ${hold.cardBrand.toUpperCase()} ****${hold.cardLast4}`}
              />
              <InfoRow
                icon={Hash}
                label="ID del apartado"
                value={formalReservation.id}
                mono
              />
            </div>

            {/* Next step note */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-border/60 bg-muted/30">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-foreground mb-0.5">
                  Siguiente paso: revisa tu contrato
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  En tu dashboard encontrarás el contrato preliminar para revisar con calma.
                  Contacta a tu asesor antes de avanzar con el pago si tienes dudas.
                </p>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => navigate(`/apartado-provisional/${formalReservation.id}`)}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                Ir a mi dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => console.log("Mock: descarga comprobante del hold")}
                className="w-full h-11 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar comprobante
              </button>
            </div>

            {/* Security */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Retención protegida bajo estándar PCI-DSS. SOZU no recibe el dinero —
                solo está bloqueado en tu línea de crédito.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="lg:hidden px-4 py-6 space-y-5 max-w-md mx-auto">

        {/* Success */}
        <div className="text-center space-y-3 py-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Apartado provisional activado
            </p>
            <h1 className="text-2xl font-bold text-foreground leading-tight mt-1">
              Tu unidad está reservada
            </h1>
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Tienes{" "}
            <strong className="text-foreground">{daysRemaining}d {hoursRemaining}h</strong>{" "}
            para revisar el contrato y completar tu apartado.
          </p>
        </div>

        {/* Property card */}
        {offer && (
          <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-2">
            <p className="text-[9px] uppercase tracking-[0.28em] font-semibold text-muted-foreground/40">
              Unidad reservada
            </p>
            <p className="text-2xl font-bold text-foreground">{offer.property.unitModel}</p>
            <p className="text-xs text-muted-foreground">{offer.property.unitNumber}</p>
          </div>
        )}

        {/* Details */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <InfoRow icon={Calendar} label="Vence el" value={expiresFormatted} />
          <InfoRow
            icon={CreditCard}
            label="Retención"
            value={`${formatMXN(hold.amountMXN)} · ${hold.cardBrand.toUpperCase()} ****${hold.cardLast4}`}
          />
          <InfoRow icon={Hash} label="ID del apartado" value={formalReservation.id} mono />
        </div>

        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-border/60 bg-muted/30">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-foreground mb-0.5">Siguiente paso</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Revisa el contrato preliminar en tu dashboard antes de avanzar con el pago.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => navigate(`/apartado-provisional/${formalReservation.id}`)}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
          >
            Ir a mi dashboard <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => console.log("Mock: descarga comprobante del hold")}
            className="w-full h-11 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />Descargar comprobante
          </button>
        </div>
      </div>

    </PublicShell>
  );
};

const InfoRow = ({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0">
    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
        {label}
      </p>
      <p className={`text-sm font-medium text-foreground mt-0.5 break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  </div>
);

export default ApartadoProvisionalActivadoPage;
