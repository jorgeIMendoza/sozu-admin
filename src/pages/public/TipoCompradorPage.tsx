import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import OfertaFlowShell from "@/components/offer/OfertaFlowShell";
import { useOfertaFlowStore, type BuyerType } from "@/lib/oferta-flow-store";

const BUYER_TYPES: { id: BuyerType; flag: string; title: string; description: string }[] = [
  {
    id: "individual_mexican",
    flag: "🇲🇽",
    title: "Persona física mexicana",
    description: "Ciudadano mexicano comprando a título personal con CURP y RFC activo.",
  },
  {
    id: "individual_foreign",
    flag: "🌎",
    title: "Persona física extranjera",
    description: "Comprador extranjero. Requiere pasaporte vigente y constitución de fideicomiso si aplica.",
  },
  {
    id: "legal_entity",
    flag: "🏢",
    title: "Persona moral",
    description: "Empresa o sociedad. Requiere acta constitutiva y poderes notariales del representante.",
  },
  {
    id: "copropiedad",
    flag: "👥",
    title: "Copropiedad",
    description: "Compra entre dos o más personas. Cada copropietario completa su expediente por separado.",
  },
];

export default function TipoCompradorPage() {
  const { ofertaId } = useParams<{ ofertaId: string }>();
  const navigate = useNavigate();
  const { setBuyerType, buyerType: savedType } = useOfertaFlowStore();

  const [selected, setSelected] = useState<BuyerType | null>(savedType);

  const handleContinue = () => {
    if (!selected) return;
    setBuyerType(selected);
    navigate(`/oferta/${ofertaId}/hold`);
  };

  return (
    <OfertaFlowShell
      currentStep={1}
      title="¿Cómo vas a comprar?"
      onBack={() => navigate(`/oferta/${ofertaId}/datos`)}
    >
      <div className="space-y-3 flex-1">
        {BUYER_TYPES.map((bt) => {
          const isActive = selected === bt.id;
          return (
            <button
              key={bt.id}
              onClick={() => setSelected(bt.id)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{bt.flag}</span>
                <div className="min-w-0">
                  <p className={`text-[14px] font-semibold leading-tight ${isActive ? "text-primary" : "text-foreground"}`}>
                    {bt.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-1">
                    {bt.description}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    isActive ? "border-primary" : "border-border"
                  }`}
                >
                  {isActive && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              </div>
            </button>
          );
        })}

        {/* Copropiedad info */}
        {selected === "copropiedad" && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[12px] font-semibold text-foreground">Cómo funciona la copropiedad</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Completa tu expediente primero. Al terminar, recibirás un enlace para invitar a tu copropietario.
                La unidad queda apartada durante todo el proceso.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 mt-auto">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold inline-flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </OfertaFlowShell>
  );
}
