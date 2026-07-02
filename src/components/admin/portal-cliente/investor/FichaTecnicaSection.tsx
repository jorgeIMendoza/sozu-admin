import { useState } from "react";
import { createPortal } from "react-dom";
import { Ruler, Map, Maximize2, X } from "lucide-react";
import type { PropiedadDetalle } from "@/hooks/useClientePropiedadDetalle";
import { FloorPlanCanvas } from "@/components/admin/PlanosPropertyModal";

interface Props {
  propDetalle: PropiedadDetalle;
}

// Zoom del lightbox: imagen simple (arquitectónico) o canvas de nivel con la unidad resaltada
type ZoomState =
  | { kind: "img"; url: string }
  | { kind: "nivel"; url: string; regiones: any[]; highlightUnit: string; fullPropertyNumber: string };

const FichaTecnicaSection = ({ propDetalle }: Props) => {
  const {
    numeroPiso,
    totalPisos,
    planoUbicacionUrl,
    planoUbicacionRegiones,
    planoArquitectonico,
    m2Total,
    modelo,
    numeroDepa,
    unidad,
  } = propDetalle;

  const [zoom, setZoom] = useState<ZoomState | null>(null);

  const hasRegiones = Array.isArray(planoUbicacionRegiones) && planoUbicacionRegiones.length > 0;

  const hasLocation = numeroPiso != null || planoUbicacionUrl != null;
  const hasDistribution = planoArquitectonico != null;

  if (!hasLocation && !hasDistribution) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-7">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Ficha técnica de tu propiedad
          </h2>
        </div>
        <p className="text-[13px] text-foreground/80 leading-relaxed">
          Ubicación, nivel y distribución de tu unidad{modelo ? ` · Modelo ${modelo}` : ""}.
        </p>
      </header>

      {/* ── Location ── */}
      {hasLocation && (
        <div className="space-y-4 pt-1 border-t border-border/60">
          <div className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Map className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                ¿Dónde está tu unidad?
              </h3>
            </div>
          </div>

          <div className={`items-start gap-4 md:gap-6 ${numeroPiso && planoUbicacionUrl ? "grid grid-cols-[auto_1fr]" : "flex"}`}>
            {/* Building diagram */}
            {numeroPiso != null && (
              <div>
                <p className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/80 mb-2">
                  Nivel en el edificio
                </p>
                <div className="rounded-xl border border-border bg-background p-3 flex justify-center">
                  <BuildingDiagram numeroPiso={numeroPiso} totalPisos={totalPisos} />
                </div>
              </div>
            )}

            {/* Floor plan image */}
            {planoUbicacionUrl && (
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/80 mb-2">
                  Ubicación en el nivel
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    aria-label="Ampliar plano de ubicación"
                    className="group relative block w-full rounded-xl overflow-hidden border border-border bg-background cursor-zoom-in"
                    onClick={() =>
                      setZoom(
                        hasRegiones
                          ? {
                              kind: "nivel",
                              url: planoUbicacionUrl,
                              regiones: planoUbicacionRegiones,
                              highlightUnit: numeroDepa,
                              fullPropertyNumber: unidad,
                            }
                          : { kind: "img", url: planoUbicacionUrl },
                      )
                    }
                  >
                    {hasRegiones ? (
                      <FloorPlanCanvas
                        imageUrl={planoUbicacionUrl}
                        regiones={planoUbicacionRegiones}
                        highlightUnit={numeroDepa}
                        fullPropertyNumber={unidad}
                      />
                    ) : (
                      <img
                        src={planoUbicacionUrl}
                        alt="Planta del nivel"
                        className="block w-full h-auto bg-background"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <span className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/45 backdrop-blur text-white flex items-center justify-center opacity-90 group-hover:opacity-100">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </span>
                  </button>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {hasRegiones ? "Planta del nivel · tu unidad resaltada" : "Planta del nivel"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Summary line */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-foreground/85 tabular-nums">
            {numeroDepa && (
              <span className="font-medium">Unidad {numeroDepa}</span>
            )}
            {numeroPiso != null && (
              <span className="flex items-center gap-1.5">
                {numeroDepa && <span className="text-muted-foreground">·</span>}
                <span className="font-medium">
                  Nivel {numeroPiso}{totalPisos ? ` de ${totalPisos}` : ""}
                </span>
              </span>
            )}
            {m2Total > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">·</span>
                <span className="font-medium">{m2Total.toFixed(2)} m²</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Distribution ── */}
      {hasDistribution && (
        <div className="space-y-3 pt-5 border-t border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <Ruler className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Distribución
            </h3>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              aria-label="Ampliar plano arquitectónico"
              className="group relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-border bg-muted cursor-zoom-in"
              onClick={() => setZoom({ kind: "img", url: planoArquitectonico })}
            >
              <img
                src={planoArquitectonico}
                alt="Plano arquitectónico de la unidad"
                className="w-full h-full object-contain bg-background"
                loading="lazy"
                decoding="async"
              />
              <span className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/45 backdrop-blur text-white flex items-center justify-center opacity-90 group-hover:opacity-100">
                <Maximize2 className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
          {m2Total > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11.5px] font-medium text-foreground tabular-nums">
                {m2Total.toFixed(2)} m²
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Las dimensiones son referenciales y pueden variar ±3% en obra.
          </p>
        </div>
      )}

      <p className="text-[11px] italic text-muted-foreground leading-relaxed">
        Las descripciones son ilustrativas, pueden variar en marca por cuestión de disponibilidad
        en modelos e inventarios; siempre y cuando sean de calidad equivalente.
      </p>

      {/* Lightbox */}
      {zoom &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setZoom(null)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setZoom(null); }}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            {zoom.kind === "nivel" ? (
              <div
                className="w-full max-w-[min(1100px,92vw)] max-h-[90vh] overflow-auto rounded-xl bg-background p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <FloorPlanCanvas
                  imageUrl={zoom.url}
                  regiones={zoom.regiones}
                  highlightUnit={zoom.highlightUnit}
                  fullPropertyNumber={zoom.fullPropertyNumber}
                />
              </div>
            ) : (
              <img
                src={zoom.url}
                alt="Plano ampliado"
                className="max-w-full max-h-[90vh] object-contain rounded-xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>,
          document.body,
        )}
    </section>
  );
};

// ── Building diagram SVG ──

const BuildingDiagram = ({
  numeroPiso,
  totalPisos,
}: {
  numeroPiso: number;
  totalPisos: number | null;
}) => {
  const T = totalPisos ?? numeroPiso;
  // floors rendered top→bottom: NIVEL T, NIVEL T-1, …, NIVEL 1
  const floors = Array.from({ length: T }, (_, i) => T - i);

  const rowH = 22;
  const pitch = 24; // row height + gap
  const roofTopY = 9;
  const groundY = roofTopY + T * pitch;
  const baseY = groundY + rowH + 2;
  const svgH = baseY + 3.5;

  return (
    <svg
      viewBox={`0 0 144 ${svgH}`}
      className="w-full max-w-[190px]"
      role="img"
      aria-label={`Tu unidad está en el nivel ${numeroPiso}${T > numeroPiso ? ` de ${T}` : ""}`}
    >
      {/* Roof */}
      <path d="M 18.56 9 L 58 1 L 97.44 9 Z" className="fill-foreground/80" />

      {/* Floors */}
      {floors.map((floorNum, idx) => {
        const y = roofTopY + idx * pitch;
        const yCenter = y + rowH / 2;
        const isCurrent = floorNum === numeroPiso;
        return (
          <g key={floorNum}>
            <rect
              x="1" y={y} width="114" height={rowH} rx="2.5"
              strokeWidth="1"
              className={isCurrent ? "stroke-primary fill-primary" : "stroke-border fill-muted"}
            />
            <text
              x="58" y={yCenter + 3.5}
              textAnchor="middle"
              style={{ fontSize: "9.5px", fontWeight: 600 }}
              className={isCurrent ? "fill-primary-foreground" : "fill-foreground/65"}
            >
              NIVEL {floorNum}
            </text>
            {isCurrent && (
              <g>
                <path d={`M 117 ${yCenter} l 6 -5 l 0 10 Z`} className="fill-primary" />
                <text
                  x="125" y={yCenter + 3.5}
                  className="fill-primary"
                  style={{ fontSize: "8.5px", fontWeight: 700 }}
                >
                  Tú
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Ground floor */}
      <g>
        <rect
          x="1" y={groundY} width="114" height={rowH} rx="2.5"
          strokeWidth="1"
          className="stroke-border fill-foreground/85"
        />
        <text
          x="58" y={groundY + rowH / 2 + 3.5}
          textAnchor="middle"
          style={{ fontSize: "9.5px", fontWeight: 600 }}
          className="fill-background"
        >
          PLANTA BAJA
        </text>
      </g>

      {/* Base */}
      <rect x="0" y={baseY} width="116" height="3.5" className="fill-foreground" />
    </svg>
  );
};

export default FichaTecnicaSection;
