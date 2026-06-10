import { CalendarClock, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
import type { Installment } from "@/lib/offers/payment-data";
import { getInstallmentBadge } from "@/lib/offers/payment-data";
import { fmtMXN as fmt } from "@/lib/utils";

interface NextInstallmentCardProps {
  installment: Installment;
  installmentLabel: string;
  onViewInstructions: () => void;
}

const NextInstallmentCard = ({ installment, installmentLabel, onViewInstructions }: NextInstallmentCardProps) => {
  const badge = getInstallmentBadge(installment.status);
  const isUrgent = installment.status === "vencido" || installment.status === "cercano";
  const isPaid = installment.status === "pagado";

  const borderColor = isPaid
    ? "border-primary/20"
    : isUrgent
    ? "border-warning/30"
    : "border-border";

  const daysText =
    installment.daysUntilDue === 0
      ? "Hoy"
      : installment.daysUntilDue < 0
      ? `Hace ${Math.abs(installment.daysUntilDue)} días`
      : `En ${installment.daysUntilDue} días`;

  return (
    <section className="px-5 pt-2 pb-1">
      <div className={`bg-card rounded-2xl border ${borderColor} p-5 shadow-sm`}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              Próxima parcialidad
            </h3>
          </div>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        {/* Amount */}
        <p className="font-display font-bold text-3xl text-foreground tabular-nums tracking-tight mb-1">
          {fmt(installment.amount)}
        </p>

        {/* Subtitle */}
        <p className="text-xs text-muted-foreground mb-4">
          {installmentLabel}
        </p>

        {/* Due date + countdown */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground font-medium">
              Vence {installment.dueDateDisplay}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={`text-xs font-semibold tabular-nums ${
              isUrgent ? "text-warning" : "text-muted-foreground"
            }`}>
              {daysText}
            </span>
          </div>
        </div>

        {/* CTA */}
        {!isPaid ? (
          <button
            onClick={onViewInstructions}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3.5 rounded-xl hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            Ver instrucciones de pago
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3 bg-primary/5 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Pago confirmado</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default NextInstallmentCard;
