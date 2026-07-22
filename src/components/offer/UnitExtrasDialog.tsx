import { useState } from "react";
import { Package, Car, MapPin, Ruler, Check, KeyRound, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { OfertaBodega, OfertaBodegaPago, OfertaEstacionamiento } from "@/lib/offers/offer-data";

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

const formatCurrency = (v?: number) =>
  v != null && v > 0
    ? new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v)
    : null;

// % sin decimales innecesarios: 5 → "5%", 16.29 → "16.29%".
const fmtPct = (n: number) =>
  `${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })}%`;

// Construye la lista de tramos del esquema en orden lógico: enganche → mensualidades → entrega.
const esquemaTramos = (pago: OfertaBodegaPago): string[] => {
  const tramos: string[] = [];
  if (pago.pctEnganche > 0) tramos.push(`${fmtPct(pago.pctEnganche)} de enganche`);
  if (pago.pctMensualidades > 0) {
    tramos.push(
      pago.numMensualidades > 0
        ? `${fmtPct(pago.pctMensualidades)} en ${pago.numMensualidades} mensualidades`
        : `${fmtPct(pago.pctMensualidades)} en mensualidades`
    );
  }
  if (pago.pctEntrega > 0) tramos.push(`${fmtPct(pago.pctEntrega)} a la entrega`);
  return tramos;
};

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
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const copyClabe = (id: number, clabe: string) => {
    navigator.clipboard?.writeText(clabe);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  const items =
    kind === "bodega"
      ? (bodegas ?? []).map((b) => ({
          id: b.id,
          nombre: b.nombre,
          ubicacion: b.ubicacion,
          m2: b.m2,
          incluido: b.incluido,
          costo: b.costo,
          tipo: undefined as string | undefined,
          pago: b.pago as OfertaBodegaPago | undefined,
        }))
      : (estacionamientos ?? []).map((e) => ({
          id: e.id,
          nombre: e.nombre,
          ubicacion: e.ubicacion,
          m2: e.m2,
          incluido: e.incluido,
          costo: undefined as number | undefined,
          tipo: e.tipo,
          pago: undefined as OfertaBodegaPago | undefined,
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
            const costo = kind === "bodega" ? formatCurrency(it.costo) : null;
            const pago = kind === "bodega" ? it.pago : undefined;
            const tramos = pago ? esquemaTramos(pago) : [];
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

                {costo && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold tabular-nums">{costo}</span>
                    {it.incluido && (
                      <span className="text-[11px] italic text-muted-foreground text-right">
                        se sumará en el precio total de la oferta
                      </span>
                    )}
                  </div>
                )}

                {pago && (tramos.length > 0 || pago.clabeStp) && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2.5">
                    {tramos.length > 0 && (
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-muted-foreground/60">
                          Esquema de pago
                        </p>
                        <p className="text-xs font-semibold text-foreground">
                          {tramos.join(" · ")}
                        </p>
                      </div>
                    )}

                    {pago.clabeStp && (
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/40">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <KeyRound className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-muted-foreground/60">
                            Clabe STP bodega
                          </p>
                          <p className="text-sm font-bold tabular-nums truncate">{pago.clabeStp}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyClabe(it.id, pago.clabeStp!)}
                          className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:opacity-80"
                          aria-label="Copiar CLABE de bodega"
                        >
                          {copiedId === it.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === it.id ? "Copiada" : "Copiar"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnitExtrasDialog;
