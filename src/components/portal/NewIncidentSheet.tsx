import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Camera, X, Plus, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";
import {
  usePostDeliveryStore,
  useWarrantyForProperty,
  computeWarrantyDates,
  type IncidentCategory,
  type IncidentSeverity,
} from "@/lib/offers/post-delivery-data";

interface Props {
  propertyId: string;
  prefilledWarrantyClaim?: boolean;
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: { id: IncidentCategory; label: string }[] = [
  { id: "electrico", label: "Eléctrico" },
  { id: "plomeria", label: "Plomería" },
  { id: "acabados", label: "Acabados" },
  { id: "electrodomestico", label: "Electrodoméstico" },
  { id: "estructura", label: "Estructura" },
  { id: "otro", label: "Otro" },
];

const SEVERITIES: { id: IncidentSeverity; label: string; description: string }[] = [
  { id: "baja", label: "Baja", description: "Detalle cosmético, no afecta uso" },
  { id: "media", label: "Media", description: "Afecta confort, no es urgente" },
  { id: "alta", label: "Alta", description: "Afecta uso normal de la propiedad" },
  { id: "urgente", label: "Urgente", description: "Riesgo de daño mayor o seguridad" },
];

const NewIncidentSheet = ({
  propertyId,
  prefilledWarrantyClaim,
  open,
  onClose,
}: Props) => {
  const createIncident = usePostDeliveryStore((s) => s.createIncident);
  const warranty = useWarrantyForProperty(propertyId);
  const warrantyDates = warranty ? computeWarrantyDates(warranty) : null;
  const isWarrantyActive =
    !!warrantyDates && warrantyDates.status !== "expirada";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory | null>(null);
  const [severity, setSeverity] = useState<IncidentSeverity>("media");
  const [photos, setPhotos] = useState<string[]>([]);
  const [warrantyClaimed, setWarrantyClaimed] = useState(
    !!prefilledWarrantyClaim,
  );

  // Sync prefilled flag whenever sheet opens
  useEffect(() => {
    if (open) setWarrantyClaimed(!!prefilledWarrantyClaim);
  }, [open, prefilledWarrantyClaim]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory(null);
    setSeverity("media");
    setPhotos([]);
    setWarrantyClaimed(false);
  };

  const handleAddPhoto = () => {
    if (photos.length >= 4) {
      toast.error("Máximo 4 fotos por incidencia.");
      return;
    }
    // SWAP POINT: en producción, file picker real.
    setPhotos([...photos, `mock-photo-${photos.length + 1}.jpg`]);
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    category !== null;

  const handleSubmit = () => {
    if (!canSubmit || !category) return;
    const claim = isWarrantyActive ? warrantyClaimed : false;
    createIncident({
      propertyId,
      severity,
      category,
      title: title.trim(),
      description: description.trim(),
      photos,
      warrantyClaimed: claim,
    });
    toast.success(
      claim
        ? "Reporte recibido. Validaremos cobertura de garantía y te asignaremos técnico."
        : "Incidencia reportada. Te avisaremos al asignar técnico.",
    );
    reset();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <SheetContent
        side="bottom"
        className="h-[95vh] p-0 rounded-t-2xl overflow-y-auto"
      >
        <div className="p-5 flex items-start gap-3 border-b border-border">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Reportar incidencia
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {prefilledWarrantyClaim
                ? "Reclamo bajo tu garantía de vicios ocultos"
                : "Cuéntanos qué pasó y nuestro equipo lo revisará"}
            </p>
          </div>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Título */}
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              Título
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Filtración en baño principal"
              maxLength={80}
              className="mt-1 w-full h-11 px-3 rounded-xl bg-muted border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {/* Categoría */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
              Categoría
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`h-10 px-2 rounded-xl text-xs font-medium border transition-colors ${
                    category === cat.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severidad */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
              Severidad
            </p>
            <div className="space-y-2">
              {SEVERITIES.map((sev) => (
                <button
                  key={sev.id}
                  onClick={() => setSeverity(sev.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    severity === sev.id
                      ? "bg-primary/[0.05] border-primary/30"
                      : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {sev.label}
                    </span>
                    {severity === sev.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {sev.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              Descripción
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cuéntanos qué pasó, dónde y cuándo lo notaste."
              rows={4}
              maxLength={500}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-muted border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5 tabular-nums">
              {description.length}/500
            </p>
          </label>

          {/* Fotos */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
              Fotos <span className="opacity-70">(opcional, hasta 4)</span>
            </p>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-xl bg-muted overflow-hidden"
                >
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground p-1 text-center break-all">
                    {p}
                  </div>
                  <button
                    onClick={() => handleRemovePhoto(idx)}
                    aria-label="Quitar foto"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button
                  onClick={handleAddPhoto}
                  className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span className="text-[10px]">Foto</span>
                </button>
              )}
            </div>
          </div>

          {/* Reclamo bajo garantía */}
          {isWarrantyActive && (
            <button
              onClick={() => setWarrantyClaimed(!warrantyClaimed)}
              className={`w-full text-left rounded-xl border p-3 transition-colors flex items-start gap-3 ${
                warrantyClaimed
                  ? "bg-success/[0.05] border-success/30"
                  : "bg-card border-border"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  warrantyClaimed
                    ? "bg-success border-success"
                    : "border-border"
                }`}
              >
                {warrantyClaimed && (
                  <Check className="w-3 h-3 text-success-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-success" />
                  <span className="text-sm font-semibold text-foreground">
                    Reclamar bajo mi garantía
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Considero que este defecto está cubierto por la garantía de
                  vicios ocultos. SOZU validará la cobertura.
                </p>
              </div>
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Reportar incidencia
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NewIncidentSheet;
