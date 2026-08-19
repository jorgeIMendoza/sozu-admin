import { useState } from "react";
import { Maximize2, ZoomIn, ZoomOut, Building2 } from "lucide-react";
import FullscreenModal from "./FullscreenModal";
import SectionCard from "./SectionCard";

/**
 * Distribución interior de la unidad (plano arquitectónico del modelo).
 *
 * La planta del NIVEL con la unidad resaltada vive en `OfferUnitLocation`, la
 * sección que sigue a esta: antes esta card la usaba como imagen principal y la
 * misma planta aparecía dos veces en la oferta.
 */
interface Props {
  imageUrl?: string;
  /**
   * Metraje de la unidad. `use-offer-db` ya lo entrega formateado y CON unidad
   * ('38.60 m²'), así que el tipo admite string: sufijar de nuevo dejaba
   * "38.60 m² m²" en la celda, y un metraje ausente reventaba en toLocaleString.
   */
  unitArea?: number | string;
  bedrooms: number;
  bathrooms: number;
  view?: string;
  floor?: number;
}

type LightboxState = { url: string } | null;

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
}: Props) => {
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 1));
  const handleClose = () => {
    setZoom(1);
    setLightbox(null);
  };

  const areaLabel =
    typeof unitArea === "number"
      ? `${unitArea.toLocaleString("es-MX")} m²`
      : (unitArea ?? "").trim();

  const metaCells = [
    ...(areaLabel ? [{ label: "Área total", value: areaLabel }] : []),
    { label: "Recámaras", value: String(bedrooms) },
    { label: "Baños", value: String(bathrooms) },
    ...(view ? [{ label: "Vista", value: view }] : []),
  ];

  return (
    <>
      {imageUrl && (
        <SectionCard
          icon={Building2}
          title="Plano arquitectónico"
          bodyClassName="p-5 md:p-6 grid gap-5 md:grid-cols-[1.7fr_1fr] md:items-start"
        >

            {/* ── IZQUIERDA: distribución interior ── */}
            <div className="min-w-0">
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
            </div>

            {/* ── DERECHA: detalles ── */}
            <div className="space-y-3">
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
          lightbox ? (
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
        {lightbox && (
          <img
            src={lightbox.url}
            alt="Plano ampliado"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
          />
        )}
      </FullscreenModal>
    </>
  );
};

export default OfferFloorPlanLarge;
