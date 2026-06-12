import { X, Clock, BookOpen, FileText, ShieldCheck, ArrowRight } from "lucide-react";
import type { OfertaComercial } from "@/lib/offers/offer-data";

interface Props {
  open: boolean;
  onClose: () => void;
  offer: OfertaComercial;
  onStartFormal: () => void;
}

const PhaseItem = ({
  index,
  icon: Icon,
  phaseLabel,
  title,
  description,
}: {
  index: number;
  icon: typeof Clock;
  phaseLabel: string;
  title: string;
  description: string;
}) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      {index < 3 && <div className="w-px flex-1 bg-border mt-1" />}
    </div>
    <div className="min-w-0 pb-5">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary mb-1">
        {phaseLabel}
      </p>
      <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{description}</p>
    </div>
  </div>
);

const FormalReservationGateModal = ({
  open,
  onClose,
  offer,
  onStartFormal,
}: Props) => {
  if (!open) return null;

  const development = offer.development;
  const property = offer.property;
  const propertyLabel = `${development?.legalName ?? property?.projectName ?? "Esta unidad"} · ${
    property?.unitNumber ?? "—"
  }`;

  const handleStartFormal = () => {
    sessionStorage.removeItem("sozu_pre_reservation_intent");
    sessionStorage.removeItem("sozu_pre_reservation_offer_id");
    onClose();
    onStartFormal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full md:max-w-md bg-card border border-border rounded-t-2xl md:rounded-2xl p-6 shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-1">
              Apartado formal
            </p>
            <h2 className="text-lg font-bold text-foreground leading-tight">
              ¿Listo para apartar esta unidad?
            </h2>
            <p className="text-xs text-muted-foreground mt-1 truncate">{propertyLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            El apartado tiene tres fases. Esto es lo que sigue:
          </p>

          <div>
            <PhaseItem
              index={1}
              icon={Clock}
              phaseLabel="Fase 1 · 5 minutos"
              title="Reservas tu unidad"
              description="Capturas tus datos básicos, validamos tu email, y activas una retención de $10,000 MXN en tu tarjeta de crédito por 5 días. No es un cobro."
            />
            <PhaseItem
              index={2}
              icon={BookOpen}
              phaseLabel="Fase 2 · sin presión"
              title="Revisas el contrato"
              description="Tu unidad queda reservada a tu nombre durante 5 días naturales mientras lees el contrato preliminar con calma y juntas tus documentos."
            />
            <PhaseItem
              index={3}
              icon={FileText}
              phaseLabel="Fase 3 · 5-8 minutos"
              title="Completas tu apartado"
              description="Confirmas tu tipo de comprador, validas tu RFC con tu CSF del SAT, y haces una transferencia SPEI de $20,000 MXN que no es reembolsable."
            />
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground leading-tight mb-1">
                  Modelo de apartado con hold de tarjeta
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  La retención de $10,000 MXN es el mismo mecanismo que usan los hoteles al
                  hacer check-in: queda bloqueada en tu línea de crédito pero no se cobra. Si
                  decides no avanzar, el hold expira solo a los 5 días sin cargo. Si decides
                  avanzar, lo liberamos automáticamente al recibir tu transferencia SPEI.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={handleStartFormal}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            Comenzar fase 1: reservar mi unidad
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormalReservationGateModal;
