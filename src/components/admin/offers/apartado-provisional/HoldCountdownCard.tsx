import { useEffect, useState, Fragment } from "react";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";
import { calculateCountdown, type CountdownUrgency } from "@/lib/offers/hold-countdown";
import type { HoldData } from "@/lib/offers/formal-reservation-data";

interface UrgencyStyle {
  border: string;
  bg: string;
  header: string;
  text: string;
  numbers: string;
  msg: string;
}

const URGENCY_STYLES: Record<CountdownUrgency, UrgencyStyle> = {
  calm: {
    border: "border-primary/20",
    bg: "bg-primary/[0.02]",
    header: "bg-primary/[0.06]",
    text: "text-primary",
    numbers: "text-foreground",
    msg: "Tienes tiempo para revisar el contrato con calma.",
  },
  warning: {
    border: "border-warning/40",
    bg: "bg-warning/[0.04]",
    header: "bg-warning/[0.08]",
    text: "text-warning",
    numbers: "text-warning",
    msg: "Quedan menos de 48 horas. Conviene tomar tu decisión.",
  },
  critical: {
    border: "border-destructive/40",
    bg: "bg-destructive/[0.04]",
    header: "bg-destructive/[0.08]",
    text: "text-destructive",
    numbers: "text-destructive",
    msg: "Tu apartado vence muy pronto. Completa tu pago ahora.",
  },
  expired: {
    border: "border-muted",
    bg: "bg-muted/30",
    header: "bg-muted/40",
    text: "text-muted-foreground",
    numbers: "text-muted-foreground",
    msg: "Tu apartado expiró.",
  },
};

const HoldCountdownCard = ({ hold }: { hold: HoldData }) => {
  // Re-render cada minuto para mantener el contador actualizado
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const countdown = calculateCountdown(hold.expiresAt);
  const s = URGENCY_STYLES[countdown.urgency];
  const Icon =
    countdown.urgency === "critical"
      ? AlertCircle
      : countdown.urgency === "warning"
        ? AlertTriangle
        : Clock;

  const items = [
    { value: countdown.days, label: countdown.days === 1 ? "día" : "días" },
    { value: countdown.hours, label: countdown.hours === 1 ? "hora" : "horas" },
    { value: countdown.minutes, label: "min" },
  ];

  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} overflow-hidden`}>
      <div className={`${s.header} px-4 py-2.5 border-b ${s.border}`}>
        <div className={`flex items-center gap-2 ${s.text}`}>
          <Icon className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            Tiempo restante de tu apartado
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-center gap-2 mb-3">
          {items.map((item, i) => (
            <Fragment key={item.label}>
              <div className="flex flex-col items-center">
                <span className={`text-3xl font-bold tabular-nums ${s.numbers}`}>
                  {item.value}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  {item.label}
                </span>
              </div>
              {i < items.length - 1 && (
                <span className="text-2xl text-muted-foreground/40 font-light">·</span>
              )}
            </Fragment>
          ))}
        </div>
        <p className={`text-xs text-center ${s.text} leading-relaxed`}>{s.msg}</p>
      </div>
    </div>
  );
};

export default HoldCountdownCard;
