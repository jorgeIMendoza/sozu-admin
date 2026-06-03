import { useState } from "react";
import { Package, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AdditionalProduct } from "@/lib/portal-cliente/types";
import ProductDetailSheet from "./ProductDetailSheet";
import { fmtMXN as fmt } from "@/lib/utils";

interface Props {
  products: AdditionalProduct[];
}

const STATUS_CFG: Record<AdditionalProduct["status"], { label: string; dot: string; badge: string }> = {
  pendiente:  { label: "Pendiente",  dot: "bg-warning",         badge: "bg-warning/15 text-warning border-warning/30" },
  financiado: { label: "En curso",   dot: "bg-primary",         badge: "bg-primary/10 text-primary border-primary/30" },
  pagado:     { label: "Pagado",     dot: "bg-success",         badge: "bg-success/15 text-success border-success/30" },
  entregado:  { label: "Entregado",  dot: "bg-success",         badge: "bg-success/15 text-success border-success/30" },
};

const AdditionalProducts = ({ products }: Props) => {
  const [selected, setSelected] = useState<AdditionalProduct | null>(null);

  if (!products.length) return null;

  return (
    <>
      <div className="px-5 pt-5 pb-4 space-y-2.5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3">
          Productos adicionales · {products.length}
        </p>

        {products.map((p) => {
          const cfg = STATUS_CFG[p.status];
          const paidPct = p.totalPrice > 0 ? Math.round((p.totalPaid / p.totalPrice) * 100) : 0;

          return (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="w-full text-left rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 active:bg-secondary transition-colors overflow-hidden group"
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
                      {p.name}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 h-4 leading-none flex-shrink-0 ${cfg.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1 inline-block`} />
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Progress bar */}
                  {p.totalPrice > 0 && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.status === "pagado" || p.status === "entregado" ? "bg-success" : "bg-primary"}`}
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                        {paidPct}%
                      </span>
                    </div>
                  )}

                  {/* Amounts */}
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-[11px] font-semibold text-foreground tabular-nums">
                      {fmt(p.totalPrice)}
                    </span>
                    {p.pendingBalance > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        · {fmt(p.pendingBalance)} pendiente
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
              </div>
            </button>
          );
        })}
      </div>

      <ProductDetailSheet
        product={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
};

export default AdditionalProducts;
