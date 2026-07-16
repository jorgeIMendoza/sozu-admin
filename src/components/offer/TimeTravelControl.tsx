import { FastForward, RotateCcw } from "lucide-react";
import { useTimeTravelStore } from "@/lib/offers/time-travel";

const PRESETS = [
  { label: "Tiempo real", minutes: 0 },
  { label: "+1 día", minutes: 1 * 24 * 60 },
  { label: "+5 días", minutes: 5 * 24 * 60 + 5 },
  { label: "+10 días", minutes: 10 * 24 * 60 + 5 },
  { label: "+14 días", minutes: 14 * 24 * 60 + 5 },
  { label: "+16 días", minutes: 16 * 24 * 60 },
];

const TimeTravelControl = () => {
  const offsetMinutes = useTimeTravelStore((s) => s.offsetMinutes);
  const setOffset = useTimeTravelStore((s) => s.setOffset);
  const reset = useTimeTravelStore((s) => s.reset);

  const currentLabel =
    PRESETS.find((p) => p.minutes === offsetMinutes)?.label ?? "Personalizado";

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center flex-shrink-0">
          <FastForward className="w-4 h-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-warning">
            Modo demo · Time-travel
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            Simula el avance de días para ver las notificaciones de cada momento. Solo visible
            en desarrollo - no aparece en producción.
          </p>
          <p className="text-[11px] text-foreground mt-2">
            Estado actual: <span className="font-semibold">{currentLabel}</span>
            {offsetMinutes > 0 && (
              <span className="text-muted-foreground">
                {" "}
                ({Math.floor(offsetMinutes / (24 * 60))} días adelantado)
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setOffset(preset.minutes)}
            className={`px-3 h-8 rounded-lg text-[11px] font-semibold transition-colors ${
              offsetMinutes === preset.minutes
                ? "bg-warning text-warning-foreground"
                : "bg-card border border-border text-foreground hover:border-warning/40"
            }`}
          >
            {preset.label}
          </button>
        ))}
        {offsetMinutes !== 0 && (
          <button
            onClick={reset}
            className="px-3 h-8 rounded-lg text-[11px] font-semibold bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 inline-flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
};

export default TimeTravelControl;
