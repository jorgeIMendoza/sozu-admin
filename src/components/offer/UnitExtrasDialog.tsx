import { Package, Car, MapPin, Ruler, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { OfertaBodega, OfertaEstacionamiento } from "@/lib/offers/offer-data";

type ExtraKind = "bodega" | "estacionamiento";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ExtraKind;
  bodegas?: OfertaBodega[];
  estacionamientos?: OfertaEstacionamiento[];
}

const KIND_META: Record<ExtraKind, { title: string; singular: string; icon: typeof Package }> = {
  bodega: { title: "Bodegas incluidas", singular: "Bodega", icon: Package },
  estacionamiento: { title: "Estacionamientos incluidos", singular: "Cajón", icon: Car },
};

const formatM2 = (m2?: number) =>
  m2 != null && m2 > 0 ? `${m2.toLocaleString("es-MX", { maximumFractionDigits: 2 })} m²` : null;

const DetailChip = ({
  icon: Icon,
  label,
}: {
  icon: typeof MapPin;
  label: string;
}) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
    <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
    {label}
  </span>
);

const UnitExtrasDialog = ({ open, onOpenChange, kind, bodegas, estacionamientos }: Props) => {
  const meta = KIND_META[kind];
  const items =
    kind === "bodega"
      ? (bodegas ?? []).map((b) => ({
          id: b.id,
          nombre: b.nombre,
          ubicacion: b.ubicacion,
          m2: b.m2,
          incluido: b.incluido,
          tipo: undefined as string | undefined,
        }))
      : (estacionamientos ?? []).map((e) => ({
          id: e.id,
          nombre: e.nombre,
          ubicacion: e.ubicacion,
          m2: e.m2,
          incluido: e.incluido,
          tipo: e.tipo,
        }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <meta.icon className="w-4 h-4 text-primary" />
            {meta.title}
          </DialogTitle>
          <DialogDescription>
            {items.length} {items.length === 1 ? "unidad vinculada" : "unidades vinculadas"} a esta propiedad.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {items.map((it) => {
            const m2 = formatM2(it.m2);
            return (
              <div
                key={it.id}
                className="rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold">
                    {meta.singular} {it.nombre}
                  </span>
                  {it.incluido && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                      <Check className="w-3 h-3" />
                      Incluido
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {it.tipo && <DetailChip icon={Car} label={`Tipo: ${it.tipo}`} />}
                  {it.ubicacion && <DetailChip icon={MapPin} label={it.ubicacion} />}
                  {m2 && <DetailChip icon={Ruler} label={m2} />}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnitExtrasDialog;
