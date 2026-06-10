import { Check, Lock, Unlock } from "lucide-react";

type StateId = "pending" | "held" | "released";

interface Props {
  activeState: StateId;
  releasedReason?: "applied" | "cancelled" | "expired";
}

const RetentionStateStepper = ({ activeState, releasedReason }: Props) => {
  const states: { id: StateId; label: string; sublabel: string; icon: typeof Check }[] = [
    { id: "pending", label: "Pendiente", sublabel: "Autorización iniciada", icon: Check },
    {
      id: "held",
      label: "Retenido",
      sublabel: activeState === "held" ? "Estado actual" : "Reservado para ti",
      icon: Lock,
    },
    {
      id: "released",
      label: "Liberado",
      sublabel:
        releasedReason === "applied"
          ? "Aplicado al enganche"
          : releasedReason === "cancelled"
          ? "Reembolsado"
          : releasedReason === "expired"
          ? "Reembolsado por vencimiento"
          : "Al apartar o cancelar",
      icon: Unlock,
    },
  ];

  const activeIdx = states.findIndex((s) => s.id === activeState);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-4 text-center">
        Estado de la retención
      </p>
      <div className="flex items-start">
        {states.map((state, idx) => {
          const isPast = idx < activeIdx;
          const isActive = idx === activeIdx;
          const Icon = state.icon;

          const circleClass = isActive
            ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
            : isPast
            ? "bg-success/15 text-success"
            : "bg-muted text-muted-foreground";

          const labelClass = isActive
            ? "text-primary font-semibold"
            : isPast
            ? "text-foreground font-medium"
            : "text-muted-foreground";

          return (
            <div key={state.id} className="flex-1 flex items-start min-w-0">
              <div className="flex flex-col items-center text-center flex-1 min-w-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${circleClass}`}
                >
                  {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </div>
                <p className={`mt-2 text-xs ${labelClass}`}>{state.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 px-1">
                  {state.sublabel}
                </p>
              </div>
              {idx < states.length - 1 && (
                <div
                  className={`flex-shrink-0 h-px w-6 md:w-10 mt-5 ${
                    isPast || isActive ? "bg-success/40" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RetentionStateStepper;
