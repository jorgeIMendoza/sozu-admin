import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useOfferStore } from "@/lib/offers/offer-data";
import { useAuthStore, type MagicLinkRequest } from "@/lib/offers/auth-data";
import { useAgentById } from "@/lib/offers/agent-data";
import PublicShell from "@/components/admin/offers/offer/PublicShell";
import MagicLinkEmailPreview from "@/components/admin/offers/offer/MagicLinkEmailPreview";
import { Mail, ArrowRight, ShieldCheck, ArrowLeft, RefreshCw, ExternalLink } from "lucide-react";

const RequestAccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectAfter = searchParams.get("redirect") ?? "";

  const requestMagicLink = useAuthStore((s) => s.requestMagicLink);
  const prospects = useOfferStore((s) => s.prospects);
  const preReservations = useOfferStore((s) => s.preReservations);
  const offers = useOfferStore((s) => s.offers);

  const [step, setStep] = useState<"form" | "sent" | "not-found">("form");
  const [email, setEmail] = useState("");
  const [sentRequest, setSentRequest] = useState<MagicLinkRequest | null>(null);

  const matchedReservation = sentRequest
    ? preReservations.find((r) => r.id === sentRequest.reservationId)
    : undefined;
  const matchedProspect = sentRequest
    ? prospects.find((p) => p.id === sentRequest.prospectId)
    : undefined;
  const matchedOffer = matchedReservation
    ? offers.find((o) => o.id === matchedReservation.offerId)
    : undefined;
  const agent = useAgentById(matchedOffer?.agentId ?? "");

  const canSubmit = /\S+@\S+\.\S+/.test(email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const normalized = email.toLowerCase().trim();
    const prospect = prospects.find((p) => p.email.toLowerCase() === normalized);

    if (!prospect) {
      setStep("not-found");
      return;
    }

    const reservation = preReservations
      .filter((r) => r.prospectId === prospect.id && r.status === "active")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!reservation) {
      setStep("not-found");
      return;
    }

    const offer = offers.find((o) => o.id === reservation.offerId);
    if (!offer) {
      setStep("not-found");
      return;
    }

    const request = requestMagicLink({
      email: normalized,
      prospectId: prospect.id,
      reservationId: reservation.id,
      agentId: offer.agentId,
    });

    setSentRequest(request);
    setStep("sent");
  };

  const handleResend = () => {
    if (!sentRequest) return;
    const newRequest = requestMagicLink({
      email: sentRequest.email,
      prospectId: sentRequest.prospectId,
      reservationId: sentRequest.reservationId,
      agentId: sentRequest.agentId,
    });
    setSentRequest(newRequest);
  };

  const handleOpenLink = () => {
    if (!sentRequest) return;
    const path = redirectAfter || `/mi-pre-apartado/${sentRequest.reservationId}`;
    navigate(`/acceder/${sentRequest.token}?then=${encodeURIComponent(path)}`);
  };

  return (
    <PublicShell>
      <div className="max-w-md mx-auto px-4 md:px-6 py-10 md:py-14">
        {step === "form" && (
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Atrás
            </button>

            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Mail className="w-6 h-6 text-primary" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold mb-3">Accede a tu pre-apartado</h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-7">
              Te enviamos un link seguro al correo que registraste cuando hiciste tu pre-apartado.
              Sin contraseñas — tu agente y nosotros ya te conocemos.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Tu correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  autoFocus
                  className="w-full h-11 px-3 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-colors ${
                  canSubmit
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                Enviar mi link de acceso
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">No usamos contraseñas.</span>{" "}
                    Te enviamos un link único que expira en 30 minutos. Es más seguro que recordar
                    un password.
                  </p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    Si no recuerdas qué correo usaste, contacta a tu agente desde la oferta original.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "sent" && sentRequest && (
          <div>
            <button
              onClick={() => {
                setStep("form");
                setEmail("");
                setSentRequest(null);
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>

            <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center mb-5">
              <Mail className="w-6 h-6 text-success" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold mb-3">Revisa tu correo</h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Enviamos un link de acceso a{" "}
              <span className="font-semibold text-foreground">{sentRequest.email}</span>.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Toca el botón "Acceder" desde tu email para entrar a tu pre-apartado.
            </p>

            <div className="mb-6">
              <MagicLinkEmailPreview
                request={sentRequest}
                agent={agent}
                recipientName={matchedProspect?.fullName}
              />
            </div>

            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 mb-4">
              <p className="text-[11px] uppercase tracking-wider font-bold text-warning mb-1.5">
                Modo demo
              </p>
              <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
                En producción tendrías que abrir tu correo real para usar el link. En este demo
                puedes abrirlo directo desde aquí:
              </p>
              <button
                onClick={handleOpenLink}
                className="w-full h-10 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs font-semibold hover:bg-warning/20 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir link como si viniera del email
              </button>
            </div>

            <button
              onClick={handleResend}
              className="w-full h-11 rounded-lg bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reenviar el link
            </button>
          </div>
        )}

        {step === "not-found" && (
          <div>
            <button
              onClick={() => {
                setStep("form");
                setEmail("");
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>

            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-5">
              <Mail className="w-6 h-6 text-muted-foreground" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold mb-3">
              No encontramos un pre-apartado activo
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              El correo <span className="font-semibold text-foreground">{email}</span> no tiene
              ningún pre-apartado activo en SOZU. Esto puede ser porque:
            </p>

            <ul className="space-y-2 mb-7">
              <li className="text-[13px] text-foreground leading-relaxed">
                · El pre-apartado ya fue cancelado o avanzó al apartado formal.
              </li>
              <li className="text-[13px] text-foreground leading-relaxed">
                · Usaste un correo diferente cuando hiciste el pre-apartado.
              </li>
              <li className="text-[13px] text-foreground leading-relaxed">
                · Aún no has hecho un pre-apartado en SOZU.
              </li>
            </ul>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setStep("form");
                  setEmail("");
                }}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Intentar con otro correo
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full h-11 rounded-lg bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  );
};

export default RequestAccessPage;
