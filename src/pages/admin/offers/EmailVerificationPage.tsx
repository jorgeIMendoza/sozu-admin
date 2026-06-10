import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mail, RefreshCw, Edit3, Eye, CheckCircle2, MessageCircle } from "lucide-react";
import { useOfferStore, type Prospect } from "@/lib/offers/offer-data";
import EmailPreviewModal from "@/components/admin/offers/verification/EmailPreviewModal";

const continueAfterVerification = (
  prospect: Prospect,
  navigate: (path: string, opts?: { replace?: boolean }) => void
) => {
  const pf = prospect.pendingFlow;
  if (!pf) {
    navigate("/", { replace: true });
    return;
  }
  if (pf.type === "formal_direct") {
    navigate(`/apartar/${pf.offerId}/continuar`, { replace: true });
  } else {
    navigate(`/oferta/${pf.offerId}/pre-apartar`, { replace: true });
  }
};

const EmailVerificationPage = () => {
  const { prospectId } = useParams<{ prospectId: string }>();
  const navigate = useNavigate();
  const prospect = useOfferStore((s) =>
    s.prospects.find((p) => p.id === prospectId)
  );

  const [previewOpen, setPreviewOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (prospect && prospect.verificationStatus === "verified") {
      continueAfterVerification(prospect, navigate);
    }
  }, [prospect, navigate]);

  if (!prospect) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-bold text-foreground">Sesión expirada</h1>
          <p className="text-sm text-muted-foreground">
            No encontramos tu información. Vuelve a empezar.
          </p>
          <button
            onClick={() => navigate("/")}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const flowType = prospect.pendingFlow?.type ?? "formal_direct";
  const flowLabel = flowType === "formal_direct" ? "apartado formal" : "pre-apartado";

  const handleResend = () => {
    setResending(true);
    setTimeout(() => {
      setResending(false);
      setResent(true);
      setTimeout(() => setResent(false), 3000);
    }, 800);
  };

  const handleSimulateClick = () => {
    navigate(`/verificar/${prospect.id}?token=mock_token`);
  };

  // SWAP POINT: en producción, cambiar a `import.meta.env.DEV` para ocultar el botón demo.
  // Durante la fase de mockup/demo lo dejamos hardcoded a true para permitir avanzar en el flujo
  // independiente del modo de build de Lovable (que en preview público resuelve DEV como false).
  const showDevPreview = true;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Verificación de email
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
            Revisa tu correo
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Te enviamos un enlace de verificación a{" "}
            <span className="font-semibold text-foreground">{prospect.email}</span>. Haz clic en el
            enlace para continuar con tu {flowLabel}.
          </p>
        </div>

        <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Email enviado</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              El enlace expira en 30 minutos.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {showDevPreview && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              aria-label="Ver el email enviado en modo demo"
              className="w-full h-11 rounded-xl bg-warning/[0.08] border border-dashed border-warning/40 text-warning text-xs font-semibold hover:bg-warning/[0.12] transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver email enviado</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-warning/15 text-[9px] font-bold uppercase tracking-wider">
                Demo
              </span>
            </button>
          )}

          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full h-11 rounded-xl bg-card border border-border text-foreground text-xs font-semibold hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {resending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Enviando…
              </>
            ) : resent ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                Email reenviado
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Reenviar email
              </>
            )}
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-full h-11 rounded-xl text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            ¿Email incorrecto? Cambiar
          </button>
        </div>

        <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
          ¿No te llegó el email? Revisa tu carpeta de spam o promociones. Si sigues sin recibirlo,{" "}
          <a
            href="https://wa.me/523300000000"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-semibold inline-flex items-center gap-1"
          >
            <MessageCircle className="w-3 h-3" />
            contáctanos por WhatsApp
          </a>
          .
        </p>
      </div>

      {previewOpen && (
        <EmailPreviewModal
          prospect={prospect}
          flowType={flowType}
          onClose={() => setPreviewOpen(false)}
          onVerify={handleSimulateClick}
        />
      )}
    </div>
  );
};

export default EmailVerificationPage;
