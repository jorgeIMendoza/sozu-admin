import { useState, useEffect } from "react";
import { Maximize2, X, ZoomIn, ZoomOut, Square, Bed, Bath, Building2, MapPin } from "lucide-react";
import { FloorPlanCanvas } from "@/components/admin/PlanosPropertyModal";

interface Props {
  imageUrl?: string;
  unitArea: number;
  bedrooms: number;
  bathrooms: number;
  view?: string;
  floor?: number;
  // Plano del nivel con la ubicación de la unidad resaltada (edificios_niveles_planos)
  planoUbicacionUrl?: string;
  planoUbicacionRegiones?: any[];
  /** Depto derivado (para el match del resaltado) y número completo de propiedad. */
  highlightUnit?: string;
  fullPropertyNumber?: string;
}

type LightboxState =
  | { url: string; regiones?: any[]; highlightUnit?: string; fullPropertyNumber?: string }
  | null;

const InfoChip = ({ icon: Icon, label }: { icon: typeof Square; label: string }) => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card/85 backdrop-blur-md border border-border/60 text-xs font-medium text-foreground tabular-nums">
    <Icon className="w-3.5 h-3.5 text-primary" />
    {label}
  </div>
);

const MetaCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-0.5">
      {label}
    </p>
    <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
  </div>
);

const OfferFloorPlanLarge = ({
  imageUrl,
  unitArea,
  bedrooms,
  bathrooms,
  view,
  floor,
  planoUbicacionUrl,
  planoUbicacionRegiones,
  highlightUnit,
  fullPropertyNumber,
}: Props) => {
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [zoom, setZoom] = useState(1);

  const hasUbicacionRegiones =
    Array.isArray(planoUbicacionRegiones) && planoUbicacionRegiones.length > 0;
  const lightboxHasRegiones =
    Array.isArray(lightbox?.regiones) && (lightbox?.regiones?.length ?? 0) > 0;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 1));
  const handleClose = () => {
    setZoom(1);
    setLightbox(null);
  };

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightbox]);

  const metaCells = [
    { label: "Área total", value: `${unitArea.toLocaleString("es-MX")} m²` },
    { label: "Recámaras", value: String(bedrooms) },
    { label: "Baños", value: String(bathrooms) },
    ...(view ? [{ label: "Vista", value: view }] : []),
  ];

  return (
    <>
      <div className="space-y-4">
        {/* ── Plano arquitectónico (distribución interior de la unidad) ── */}
        {imageUrl && (
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Plano arquitectónico</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">Toca el plano para ampliar</p>
            </div>

            <button
              type="button"
              aria-label="Ver plano arquitectónico ampliado"
              onClick={() => setLightbox({ url: imageUrl })}
              className="relative w-full rounded-2xl bg-background border border-border overflow-hidden cursor-zoom-in group"
            >
              <div className="aspect-[4/3] md:aspect-[16/10] w-full">
                <img
                  src={imageUrl}
                  alt="Plano arquitectónico"
                  className="w-full h-full object-contain p-3 md:p-6 transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>

              <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-card/90 backdrop-blur-md border border-border flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-4 h-4 text-foreground" />
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
                <InfoChip icon={Square} label={`${unitArea.toLocaleString("es-MX")} m²`} />
                <InfoChip icon={Bed} label={`${bedrooms} rec`} />
                <InfoChip icon={Bath} label={`${bathrooms} baños`} />
                {floor && <InfoChip icon={Building2} label={`Nivel ${floor}`} />}
              </div>
            </button>

            <div className={`grid gap-2 ${metaCells.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"}`}>
              {metaCells.map((c) => (
                <MetaCell key={c.label} label={c.label} value={c.value} />
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Las dimensiones son referenciales y pueden variar ±3% en obra. Plano de uso ilustrativo —
              el plano definitivo se entrega con el contrato.
            </p>
          </div>
        )}

        {/* ── Ubicación de la unidad en el nivel (plano de nivel con resaltado) ── */}
        {planoUbicacionUrl && (
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Ubicación de tu unidad</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">Toca para ampliar</p>
            </div>

            <button
              type="button"
              aria-label="Ampliar plano de ubicación de la unidad"
              onClick={() =>
                setLightbox({
                  url: planoUbicacionUrl,
                  regiones: hasUbicacionRegiones ? planoUbicacionRegiones : undefined,
                  highlightUnit,
                  fullPropertyNumber,
                })
              }
              className="relative block w-full rounded-2xl bg-background border border-border overflow-hidden cursor-zoom-in group"
            >
              {hasUbicacionRegiones ? (
                <FloorPlanCanvas
                  imageUrl={planoUbicacionUrl}
                  regiones={planoUbicacionRegiones!}
                  highlightUnit={highlightUnit ?? ""}
                  fullPropertyNumber={fullPropertyNumber}
                />
              ) : (
                <img
                  src={planoUbicacionUrl}
                  alt="Plano de ubicación de la unidad"
                  className="block w-full h-auto bg-background"
                  loading="lazy"
                  decoding="async"
                />
              )}

              <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-card/90 backdrop-blur-md border border-border flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-4 h-4 text-foreground" />
              </div>
            </button>

            {hasUbicacionRegiones && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span
                  className="inline-block w-3.5 h-3.5 rounded-sm shrink-0"
                  style={{ background: "rgba(34,197,94,0.32)", border: "1.5px solid rgba(34,197,94,0.95)" }}
                />
                Tu unidad aparece resaltada en verde sobre el plano del nivel.
              </div>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Plano ampliado"
          onClick={handleClose}
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
        >
          <button
            onClick={handleClose}
            aria-label="Cerrar"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {!lightboxHasRegiones && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-4 left-4 flex items-center gap-2 z-10"
            >
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                aria-label="Reducir zoom"
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-semibold tabular-nums min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 4}
                aria-label="Aumentar zoom"
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full h-full max-w-6xl max-h-[85vh] overflow-auto flex items-center justify-center"
          >
            {lightboxHasRegiones ? (
              <div className="w-full max-w-4xl">
                <FloorPlanCanvas
                  imageUrl={lightbox!.url}
                  regiones={lightbox!.regiones!}
                  highlightUnit={lightbox!.highlightUnit ?? ""}
                  fullPropertyNumber={lightbox!.fullPropertyNumber}
                />
              </div>
            ) : (
              <img
                src={lightbox!.url}
                alt="Plano ampliado"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
              />
            )}
          </div>

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/70">
            {!lightboxHasRegiones && zoom > 1 ? "Arrastra para mover · " : ""}Tap fuera para cerrar
          </p>
        </div>
      )}
    </>
  );
};

export default OfferFloorPlanLarge;
