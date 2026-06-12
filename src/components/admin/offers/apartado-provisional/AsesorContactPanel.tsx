import { MessageCircle, Phone, Mail } from "lucide-react";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";

// SWAP POINT: datos del asesor desde el offer real
const ADVISOR = {
  name: "Ramón Escobar",
  role: "Agente Inmobiliario Senior",
  phone: "523310137670",
  phoneDisplay: "+52 33 1013 7670",
  email: "joseramon.escobar@sozu.com",
};

const AsesorContactPanel = ({ formalReservation }: { formalReservation: FormalReservation }) => {
  const handleWhatsApp = () => {
    const clientName = formalReservation.fiscalIdentity?.legalName ?? "cliente";
    const msg = encodeURIComponent(
      `Hola ${ADVISOR.name}, soy ${clientName} (apartado ${formalReservation.id}). Tengo dudas sobre el contrato preliminar.`
    );
    window.open(`https://wa.me/${ADVISOR.phone}?text=${msg}`, "_blank");
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="bg-muted/30 px-4 py-2.5 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tu asesor
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{ADVISOR.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{ADVISOR.role}</p>
        </div>

        <button
          type="button"
          onClick={handleWhatsApp}
          className="w-full h-10 rounded-xl bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp directo
        </button>

        <div className="space-y-1.5 pt-2 border-t border-border">
          <a
            href={`tel:+${ADVISOR.phone}`}
            className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Phone className="w-3 h-3" />
            {ADVISOR.phoneDisplay}
          </a>
          <a
            href={`mailto:${ADVISOR.email}`}
            className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors break-all"
          >
            <Mail className="w-3 h-3 flex-shrink-0" />
            {ADVISOR.email}
          </a>
        </div>
      </div>
    </div>
  );
};

export default AsesorContactPanel;
