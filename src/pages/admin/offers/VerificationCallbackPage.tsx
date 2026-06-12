import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useOfferStore } from "@/lib/offers/offer-data";

const VerificationCallbackPage = () => {
  const { prospectId } = useParams<{ prospectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const prospect = useOfferStore((s) =>
    s.prospects.find((p) => p.id === prospectId)
  );
  const verifyProspect = useOfferStore((s) => s.verifyProspect);

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  useEffect(() => {
    if (!prospect || !token) {
      setStatus("error");
      return;
    }
    const t = setTimeout(() => {
      const verified = verifyProspect(prospect.id);
      if (!verified) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setTimeout(() => {
        const pf = verified.pendingFlow;
        if (pf?.type === "formal_direct") {
          navigate(`/apartar/${pf.offerId}/continuar`, { replace: true });
        } else if (pf?.type === "pre_reservation") {
          navigate(`/oferta/${pf.offerId}/pre-apartar`, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }, 1400);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId, token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        {status === "verifying" && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              Verificando tu cuenta…
            </h1>
            <p className="text-sm text-muted-foreground">Solo tomará un momento.</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" strokeWidth={2.5} />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-foreground">Cuenta verificada</h1>
            <p className="text-sm text-muted-foreground">
              Te redirigimos para continuar donde te quedaste…
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-destructive/15 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              Enlace inválido o expirado
            </h1>
            <p className="text-sm text-muted-foreground">
              Solicita un nuevo enlace de verificación desde la pantalla anterior.
            </p>
            <button
              onClick={() => navigate("/")}
              className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Volver al inicio
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerificationCallbackPage;
