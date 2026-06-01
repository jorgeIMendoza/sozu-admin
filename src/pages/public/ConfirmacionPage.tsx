import { useParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, Calendar, FileText, CreditCard, MessageCircle, ArrowRight } from "lucide-react";
import { useOfertaFlowStore } from "@/lib/oferta-flow-store";
import sozuLogo from "@/assets/sozu-logo.png";

const MOCK_AGENT = {
  nombre: "Ramón Escobar",
  whatsapp: "523310137670",
};

const NEXT_STEPS = [
  {
    icon: FileText,
    step: "1",
    title: "Revisa el contrato preliminar",
    desc: "Tienes 5 días para leerlo con calma. Te lo enviamos a tu correo.",
  },
  {
    icon: CreditCard,
    step: "2",
    title: "Completa tu expediente",
    desc: "Sube tu identificación oficial y documentos requeridos según tu tipo de comprador.",
  },
  {
    icon: CheckCircle2,
    step: "3",
    title: "Transfiere $20,000 MXN",
    desc: "Una vez firmado el contrato, realizas la transferencia SPEI para formalizar el apartado.",
  },
];

export default function ConfirmacionPage() {
  const { ofertaId } = useParams<{ ofertaId: string }>();
  const navigate = useNavigate();
  const { holdData, prospectData } = useOfertaFlowStore();

  const folio = holdData?.folio ?? "PRE-XXXXXX";
  const expiresAt = holdData?.expiresAt
    ? new Date(holdData.expiresAt).toLocaleDateString("es-MX", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  const waMessage = encodeURIComponent(
    `Hola ${MOCK_AGENT.nombre}, acabo de pre-apartar una unidad. Mi folio es ${folio}. ¿Puedes guiarme en los siguientes pasos?`
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-center">
          <img src={sozuLogo} alt="SOZU" className="h-6 w-auto dark:invert" />
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

          {/* Hero */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-[24px] font-display font-bold text-foreground tracking-tight">
                ¡Unidad pre-apartada!
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1.5">
                {prospectData?.fullName ?? "Tu propiedad"} está reservada a tu nombre
              </p>
            </div>
          </div>

          {/* Folio card */}
          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Folio de pre-apartado
                </p>
                <p className="text-[22px] font-bold text-foreground tabular-nums mt-0.5">{folio}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-xl">🏠</span>
              </div>
            </div>

            <div className="border-t border-border pt-3 grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] text-muted-foreground">Retención activa</p>
                <p className="font-semibold text-foreground tabular-nums">$10,000 MXN</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Vence
                </p>
                <p className="font-semibold text-foreground">{expiresAt}</p>
              </div>
            </div>
          </div>

          {/* Next steps */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Qué sigue
              </h2>
            </div>
            <div className="space-y-4">
              {NEXT_STEPS.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">{s.title}</p>
                      <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent CTA */}
          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                ¿Tienes dudas?
              </h2>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Tu asesor <span className="font-semibold text-foreground">{MOCK_AGENT.nombre}</span> está
              disponible por WhatsApp para acompañarte en cada paso.
            </p>
            <a
              href={`https://wa.me/${MOCK_AGENT.whatsapp}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Escribir a mi asesor
            </a>
          </div>

          {/* Back to offer */}
          <div className="text-center pb-6">
            <Link
              to={`/oferta/${ofertaId}`}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Volver a la oferta
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
