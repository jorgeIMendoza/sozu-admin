import { useEffect } from "react";
import { X, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import type { Prospect } from "@/lib/offers/offer-data";

interface Props {
  prospect: Prospect;
  flowType: "formal_direct" | "pre_reservation";
  onClose: () => void;
  onVerify: () => void;
}

const EmailPreviewModal = ({ prospect, flowType, onClose, onVerify }: Props) => {
  const firstName = prospect.fullName.split(" ")[0] || "Hola";
  const isFormal = flowType === "formal_direct";
  const subject = isFormal
    ? "Confirma tu email para apartar tu unidad SOZU"
    : "Confirma tu email para tu pre-apartado SOZU";
  const cta = isFormal ? "Validar mi cuenta y continuar" : "Validar y reservar mi unidad";
  const flowLabel = isFormal ? "apartado formal" : "pre-apartado";

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa del email enviado"
      className="fixed inset-0 z-[100] bg-foreground/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-card rounded-t-2xl md:rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground">Vista previa del email</p>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/15 text-warning">
              Modo demo
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="overflow-y-auto">
          <div className="px-5 py-3 bg-muted/40 border-b border-border space-y-1">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">De:</span> SOZU &lt;no-reply@sozu.com&gt;
            </p>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Para:</span> {prospect.email}
            </p>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Asunto:</span> {subject}
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="pb-3 border-b border-border">
              <p className="font-display text-base font-bold tracking-tight text-foreground">SOZU</p>
            </div>

            <h2 className="text-lg font-bold text-foreground">Hola {firstName},</h2>
            <p className="text-sm text-foreground leading-relaxed">
              Recibimos tu solicitud para iniciar tu {flowLabel} en SOZU. Para continuar de forma
              segura, necesitamos confirmar que este email te pertenece.
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              Haz clic en el botón para validar tu cuenta y continuar exactamente donde lo dejaste:
            </p>

            <div className="py-2">
              <button
                onClick={onVerify}
                className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-success text-success-foreground text-sm font-semibold hover:bg-success/90 transition-colors"
              >
                {cta}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">
                O copia este enlace en tu navegador:
              </p>
              <p className="text-[11px] font-mono break-all text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                https://app.sozu.com/verificar/{prospect.id}?token=mock_token_demo
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 px-3 py-2.5 flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Este enlace expira en 30 minutos. Si no fuiste tú, ignora este correo de forma
                segura.
              </p>
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                © SOZU 2026 · Comercializador inmobiliario · Av. Vallarta, Guadalajara, Jalisco.
                <br />
                Aviso de Privacidad · Términos de Servicio
              </p>
            </div>
          </div>
        </div>

        <footer className="px-5 py-4 border-t border-border bg-muted/30 flex-shrink-0">
          <button
            onClick={onVerify}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            Simular clic en el enlace
          </button>
          <p className="mt-2 text-[10px] text-center text-muted-foreground">
            En producción, el usuario haría clic en el botón verde dentro del email real.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default EmailPreviewModal;
