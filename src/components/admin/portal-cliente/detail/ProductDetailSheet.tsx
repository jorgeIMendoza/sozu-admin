import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, Clock, Calendar, CreditCard, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdditionalProduct } from "@/lib/portal-cliente/types";
import { fmtMXN as fmt } from "@/lib/utils";

interface Props {
  product: AdditionalProduct | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_CFG: Record<AdditionalProduct["status"], { label: string; badge: string }> = {
  pendiente:  { label: "Pendiente",  badge: "bg-warning/15 text-warning border-warning/30" },
  financiado: { label: "En curso",   badge: "bg-primary/10 text-primary border-primary/30" },
  pagado:     { label: "Pagado",     badge: "bg-success/15 text-success border-success/30" },
  entregado:  { label: "Entregado",  badge: "bg-success/15 text-success border-success/30" },
};

const Row = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
  <div className="flex items-center gap-3 px-4 py-3.5">
    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-[13px] text-foreground mt-0.5">{value}</p>
    </div>
  </div>
);

const ProductDetailSheet = ({ product, open, onClose }: Props) => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false,
  );
  // Separate mounted/visible for CSS transition: mount first, then add visible class
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (open) {
      setMounted(true);
      // One rAF so the browser paints the mounted (hidden) element before transitioning to visible
      rafRef.current = requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = window.setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!mounted || !product) return null;

  const paidPct = product.totalPrice > 0
    ? Math.round((product.totalPaid / product.totalPrice) * 100)
    : 0;
  const fullyPaid = product.pendingBalance <= 0;
  const cfg = STATUS_CFG[product.status];

  const header = (
    <div className="flex items-start gap-3 px-5 pt-5 pb-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Package className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground leading-none mb-1">
          Producto adicional
        </p>
        <h2 className="font-display font-bold text-[16px] text-foreground leading-tight">{product.name}</h2>
        <Badge variant="outline" className={cn("text-[9px] px-2 py-0 mt-1.5 h-4", cfg.badge)}>
          {cfg.label}
        </Badge>
      </div>
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-destructive/10 transition-colors flex-shrink-0 mt-0.5"
      >
        <X className="w-4 h-4 text-destructive" />
      </button>
    </div>
  );

  const body = (
    <div className="px-5 pb-6 space-y-4">
      {product.description && (
        <p className="text-[13px] text-muted-foreground leading-relaxed">{product.description}</p>
      )}

      <div className="rounded-xl bg-secondary/60 border border-border p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Valor total</span>
          <span className="text-[22px] font-display font-bold text-foreground tabular-nums leading-none">
            {fmt(product.totalPrice)}
          </span>
        </div>
        <Progress value={paidPct} className="h-2.5 bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-card border border-border p-3">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Pagado</p>
            <p className="text-[15px] font-bold text-success tabular-nums leading-tight">{fmt(product.totalPaid)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{paidPct}%</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Pendiente</p>
            {fullyPaid ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <p className="text-[13px] font-semibold text-success">Liquidado</p>
              </div>
            ) : (
              <>
                <p className="text-[15px] font-bold text-warning tabular-nums leading-tight">
                  {fmt(product.pendingBalance)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{100 - paidPct}% restante</p>
              </>
            )}
          </div>
        </div>
      </div>

      {(product.financingPlan || product.nextDueDate || product.estimatedDelivery) && (
        <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
          {product.financingPlan && (
            <Row icon={CreditCard} label="Plan de financiamiento" value={product.financingPlan} />
          )}
          {product.nextDueDate && product.nextDueAmount && (
            <Row icon={Clock} label="Próximo vencimiento" value={`${fmt(product.nextDueAmount)} — ${product.nextDueDate}`} />
          )}
          {product.estimatedDelivery && (
            <Row icon={Calendar} label="Entrega estimada" value={product.estimatedDelivery} />
          )}
        </div>
      )}
    </div>
  );

  return createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {isDesktop ? (
        // Desktop: centered dialog
        <div
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2
                     rounded-xl bg-background shadow-2xl overflow-hidden
                     transition-all duration-200 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible
              ? "translate(-50%, -50%) scale(1)"
              : "translate(-50%, -50%) scale(0.95)",
          }}
        >
          {header}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 100px)" }}>
            {body}
          </div>
        </div>
      ) : (
        // Mobile: bottom sheet slides up
        <div
          className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] rounded-t-xl bg-background
                     flex flex-col overflow-hidden shadow-2xl
                     transition-transform duration-300 ease-out"
          style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
        >
          <div className="flex justify-center pt-3 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>
          <div className="overflow-y-auto flex-1">
            {header}
            {body}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
};

export default ProductDetailSheet;
