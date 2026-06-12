import { CheckCircle2 } from "lucide-react";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import type { ResaleScenario } from "@/lib/offers/resale-data";
import { fmtMXN } from "@/lib/utils";

interface ResaleStepSuccessProps {
  property: InvestmentProperty;
  scenario: ResaleScenario;
  onClose: () => void;
}

const NEXT_STEPS = [
  "Publicaremos tu unidad en nuestros canales y red de brokers (24-48 hrs).",
  "Te enviaremos cada prospecto calificado por correo.",
  "Coordinaremos visitas con tu autorización.",
  "Al cerrar venta, el notario calcula ISR y firmas la escritura final.",
];

const ResaleStepSuccess = ({ property, scenario, onClose }: ResaleStepSuccessProps) => {
  const summary: { label: string; value: string; tabular?: boolean }[] = [
    { label: "Propiedad", value: `${property.property.projectName} ${property.property.unitNumber}` },
    { label: "Precio de salida", value: fmtMXN(scenario.totalPrice), tabular: true },
    { label: "Comisión", value: "5% + IVA" },
    { label: "Exclusividad", value: "6 meses" },
  ];

  return (
    <div className="px-5 pt-12 pb-8 flex flex-col items-center text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-success" />
      </div>

      <h2 className="font-display font-bold text-2xl text-foreground mb-2">
        ¡Tu reventa está activa!
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-8">
        Empezamos a buscar comprador para tu departamento esta semana. Te avisaremos por correo y notificación cuando haya prospectos calificados.
      </p>

      {/* Resumen */}
      <div className="w-full rounded-xl border border-border bg-card p-4 mb-6">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 text-left">
          Resumen
        </p>
        {summary.map((row) => (
          <div
            key={row.label}
            className="flex justify-between text-sm py-1.5 border-b border-border/40 last:border-0"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className={`text-foreground font-medium ${row.tabular ? "tabular-nums" : ""}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Siguientes pasos */}
      <div className="w-full rounded-xl border border-primary/20 bg-primary/[0.03] p-4 mb-8 text-left">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-primary mb-3">
          Siguientes pasos
        </p>
        <ul className="space-y-2.5">
          {NEXT_STEPS.map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                {i + 1}
              </span>
              <p className="text-sm text-foreground leading-relaxed">{text}</p>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onClose}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors active:scale-[0.98]"
      >
        Volver a mi propiedad
      </button>
      <p className="text-[11px] text-muted-foreground mt-3">
        El contrato firmado quedó guardado en tu expediente.
      </p>
    </div>
  );
};

export default ResaleStepSuccess;
