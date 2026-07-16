import { useState } from "react";
import { Maximize2, ZoomIn, ZoomOut, Building2, MapPin } from "lucide-react";
import { FloorPlanCanvas } from "@/components/admin/PlanosPropertyModal";
import FullscreenModal from "./FullscreenModal";
import SectionCard from "./SectionCard";

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

const MetaCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
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

  const metaCells = [
    { label: "Área total", value: `${unitArea.toLocaleString("es-MX")} m²` },
    { label: "Recámaras", value: String(bedrooms) },
    { label: "Baños", value: String(bathrooms) },
    ...(view ? [{ label: "Vista", value: view }] : []),
  ];

  return (
    <>
      {(imageUrl || planoUbicacionUrl) && (
        <SectionCard
          icon={Building2}
          title="Plano arquitectónico"
          bodyClassName="p-5 md:p-6 grid gap-5 md:grid-cols-[1.7fr_1fr] md:items-start"
        >

            {/* ── IZQUIERDA: imagen del plano ── */}
            <div className="min-w-0">
              {planoUbicacionUrl ? (
                <button
                  type="button"
                  aria-label="Ampliar plano con tu unidad resaltada"
                  onClick={() =>
                    setLightbox({
                      url: planoUbicacionUrl,
                      regiones: hasUbicacionRegiones ? planoUbicacionRegiones : undefined,
                      highlightUnit,
                      fullPropertyNumber,
                    })
                  }
                  className="relative block w-full rounded-md bg-background border border-border overflow-hidden cursor-zoom-in group"
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
                      alt="Plano arquitectónico del nivel"
                      className="block w-full h-auto bg-background"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-card/90 backdrop-blur-md border border-border flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-4 h-4 text-foreground" />
                  </div>
                </button>
              ) : imageUrl ? (
                <button
                  type="button"
                  aria-label="Ver distribución interior ampliada"
                  onClick={() => setLightbox({ url: imageUrl })}
                  className="relative w-full rounded-md bg-background border border-border overflow-hidden cursor-zoom-in group"
                >
                  <div className="aspect-[4/3] md:aspect-[16/10] w-full">
                    <img
                      src={imageUrl}
                      alt="Distribución interior de la unidad"
                      className="w-full h-full object-contain p-3 md:p-6"
                    />
                  </div>
                  <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-card/90 backdrop-blur-md border border-border flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-4 h-4 text-foreground" />
                  </div>
                </button>
              ) : null}
            </div>

            {/* ── DERECHA: detalles ── */}
            <div className="space-y-3">
              {planoUbicacionUrl && (hasUbicacionRegiones ? (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span
                    className="inline-block w-3.5 h-3.5 rounded-sm shrink-0"
                    style={{ background: "rgba(34,197,94,0.32)", border: "1.5px solid rgba(34,197,94,0.95)" }}
                  />
                  Tu unidad de la oferta aparece resaltada en verde sobre el plano.
                </div>
              ) : (
                <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/60" />
                  El resaltado de tu unidad se mostrará cuando el proyecto cargue las regiones del nivel.
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2">
                {metaCells.map((c) => (
                  <MetaCell key={c.label} label={c.label} value={c.value} />
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Las dimensiones son referenciales y pueden variar ±3% en obra. Plano de uso ilustrativo -
                el plano definitivo se entrega con el contrato.
              </p>
            </div>
        </SectionCard>
      )}

      <FullscreenModal
        open={!!lightbox}
        onClose={handleClose}
        label="Plano ampliado"
        topLeft={
          lightbox && !lightboxHasRegiones ? (
            <>
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
            </>
          ) : undefined
        }
      >
        {lightbox && (lightboxHasRegiones ? (
          <div className="w-full max-w-5xl mx-auto [&_canvas]:!w-auto [&_canvas]:max-w-full [&_canvas]:max-h-[85vh] [&_canvas]:mx-auto">
            <FloorPlanCanvas
              imageUrl={lightbox.url}
              regiones={lightbox.regiones!}
              highlightUnit={lightbox.highlightUnit ?? ""}
              fullPropertyNumber={lightbox.fullPropertyNumber}
            />
          </div>
        ) : (
          <img
            src={lightbox.url}
            alt="Plano ampliado"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
          />
        ))}
      </FullscreenModal>
    </>
  );
};

export default OfferFloorPlanLarge;
