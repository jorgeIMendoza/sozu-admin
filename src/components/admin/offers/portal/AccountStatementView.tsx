import { useState, useMemo } from "react";
import { ArrowLeft, Download, Filter, ChevronDown, Copy, CheckCircle2, Clock, Shield, FileText } from "lucide-react";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import { getPropertyStatus } from "@/lib/offers/mock-data";
import { usePaymentPlan, type PropertyPaymentPlan } from "@/lib/offers/payment-data";
import { toast } from "sonner";
import PaymentReceiptModal, { type ReceiptData } from "./detail/PaymentReceiptModal";
import { buildReceiptFromInstallment, buildReceiptFromPaymentRecord } from "@/lib/offers/receipt-utils";
import { fmtMXN as fmt } from "@/lib/utils";
import sozuLogo from "@/assets/sozu-logo.png";

interface AccountStatementViewProps {
  investment: InvestmentProperty;
  onBack: () => void;
}

interface Movement {
  date: string;
  concept: string;
  referenceSTP: string;
  amount: number;
  status: "pagado" | "pendiente";
  sourceIndex: number;
}

function generateMovements(inv: InvestmentProperty, paymentPlan: PropertyPaymentPlan | undefined): Movement[] {
  const movements: Movement[] = [];

  if (paymentPlan) {
    paymentPlan.installments.forEach((inst, i) => {
      movements.push({
        date: inst.dueDate,
        concept: inst.number === 1 ? "Enganche" : `Parcialidad`,
        referenceSTP: inst.status === "pagado"
          ? `NU39${Math.random().toString(36).substring(2, 15).toUpperCase()}`
          : "Pendiente",
        amount: inst.amount,
        status: inst.status === "pagado" ? "pagado" : "pendiente",
        sourceIndex: i,
      });
    });
  } else {
    inv.payments.forEach((p, i) => {
      movements.push({
        date: p.date,
        concept: p.concept,
        referenceSTP: "—",
        amount: p.amount,
        status: p.status,
        sourceIndex: i,
      });
    });
  }

  return movements;
}

const currentPeriod = () => {
  const now = new Date();
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
};

const AccountStatementView = ({ investment, onBack }: AccountStatementViewProps) => {
  const { property, financials } = investment;
  const status = getPropertyStatus(investment);
  const paymentPlan = usePaymentPlan(property.id);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("Todos");
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const movements = useMemo(() => generateMovements(investment, paymentPlan), [investment, paymentPlan]);

  const nextInstallment = paymentPlan?.installments.find((i) => i.status !== "pagado");

  const filteredMovements = useMemo(() => {
    if (selectedFilter === "Todos") return movements;
    if (selectedFilter === "Pagados") return movements.filter((m) => m.status === "pagado");
    if (selectedFilter === "Pendientes") return movements.filter((m) => m.status === "pendiente");
    return movements;
  }, [movements, selectedFilter]);

  const handleCopyCLABE = () => {
    if (paymentPlan?.stpInfo.clabe) {
      navigator.clipboard.writeText(paymentPlan.stpInfo.clabe);
      toast.success("CLABE copiada al portapapeles");
    }
  };

  const handleViewReceipt = (mov: Movement) => {
    if (mov.status !== "pagado") return;
    let receipt: ReceiptData;
    if (paymentPlan) {
      const inst = paymentPlan.installments[mov.sourceIndex];
      receipt = buildReceiptFromInstallment(inst, paymentPlan, investment);
    } else {
      const rec = investment.payments[mov.sourceIndex];
      receipt = buildReceiptFromPaymentRecord(rec, investment);
    }
    setReceiptData(receipt);
  };

  return (
    <div className="animate-fade-in pb-24">
      {/* Compact header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-semibold text-sm text-foreground">Estado de cuenta</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {property.projectName} · U{property.unitNumber}
            </p>
          </div>
          <button className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition-colors">
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Formal document header */}
      <div className="px-5 pt-5 pb-2">
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="bg-primary/5 border-b border-border px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <img src={sozuLogo} alt="SOZU" className="h-4 w-auto object-contain dark:invert flex-shrink-0" />
                <span className="text-muted-foreground text-xs">·</span>
                <p className="font-display font-semibold text-sm text-foreground truncate">Estado de Cuenta</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                status.color === "warning" ? "bg-warning/15 text-warning"
                : status.color === "success" ? "bg-success/15 text-success"
                : "bg-primary/15 text-primary"
              }`}>
                {status.label}
              </span>
            </div>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cliente</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">Alejandro García</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Periodo</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{currentPeriod()}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Propiedad</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">
                {property.projectName} — Unidad {property.unitNumber}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial summary */}
      <div className="px-5 py-3">
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-display font-semibold text-xs text-muted-foreground uppercase tracking-wider">Resumen Financiero</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Valor del Activo</span>
              <span className="font-display font-bold text-base text-foreground tabular-nums">{fmt(financials.initialPrice)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total Pagado</span>
              <span className="font-display font-semibold text-sm text-primary tabular-nums">{fmt(financials.totalPaid)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Saldo Pendiente</span>
              <span className="font-display font-semibold text-sm text-foreground tabular-nums">{fmt(financials.pendingBalance)}</span>
            </div>
            {nextInstallment && (
              <>
                <div className="border-t border-border" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Próxima Parcialidad</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    {fmt(nextInstallment.amount)}{" "}
                    <span className="text-muted-foreground font-normal">(Vence {nextInstallment.dueDateDisplay})</span>
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="pt-2">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-muted-foreground">Progreso de pago</span>
              <span className="font-semibold text-foreground tabular-nums">
                {Math.round((financials.totalPaid / financials.initialPrice) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(financials.totalPaid / financials.initialPrice) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Movements */}
      <div className="px-5 pt-2 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Movimientos Recientes</h3>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            Filtrar
            <ChevronDown className={`w-3 h-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {filterOpen && (
          <div className="pb-3 animate-fade-in">
            <div className="flex gap-1.5 flex-wrap">
              {["Todos", "Pagados", "Pendientes"].map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFilter(f)}
                  className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    selectedFilter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {filteredMovements.map((mov, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-3.5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    mov.status === "pagado" ? "bg-success/10" : "bg-warning/10"
                  }`}>
                    {mov.status === "pagado" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-warning" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{mov.concept}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {mov.date.includes("-")
                        ? new Date(mov.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
                        : mov.date}
                    </p>
                    {mov.referenceSTP !== "—" && mov.referenceSTP !== "Pendiente" && (
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        Ref: {mov.referenceSTP}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${
                      mov.status === "pagado" ? "text-foreground" : "text-warning"
                    }`}>
                      {fmt(mov.amount)}
                    </p>
                    <p className={`text-[10px] font-medium ${
                      mov.status === "pagado" ? "text-success" : "text-warning"
                    }`}>
                      {mov.status === "pagado" ? "Pagado" : "Pendiente"}
                    </p>
                  </div>
                  {mov.status === "pagado" && (
                    <button
                      onClick={() => handleViewReceipt(mov)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors group"
                      aria-label="Ver comprobante"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STP Payment instructions */}
      {paymentPlan && (
        <div className="px-5 pt-2 pb-4">
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="bg-primary/5 border-b border-border px-5 py-3">
              <h3 className="font-display font-semibold text-xs text-foreground">
                Instrucciones de Pago (Transferencia Interbancaria)
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-2.5">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] text-muted-foreground">Banco Receptor</span>
                  <span className="text-xs font-semibold text-foreground text-right">{paymentPlan.stpInfo.bankName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground">CLABE Interbancaria</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-foreground">{paymentPlan.stpInfo.clabe}</span>
                    <button onClick={handleCopyCLABE} className="p-1 rounded-md hover:bg-muted transition-colors">
                      <Copy className="w-3.5 h-3.5 text-primary" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground">Referencia</span>
                  <span className="text-xs font-mono font-semibold text-foreground">{paymentPlan.stpInfo.reference}</span>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    La CLABE está vinculada exclusivamente a tu propiedad y RFC. Los pagos realizados mediante transferencia se reflejan automáticamente al ser confirmados por el banco.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="px-5 pb-4">
        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          Este estado de cuenta es generado automáticamente por el sistema SOZU.
        </p>
      </div>

      <PaymentReceiptModal
        receipt={receiptData}
        open={!!receiptData}
        onClose={() => setReceiptData(null)}
      />
    </div>
  );
};

export default AccountStatementView;
