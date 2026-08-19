import { useState } from "react";
import { Eye, Maximize2 } from "lucide-react";
import FullscreenModal from "./FullscreenModal";
import SectionCard from "./SectionCard";

/**
 * "Vista tentativa del departamento" — sección de la oferta digital.
 *
 * `Datos de la propiedad` ya nombra la orientación ("Vista: Oriente") pero el
 * nombre no dice nada al comprador que no conoce el terreno; el render sí. La
 * imagen viene de `vistas.url` (catálogo por proyecto + orientación al que apunta
 * `propiedades.id_vista`), así que es la misma para todas las unidades que miran
 * hacia el mismo lado y NO depende del nivel: de ahí el "tentativa" del título y
 * el disclaimer, que es lo que evita venderla como la vista exacta de la unidad.
 *
 * Solo 19 de las 28 vistas del catálogo tienen archivo cargado (Mutuo Vive tiene
 * sus 8 orientaciones sin imagen), por eso sin `imageUrl` la sección no se monta:
 * un placeholder aquí no aportaría nada que la orientación ya no diga.
 */

interface Props {
  /** `vistas.url` ya optimizada. Sin ella la sección no se monta. */
  imageUrl?: string;
  /**
   * Nombre de la vista (`vistas.nombre`). El catálogo mezcla orientaciones
   * ('Oriente', 'Sur') con lugares ('Country', 'Interior', 'Ávila Camacho'), así
   * que el copy dice "la vista X" y nunca "la orientación X".
   */
  view?: string;
  /** Nivel de la unidad, para explicar que la vista cambia con la altura. */
  level?: number | string;
}

const OfferUnitView = ({ imageUrl, view, level }: Props) => {
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!imageUrl) return null;

  const nivelTexto = typeof level === "string" ? level.trim() : level != null ? String(level) : "";

  return (
    <>
      <SectionCard
        icon={Eye}
        title="Vista tentativa del departamento"
        headerRight={
          view ? (
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground">
              {view}
            </span>
          ) : undefined
        }
        bodyClassName="p-0"
      >
        <button
          type="button"
          aria-label="Ampliar la vista tentativa del departamento"
          onClick={() => setZoomOpen(true)}
          className="group relative block w-full cursor-zoom-in"
        >
          <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
            <img
              src={imageUrl}
              alt={view ? `Vista tentativa hacia ${view}` : "Vista tentativa del departamento"}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          <span className="absolute top-3 right-3 w-9 h-9 rounded-full bg-card/90 backdrop-blur-md border border-border flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Maximize2 className="w-4 h-4 text-foreground" />
          </span>
        </button>

        <div className="p-5 md:p-6 pt-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Imagen de referencia{view ? ` de la vista ${view}` : ""} del desarrollo
            {nivelTexto ? `, no del nivel ${nivelTexto} en particular` : ""}. La vista real varía
            según la altura y el entorno construido al momento de la entrega.
          </p>
        </div>
      </SectionCard>

      <FullscreenModal
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        label="Vista tentativa ampliada"
      >
        <img
          src={imageUrl}
          alt={view ? `Vista tentativa hacia ${view}` : "Vista tentativa del departamento"}
          className="max-w-full max-h-full object-contain"
        />
      </FullscreenModal>
    </>
  );
};

export default OfferUnitView;
