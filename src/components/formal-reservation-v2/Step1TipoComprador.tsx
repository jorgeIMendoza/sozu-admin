import { useState } from "react";
import { User, Globe, Building2, Users, ArrowRight, Check, Info } from "lucide-react";
import { useFormalReservationStore, type BuyerType, type FormalReservation } from "@/lib/offers/formal-reservation-data";

const BUYER_TYPES: Array<{
  id: BuyerType;
  icon: typeof User;
  title: string;
  description: string;
  requirements: string;
}> = [
  {
    id: "individual_mexican",
    icon: User,
    title: "Persona física — Mexicana",
    description: "Soy ciudadano mexicano comprando a título personal",
    requirements: "Requiere: INE, CURP, RFC, comprobante de domicilio",
  },
  {
    id: "individual_foreign",
    icon: Globe,
    title: "Persona física — Extranjera",
    description: "Soy extranjero residente o no residente en México",
    requirements: "Requiere: Pasaporte, visa FM2/FM3, comprobante",
  },
  {
    id: "legal_entity",
    icon: Building2,
    title: "Persona moral",
    description: "Compra a nombre de una empresa o sociedad",
    requirements: "Requiere: Acta constitutiva, poder, RFC PM, INE rep legal",
  },
  {
    id: "copropiedad",
    icon: Users,
    title: "Copropiedad",
    description: "Compra entre dos personas físicas con porcentajes definidos",
    requirements: "Requiere: Docs de ambos copropietarios (se invita al segundo después)",
  },
];

interface Step1TipoCompradorProps {
  formalReservation: FormalReservation;
  onComplete: () => void;
}

const Step1TipoComprador = ({ formalReservation, onComplete }: Step1TipoCompradorProps) => {
  const setBuyerType = useFormalReservationStore((s) => s.setBuyerType);
  const updateRefactorStatus = useFormalReservationStore((s) => s.updateRefactorStatus);

  const [selected, setSelected] = useState<BuyerType | null>(formalReservation.buyerType ?? null);

  const handleContinue = () => {
    if (!selected) return;
    setBuyerType(formalReservation.id, selected);
    updateRefactorStatus(formalReservation.id, "tipo_seleccionado");
    onComplete();
  };

  const isCopropiedad = selected === "copropiedad";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Paso 1 de 3 · Identificación
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
          ¿Cómo realizarás esta compra?
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Esto define qué constancia fiscal y documentos te pediremos más adelante. Puedes ajustarlo si tu situación cambia.
        </p>
      </div>

      <div className="space-y-3">
        {BUYER_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = selected === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setSelected(type.id)}
              className={`w-full text-left rounded-2xl border-2 p-4 md:p-5 transition-all ${
                isSelected ? "border-primary bg-primary/[0.04]" : "border-border bg-card hover:border-foreground/30"
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
                  <h3 className="font-semibold text-foreground text-base">{type.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{type.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">{type.requirements}</p>
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

      {isCopropiedad && (
        <div className="rounded-xl bg-primary/[0.04] border border-primary/20 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">¿Cómo funciona la copropiedad?</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Vas a completar <strong>tu lado</strong> del proceso: tu CSF, tu pago SPEI y tu firma. Después,
                desde tu expediente, enviarás una <strong>invitación por email</strong> al segundo copropietario
                para que complete su CSF y firma. El acuerdo de copropiedad con porcentajes se firma al cierre.
                Mientras el segundo no complete su lado, el expediente quedará marcado como "pendiente copropietario".
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!selected}
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

export default Step1TipoComprador;
