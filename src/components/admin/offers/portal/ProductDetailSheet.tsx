import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, Calendar, FileText, CreditCard, Clock } from "lucide-react";
import type { AdditionalProduct } from "@/lib/offers/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";

interface ProductDetailSheetProps {
  product: AdditionalProduct | null;
  open: boolean;
  onClose: () => void;
}

const statusConfig: Record<AdditionalProduct["status"], { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-warning/15 text-warning-foreground border-warning/30" },
  financiado: { label: "Financiado", className: "bg-primary/10 text-primary border-primary/30" },
  pagado: { label: "Pagado", className: "bg-success/15 text-success border-success/30" },
  entregado: { label: "Entregado", className: "bg-success/15 text-success border-success/30" },
};

const ProductDetailSheet = ({ product, open, onClose }: ProductDetailSheetProps) => {
  if (!product) return null;

  const progress = product.totalPrice > 0
    ? (product.totalPaid / product.totalPrice) * 100
    : 0;
  const cfg = statusConfig[product.status];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-8">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold text-foreground text-left">
                {product.name}
              </SheetTitle>
              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 mt-1 ${cfg.className}`}>
                {cfg.label}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        {/* Financial summary */}
        <div className="bg-secondary/50 rounded-xl p-4 space-y-3 mb-4">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Valor total</span>
            <span className="text-lg font-semibold text-foreground tabular-nums">{fmt(product.totalPrice)}</span>
          </div>

          <Progress value={progress} className="h-2 bg-secondary" />

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Pagado</p>
              <p className="text-sm font-semibold text-primary tabular-nums">{fmt(product.totalPaid)}</p>
            </div>
            <div className="bg-card rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Pendiente</p>
              <p className={`text-sm font-semibold tabular-nums ${product.pendingBalance > 0 ? "text-warning-foreground" : "text-foreground"}`}>
                {fmt(product.pendingBalance)}
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border mb-4">
          {product.financingPlan && (
            <div className="flex items-center gap-3 px-4 py-3">
              <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">Financiamiento</p>
                <p className="text-sm text-foreground">{product.financingPlan}</p>
              </div>
            </div>
          )}

          {product.nextDueDate && product.nextDueAmount && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Clock className="w-4 h-4 text-warning flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">Próximo vencimiento</p>
                <p className="text-sm text-foreground">
                  {fmt(product.nextDueAmount)} — {product.nextDueDate}
                </p>
              </div>
            </div>
          )}

          {product.estimatedDelivery && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">Entrega estimada</p>
                <p className="text-sm text-foreground">{product.estimatedDelivery}</p>
              </div>
            </div>
          )}
        </div>

        {/* Documents */}
        {product.documents.length > 0 && (
          <div>
            <h4 className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2">
              Documentos
            </h4>
            <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
              {product.documents.map((doc, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground flex-1">{doc.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 ${
                      doc.status === "disponible"
                        ? "bg-success/15 text-success border-success/30"
                        : "bg-warning/15 text-warning-foreground border-warning/30"
                    }`}
                  >
                    {doc.status === "disponible" ? "Ver" : "Pendiente"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ProductDetailSheet;
