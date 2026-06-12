import { User, Globe, Building2, Users, Check, ArrowRight } from "lucide-react";
import {
  useFormalReservationStore,
  BUYER_TYPE_LABELS,
  type BuyerType,
  type FormalReservation,
} from "@/lib/offers/formal-reservation-data";

interface Props {
  formalReservation: FormalReservation;
}

const BUYER_TYPE_ICONS: Record<BuyerType, typeof User> = {
  individual_mexican: User,
  individual_foreign: Globe,
  legal_entity: Building2,
  copropiedad: Users,
};

const BUYER_TYPE_REQUIREMENTS: Record<BuyerType, string> = {
  individual_mexican: "Requiere: INE, CURP, RFC, comprobante de domicilio",
  individual_foreign: "Requiere: Pasaporte, visa FM2/FM3, comprobante",
  legal_entity: "Requiere: Acta constitutiva, poder, RFC PM, INE rep legal",
  copropiedad: "Requiere: Docs de ambos copropietarios (se invita al segundo después)",
};

const Step1BuyerType = ({ formalReservation }: Props) => {
  const setBuyerType = useFormalReservationStore((s) => s.setBuyerType);
  const setCurrentStep = useFormalReservationStore((s) => s.setCurrentStep);

  const handleSelect = (type: BuyerType) => {
    setBuyerType(formalReservation.id, type);
  };

  const handleContinue = () => {
    if (formalReservation.buyerType) {
      setCurrentStep(formalReservation.id, 2);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Paso 1 de 6 · Identificación
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
          ¿Cómo realizarás esta compra?
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Esto define qué documentos necesitamos. Puedes ajustar tu selección más adelante
          si tu situación cambia.
        </p>
      </div>

      <div className="space-y-3">
        {(Object.keys(BUYER_TYPE_LABELS) as BuyerType[]).map((type) => {
          const info = BUYER_TYPE_LABELS[type];
          const Icon = BUYER_TYPE_ICONS[type];
          const isSelected = formalReservation.buyerType === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => handleSelect(type)}
              className={`w-full text-left rounded-2xl p-5 md:p-6 transition-all relative ${
                isSelected
                  ? "bg-primary/[0.04] border-2 border-primary"
                  : "bg-card border-2 border-border hover:border-foreground/30"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-base">{info.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    {info.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {BUYER_TYPE_REQUIREMENTS[type]}
                  </p>
                </div>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!formalReservation.buyerType}
          onClick={handleContinue}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Step1BuyerType;
