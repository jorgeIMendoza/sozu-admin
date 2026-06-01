import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useOfertaFlowStore } from "@/lib/oferta-flow-store";
import sozuLogo from "@/assets/sozu-logo.png";

type State = "verifying" | "success" | "error";

export default function VerificacionCallbackPage() {
  const { ofertaId } = useParams<{ ofertaId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { setVerified } = useOfertaFlowStore();

  const [state, setState] = useState<State>("verifying");

  useEffect(() => {
    const run = async () => {
      if (!token) { setState("error"); return; }

      // TODO: validate real token via Supabase edge function
      // For demo: accept any token
      await new Promise((r) => setTimeout(r, 1200));

      if (token === "demo" || token.length > 3) {
        setVerified();
        setState("success");
        setTimeout(() => navigate(`/oferta/${ofertaId}/tipo-comprador`), 1500);
      } else {
        setState("error");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <img src={sozuLogo} alt="SOZU" className="h-7 w-auto dark:invert mb-12" />

      {state === "verifying" && (
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-[14px] font-semibold text-foreground">Verificando tu correo…</p>
          <p className="text-[13px] text-muted-foreground">Un momento</p>
        </div>
      )}

      {state === "success" && (
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          <p className="text-[14px] font-semibold text-foreground">¡Correo verificado!</p>
          <p className="text-[13px] text-muted-foreground">Redirigiendo…</p>
        </div>
      )}

      {state === "error" && (
        <div className="text-center space-y-4 max-w-sm">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-[14px] font-semibold text-foreground">Enlace inválido o expirado</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            El enlace de verificación expiró o ya fue usado. Solicita uno nuevo desde la pantalla anterior.
          </p>
          <button
            onClick={() => navigate(`/oferta/${ofertaId}/verificar-email`)}
            className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors"
          >
            Solicitar nuevo enlace
          </button>
        </div>
      )}
    </div>
  );
}
