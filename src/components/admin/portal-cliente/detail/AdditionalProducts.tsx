import { useState } from "react";
import { Package, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { AdditionalProduct } from "@/lib/portal-cliente/mock-data";
import ProductDetailSheet from "./ProductDetailSheet";
import { fmtMXN as fmt } from "@/lib/utils";

interface AdditionalProductsProps {
  products: AdditionalProduct[];
}

const statusConfig: Record<AdditionalProduct["status"], { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-warning/15 text-warning-foreground border-warning/30" },
  financiado: { label: "Financiado", className: "bg-primary/10 text-primary border-primary/30" },
  pagado: { label: "Pagado", className: "bg-success/15 text-success border-success/30" },
  entregado: { label: "Entregado", className: "bg-success/15 text-success border-success/30" },
};

const AdditionalProducts = ({ products }: AdditionalProductsProps) => {
  const [selected, setSelected] = useState<AdditionalProduct | null>(null);

  if (!products.length) return null;

  return (
    <section className="px-5 py-4">
      <h4 className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2">
        Productos adicionales
      </h4>

      <div className="space-y-2.5">
        {products.map((product) => {
          const progress = product.totalPrice > 0
            ? (product.totalPaid / product.totalPrice) * 100
            : 0;
          const cfg = statusConfig[product.status];

          return (
            <button
              key={product.id}
              onClick={() => setSelected(product)}
              className="w-full bg-card rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted group"
            >
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{fmt(product.totalPrice)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${cfg.className}`}>
                    {cfg.label}
                  </Badge>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
                </div>
              </div>

              {product.pendingBalance > 0 && (
                <div className="space-y-1.5">
                  <Progress value={progress} className="h-1.5 bg-secondary" />
                  <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                    <span>Pagado {fmt(product.totalPaid)}</span>
                    <span>Pendiente {fmt(product.pendingBalance)}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <ProductDetailSheet
        product={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
};

export default AdditionalProducts;
