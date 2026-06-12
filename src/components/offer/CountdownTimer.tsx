import { useEffect, useState } from "react";
import { Calendar, Clock } from "lucide-react";

interface Props {
  endDate: string;
  compact?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calculateTimeLeft(endDate: string): TimeLeft {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

const CountdownTimer = ({ endDate, compact = false }: Props) => {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(endDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft(endDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  const isUrgent = timeLeft.days <= 2 && !timeLeft.expired;
  const isWarning = timeLeft.days >= 3 && timeLeft.days <= 5 && !timeLeft.expired;

  const colorClass = timeLeft.expired
    ? "text-muted-foreground"
    : isUrgent
    ? "text-destructive"
    : isWarning
    ? "text-warning"
    : "text-primary";

  const ringClass = timeLeft.expired
    ? "ring-muted/20"
    : isUrgent
    ? "ring-destructive/15"
    : isWarning
    ? "ring-warning/15"
    : "ring-primary/15";

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border ring-1 ${ringClass} ${colorClass}`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold tabular-nums">
          {timeLeft.expired
            ? "Vencido"
            : timeLeft.days > 0
            ? `${timeLeft.days}d ${timeLeft.hours}h`
            : `${timeLeft.hours}h ${timeLeft.minutes}m`}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            timeLeft.expired
              ? "bg-muted"
              : isUrgent
              ? "bg-destructive/10"
              : isWarning
              ? "bg-warning/10"
              : "bg-primary/10"
          }`}
        >
          {timeLeft.expired ? (
            <Calendar className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Clock className={`w-5 h-5 ${colorClass}`} />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {timeLeft.expired ? "Tu pre-apartado venció" : "Tiempo restante de tu pre-apartado"}
          </h3>
        </div>
      </div>

      {timeLeft.expired ? (
        <div className="text-center py-4">
          <span className="text-2xl font-bold text-muted-foreground">Vencido</span>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <TimeBlock value={timeLeft.days} label="días" colorClass={colorClass} highlight={isUrgent} />
          <TimeBlock value={timeLeft.hours} label="hrs" colorClass={colorClass} />
          <TimeBlock value={timeLeft.minutes} label="min" colorClass={colorClass} />
          <TimeBlock value={timeLeft.seconds} label="seg" colorClass={colorClass} dim />
        </div>
      )}

      {!timeLeft.expired && (
        <p className="text-[11px] text-center text-muted-foreground">
          Hasta{" "}
          {new Date(endDate).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
};

const TimeBlock = ({
  value,
  label,
  highlight,
  dim,
  colorClass,
}: {
  value: number;
  label: string;
  highlight?: boolean;
  dim?: boolean;
  colorClass: string;
}) => (
  <div
    className={`text-center rounded-xl p-2.5 ${
      highlight
        ? "bg-destructive/5 ring-1 ring-destructive/20"
        : "bg-muted/50"
    }`}
  >
    <div
      className={`text-xl font-bold tabular-nums leading-none ${
        dim ? "text-muted-foreground" : colorClass
      }`}
    >
      {String(value).padStart(2, "0")}
    </div>
    <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
      {label}
    </div>
  </div>
);

export default CountdownTimer;
