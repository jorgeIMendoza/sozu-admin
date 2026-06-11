/** @deprecated 18.11.E — Eliminado del JSX de OfferLandingPage por retro comercial. Conservado por reversibilidad. */
import { Car, Footprints, Ruler, MapPin, Zap, AlertCircle, Maximize2 } from "lucide-react";
import type { ParkingSlot, ParkingLevelLayout } from "@/lib/offers/offer-data";

interface ParkingSectionProps {
  slots: ParkingSlot[];
  levelLayouts?: ParkingLevelLayout[];
}

const FORMAT_LABELS: Record<ParkingSlot["format"], { label: string; color: string }> = {
  bateria: {
    label: "BATERÍA",
    color: "bg-primary/10 text-primary border border-primary/30",
  },
  tandem: {
    label: "TANDEM",
    color: "bg-warning/10 text-warning border border-warning/30",
  },
};

const ParkingSection = ({ slots, levelLayouts }: ParkingSectionProps) => {
  if (!slots || slots.length === 0) return null;

  const slotsByLevel = slots.reduce<Record<string, ParkingSlot[]>>((acc, slot) => {
    if (!acc[slot.level]) acc[slot.level] = [];
    acc[slot.level].push(slot);
    return acc;
  }, {});

  const slotCountLabel =
    slots.length === 1 ? "Tu lugar de estacionamiento" : `Tus ${slots.length} lugares de estacionamiento`;

  return (
    <section className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle bg-muted/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Car className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">{slotCountLabel}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed pl-9">
          Ubicación exacta, formato y dimensiones de cada cajón asignado a tu unidad.
        </p>
      </div>

      <div className="p-5 space-y-5">
        <div className={`grid gap-3 ${slots.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
          {slots.map((slot) => {
            const formatStyle = FORMAT_LABELS[slot.format];
            return (
              <div key={slot.id} className="rounded-xl bg-muted/20 border border-border-subtle p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Cajón</p>
                    <p className="text-lg font-bold text-foreground tabular-nums">{slot.id}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${formatStyle.color}`}>
                    {formatStyle.label}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-foreground/85">{slot.level}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Ruler className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-foreground/85 tabular-nums">
                      {slot.dimensionsM.width.toFixed(2)} × {slot.dimensionsM.length.toFixed(2)} m
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Footprints className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-foreground/85 tabular-nums">{slot.stepsToElevator} pasos al elevador</p>
                  </div>
                  {slot.hasEVCharger && (
                    <div className="flex items-center gap-2.5">
                      <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <p className="text-xs text-primary font-semibold">Toma para auto eléctrico</p>
                    </div>
                  )}
                </div>

                {slot.format === "tandem" && slot.tandemWith?.ownership === "neighbor" && (
                  <div className="mt-3 pt-3 border-t border-border-subtle">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-foreground/80 leading-relaxed">
                        Alineado en tándem con el cajón <strong className="font-mono">{slot.tandemWith.slotId}</strong> de un vecino. Coordinen entrada y salida.
                      </p>
                    </div>
                  </div>
                )}
                {slot.format === "tandem" && slot.tandemWith?.ownership === "client" && (
                  <div className="mt-3 pt-3 border-t border-border-subtle">
                    <div className="flex items-start gap-2">
                      <Maximize2 className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-foreground/80 leading-relaxed">
                        Alineado en tándem con tu otro cajón <strong className="font-mono">{slot.tandemWith.slotId}</strong>. Ambos cajones son tuyos.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {Object.entries(slotsByLevel).map(([level, slotsInLevel]) => {
          const layout = levelLayouts?.find((l) => l.level === level);
          if (!layout) return null;
          return (
            <ParkingLevelMap
              key={level}
              level={level}
              layout={layout}
              clientSlots={slotsInLevel}
            />
          );
        })}
      </div>
    </section>
  );
};

interface ParkingLevelMapProps {
  level: string;
  layout: ParkingLevelLayout;
  clientSlots: ParkingSlot[];
}

const ParkingLevelMap = ({ level, layout, clientSlots }: ParkingLevelMapProps) => {
  const cellSize = 24;
  const padding = 16;
  const svgWidth = layout.gridCols * cellSize + padding * 2;
  const svgHeight = layout.gridRows * cellSize + padding * 2 + 40;

  const clientPositions = new Set(
    clientSlots.map((s) => `${s.gridPosition.col}-${s.gridPosition.row}`)
  );

  return (
    <div className="rounded-xl bg-muted/10 border border-border-subtle p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Plano del {level}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary" />
            <p className="text-[10px] text-muted-foreground">Tus cajones</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted-foreground/20" />
            <p className="text-[10px] text-muted-foreground">Otros</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform={`translate(${padding}, ${padding - 8})`}>
            <rect x="-4" y="-4" width="36" height="20" rx="3" fill="hsl(var(--primary))" opacity="0.15" />
            <text x="14" y="8" fontSize="9" fill="hsl(var(--primary))" fontWeight="700" textAnchor="middle">
              ELEV
            </text>
          </g>

          {Array.from({ length: layout.gridRows }).map((_, row) =>
            Array.from({ length: layout.gridCols }).map((_, col) => {
              const isClient = clientPositions.has(`${col}-${row}`);
              const x = padding + col * cellSize;
              const y = padding + 24 + row * cellSize;
              const slot = isClient
                ? clientSlots.find((s) => s.gridPosition.col === col && s.gridPosition.row === row)
                : undefined;

              return (
                <g key={`${col}-${row}`}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={cellSize - 4}
                    height={cellSize - 4}
                    rx="2"
                    fill={isClient ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.15)"}
                    stroke={isClient ? "hsl(var(--primary))" : "hsl(var(--border))"}
                    strokeWidth={isClient ? 1.5 : 0.5}
                  />
                  {isClient && slot && (
                    <text
                      x={x + cellSize / 2}
                      y={y + cellSize / 2 + 3}
                      fontSize="8"
                      fontWeight="700"
                      fill="hsl(var(--primary-foreground))"
                      textAnchor="middle"
                    >
                      {slot.id.split("-")[1] ?? ""}
                    </text>
                  )}
                </g>
              );
            })
          )}

          <text
            x={svgWidth / 2}
            y={svgHeight - 8}
            fontSize="9"
            fill="hsl(var(--muted-foreground))"
            textAnchor="middle"
            fontWeight="500"
          >
            {level} · {layout.totalSlots} cajones en total
          </text>
        </svg>
      </div>

      <p className="text-[10px] text-muted-foreground/80 mt-2 leading-relaxed">
        Plano referencial. La ubicación exacta puede variar ±1 cajón conforme a la entrega final.
      </p>
    </div>
  );
};

export default ParkingSection;
