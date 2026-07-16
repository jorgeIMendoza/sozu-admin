import { useState, useEffect } from "react";
import { Home, Clock, BookOpen, FileText, ShieldCheck, ArrowRight } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { OfertaComercial } from "@/lib/offers/offer-data";

interface Props {
  open: boolean;
  onClose: () => void;
  offer: OfertaComercial;
  onStartFormal: () => void;
}

const PhaseItem = ({ index, icon: Icon, phaseLabel, title, description }: {
  index: number; icon: typeof Clock; phaseLabel: string; title: string; description: string;
}) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center shrink-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      {index < 3 && <div className="w-px flex-1 bg-border mt-1" />}
    </div>
    <div className="min-w-0 pb-4">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary mb-1">{phaseLabel}</p>
      <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{description}</p>
    </div>
  </div>
);

const FormalReservationGateModal = ({ open, onClose, offer, onStartFormal }: Props) => {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update(); mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const { property, development } = offer;
  const propertyLabel = `${development?.legalName ?? property?.projectName ?? "Esta unidad"} · ${property?.unitNumber ?? "-"}`;

  const handleStartFormal = () => {
    sessionStorage.removeItem("sozu_pre_reservation_intent");
    sessionStorage.removeItem("sozu_pre_reservation_offer_id");
    onClose();
    onStartFormal();
  };

  const content = (
    <div className="flex flex-col overflow-y-auto">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
        <Home className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 id="formal-reservation-title" className="font-bold text-foreground text-sm leading-tight">¿Listo para apartar esta unidad?</h2>
          <p className="text-xs text-muted-foreground truncate">{propertyLabel}</p>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">El apartado tiene tres fases. Esto es lo que sigue:</p>
        <div>
          <PhaseItem index={1} icon={Clock} phaseLabel="Fase 1 · 5 minutos" title="Reservas tu unidad" description="Capturas tus datos básicos, validamos tu email, y activas una retención de $10,000 MXN en tu tarjeta de crédito por 5 días. No es un cobro." />
          <PhaseItem index={2} icon={BookOpen} phaseLabel="Fase 2 · sin presión" title="Revisas el contrato" description="Tu unidad queda reservada a tu nombre durante 5 días naturales mientras lees el contrato preliminar con calma y juntas tus documentos." />
          <PhaseItem index={3} icon={FileText} phaseLabel="Fase 3 · 5-8 minutos" title="Completas tu apartado" description="Confirmas tu tipo de comprador, validas tu RFC y haces una transferencia SPEI de $20,000 MXN que no es reembolsable." />
        </div>
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground leading-tight mb-1">Hold de tarjeta - no es un cobro</p>
              <p className="text-xs text-muted-foreground leading-relaxed">La retención de $10,000 MXN funciona como los hoteles al hacer check-in: queda bloqueada en tu línea de crédito pero no se cobra. Si decides no avanzar, expira sola a los 5 días sin cargo.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-5 pb-8 pt-4 border-t border-border/50 space-y-2 shrink-0">
        <button onClick={handleStartFormal} className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
          Comenzar fase 1 <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={onClose} className="w-full h-11 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors">Cerrar</button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent aria-labelledby="formal-reservation-title" className="p-0 max-w-md max-h-[85vh] overflow-y-auto [&>button:last-child]:hidden">{content}</DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent aria-labelledby="formal-reservation-title" side="bottom" className="h-[75dvh] p-0 rounded-t-2xl [&>button:last-child]:hidden">{content}</SheetContent>
    </Sheet>
  );
};

export default FormalReservationGateModal;
