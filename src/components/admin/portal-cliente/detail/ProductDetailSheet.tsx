import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  Clock,
  Calendar,
  CreditCard,
  CheckCircle2,
  Truck,
  AlertCircle,
} from "lucide-react";
import type { AdditionalProduct } from "@/lib/portal-cliente/types";
import { fmtMXN as fmt } from "@/lib/utils";

interface Props {
  product: AdditionalProduct | null;
  open: boolean;
  onClose: () => void;
}

type StatusCfg = {
  label: string;
  icon: React.ElementType;
  pillCls: string;
  cardCls: string;
};

const STATUS_CFG: Record<AdditionalProduct["status"], StatusCfg> = {
  pendiente:  { label: "Pendiente de pago",  icon: AlertCircle,   pillCls: "bg-warning/15 text-warning",   cardCls: "bg-warning/[0.04] border-warning/20"  },
  financiado: { label: "En curso",            icon: Clock,         pillCls: "bg-primary/10 text-primary",   cardCls: "bg-primary/[0.04] border-primary/20"  },
  pagado:     { label: "Liquidado",           icon: CheckCircle2,  pillCls: "bg-success/15 text-success",   cardCls: "bg-success/[0.04] border-success/20"  },
  entregado:  { label: "Entregado",           icon: Truck,         pillCls: "bg-success/15 text-success",   cardCls: "bg-success/[0.04] border-success/20"  },
};

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </p>
      <p className="text-[13px] text-foreground mt-0.5">{value}</p>
    </div>
  </div>
);

const ProductDetailSheet = ({ product, open, onClose }: Props) => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : false,
  );
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
      rafRef.current = requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = window.setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!mounted || !product) return null;

  const paidPct =
    product.totalPrice > 0
      ? Math.round((product.totalPaid / product.totalPrice) * 100)
      : 0;
  const fullyPaid = product.pendingBalance <= 0;
  const cfg = STATUS_CFG[product.status];
  const StatusIcon = cfg.icon;

  const content = (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
        <Package className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-foreground text-sm leading-tight truncate">
            {product.name}
          </h2>
          <p className="text-xs text-muted-foreground">Producto adicional</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 overflow-y-auto">
        {/* Status */}
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${cfg.cardCls}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.pillCls}`}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              Estado
            </p>
            <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Financial summary */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              Valor total
            </span>
            <span className="text-xl font-bold text-foreground tabular-nums">
              {fmt(product.totalPrice)}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
              <span>{paidPct}% pagado</span>
              <span>{100 - paidPct}% restante</span>
            </div>
            <Progress value={paidPct} className="h-2 bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-lg bg-success/[0.06] border border-success/20 p-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">
                Pagado
              </p>
              <p className="text-[15px] font-bold text-success tabular-nums leading-tight">
                {fmt(product.totalPaid)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{paidPct}%</p>
            </div>
            <div className="rounded-lg bg-card border border-border p-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">
                Pendiente
              </p>
              {fullyPaid ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <p className="text-[13px] font-semibold text-success">Liquidado</p>
                </div>
              ) : (
                <>
                  <p className="text-[15px] font-bold text-warning tabular-nums leading-tight">
                    {fmt(product.pendingBalance)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {100 - paidPct}%
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        {(product.financingPlan || product.nextDueDate || product.estimatedDelivery) && (
          <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border/60">
            {product.financingPlan && (
              <InfoRow
                icon={CreditCard}
                label="Plan de financiamiento"
                value={product.financingPlan}
              />
            )}
            {product.nextDueDate && product.nextDueAmount && (
              <InfoRow
                icon={Clock}
                label="Próximo vencimiento"
                value={`${fmt(product.nextDueAmount)} — ${product.nextDueDate}`}
              />
            )}
            {product.estimatedDelivery && (
              <InfoRow
                icon={Calendar}
                label="Entrega estimada"
                value={product.estimatedDelivery}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-8 pt-4 border-t border-border/50 shrink-0">
        <button
          onClick={onClose}
          className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {isDesktop ? (
        <div
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2
                     rounded-2xl bg-background shadow-2xl overflow-hidden max-h-[90vh]
                     transition-all duration-200 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible
              ? "translate(-50%, -50%) scale(1)"
              : "translate(-50%, -50%) scale(0.96)",
          }}
        >
          {content}
        </div>
      ) : (
        <div
          className="fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] rounded-t-2xl bg-background
                     flex flex-col shadow-2xl transition-transform duration-300 ease-out"
          style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
        >
          <div className="flex justify-center pt-3 shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>
          {content}
        </div>
      )}
    </>,
    document.body,
  );
};

export default ProductDetailSheet;
