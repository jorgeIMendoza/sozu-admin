import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Mail, RefreshCw, ArrowLeft } from "lucide-react";
import { useOfertaFlowStore } from "@/lib/oferta-flow-store";
const sozuLogo = "/sozu-logo.png";

export default function VerificarEmailPage() {
  const { ofertaId } = useParams<{ ofertaId: string }>();
  const navigate = useNavigate();
  const { prospectData } = useOfertaFlowStore();

  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const email = prospectData?.email ?? "tu correo";

  const handleResend = () => {
    setResending(true);
    // TODO: call resend magic link API
    setTimeout(() => {
      setResending(false);
      setResent(true);
    }, 1200);
  };

  const handleDemo = () => {
    // Simulates clicking the magic link — goes to callback with demo token
    navigate(`/oferta/${ofertaId}/verificacion-ok?token=demo`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Regresar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <img src={sozuLogo} alt="SOZU" className="h-6 w-auto dark:invert" />
          <div className="w-8" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6 text-center">

          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Mail className="w-10 h-10 text-primary" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-[22px] font-display font-bold text-foreground tracking-tight">
              Revisa tu correo
            </h1>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Enviamos un enlace de acceso a
            </p>
            <p className="text-[14px] font-semibold text-foreground">{email}</p>
          </div>

          {/* Info card */}
          <div className="rounded-2xl bg-card border border-border p-5 text-left space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-primary text-xs font-bold">1</span>
              </div>
              <p className="text-[13px] text-foreground">
                Abre el correo de <span className="font-semibold">hola@sozu.com</span>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-primary text-xs font-bold">2</span>
              </div>
              <p className="text-[13px] text-foreground">
                Haz click en <span className="font-semibold">"Verificar mi correo"</span>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-primary text-xs font-bold">3</span>
              </div>
              <p className="text-[13px] text-foreground">
                Regresa automáticamente para continuar
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
              El enlace expira en 30 minutos. Revisa también tu carpeta de spam.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {resent ? (
              <div className="text-[13px] text-primary font-medium py-2">
                ✓ Enlace reenviado
              </div>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full h-10 rounded-xl border border-border text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-muted transition-colors disabled:opacity-50"
              >
                {resending ? (
                  <span className="w-4 h-4 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reenviar enlace
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => navigate(-1)}
              className="w-full h-10 rounded-xl text-[13px] text-muted-foreground inline-flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
            >
              ¿Email incorrecto? Cambiar
            </button>
          </div>

          {/* Dev mode demo button */}
          <div className="pt-4 border-t border-dashed border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
              Modo demo
            </p>
            <button
              onClick={handleDemo}
              className="w-full h-9 rounded-xl border border-dashed border-border text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Simular click en enlace →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
