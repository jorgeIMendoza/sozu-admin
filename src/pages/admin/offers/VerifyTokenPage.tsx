import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/offers/auth-data";
import { useOfferStore } from "@/lib/offers/offer-data";
import PublicShell from "@/components/admin/offers/offer/PublicShell";
import { Loader2, AlertCircle, Check } from "lucide-react";

const VerifyTokenPage = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const verifyToken = useAuthStore((s) => s.verifyToken);
  const getMagicLinkByToken = useAuthStore((s) => s.getMagicLinkByToken);
  const createSessionForProspect = useAuthStore((s) => s.createSessionForProspect);
  const prospects = useOfferStore((s) => s.prospects);

  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMessage("Link inválido.");
      return;
    }

    const timer = setTimeout(() => {
      const request = getMagicLinkByToken(token);
      const result = verifyToken(token);

      if (!result.success || !request) {
        setState("error");
        setErrorMessage(result.error ?? "No se pudo procesar el link.");
        return;
      }

      const prospect = prospects.find((p) => p.id === request.prospectId);
      if (!prospect) {
        setState("error");
        setErrorMessage("No encontramos tu información. Contacta a tu agente.");
        return;
      }

      createSessionForProspect({
        prospectId: prospect.id,
        email: prospect.email,
        fullName: prospect.fullName,
      });

      setState("success");

      const redirectPath = searchParams.get("then") || `/mi-pre-apartado/${request.reservationId}`;
      setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 1200);
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <PublicShell>
      <div className="max-w-md mx-auto px-4 md:px-6 py-20 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin mb-5" />
            <h1 className="text-xl md:text-2xl font-bold mb-2">Verificando tu acceso...</h1>
            <p className="text-sm text-muted-foreground">Un momento por favor.</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-5">
              <Check className="w-8 h-8 text-success" strokeWidth={3} />
            </div>
            <h1 className="text-xl md:text-2xl font-bold mb-2">¡Acceso confirmado!</h1>
            <p className="text-sm text-muted-foreground">Llevándote a tu pre-apartado...</p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-5">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold mb-2">No pudimos verificar tu link</h1>
            <p className="text-sm text-muted-foreground mb-7 leading-relaxed">{errorMessage}</p>

            <div className="space-y-2">
              <button
                onClick={() => navigate("/acceder")}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Solicitar un nuevo link
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full h-11 rounded-lg bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors"
              >
                Volver al inicio
              </button>
            </div>
          </>
        )}
      </div>
    </PublicShell>
  );
};

export default VerifyTokenPage;
