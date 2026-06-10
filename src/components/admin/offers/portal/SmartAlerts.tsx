import { ChevronRight } from "lucide-react";
import type { SmartAlert } from "@/lib/offers/mock-data";

interface SmartAlertsProps {
  alerts: SmartAlert[];
  onAlertTap: (propertyId: string) => void;
}

const accentColor: Record<string, string> = {
  warning: "bg-warning",
  info: "bg-primary",
  success: "bg-success",
};

const SmartAlerts = ({ alerts, onAlertTap }: SmartAlertsProps) => {
  if (alerts.length === 0) return null;

  return (
    <section className="px-5 pt-5 space-y-1.5 animate-slide-up">
      <h2 className="font-display font-semibold text-foreground text-sm mb-2">
        Pendientes
      </h2>
      {alerts.map((alert) => (
        <button
          key={alert.id}
          onClick={() => onAlertTap(alert.propertyId)}
          className="w-full text-left flex items-center gap-3 py-3 transition-all active:opacity-70 group"
        >
          <div className={`w-0.5 h-8 rounded-full flex-shrink-0 ${accentColor[alert.type] || accentColor.info}`} />
          <span className="text-base flex-shrink-0">{alert.icon}</span>
          <p className="text-sm text-foreground/80 leading-snug flex-1">{alert.message}</p>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors flex-shrink-0" />
        </button>
      ))}
    </section>
  );
};

export default SmartAlerts;
