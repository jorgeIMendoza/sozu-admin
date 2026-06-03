import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Clock, ChevronDown, ChevronUp, Eye, Download, X, Loader2, Receipt, FileText } from "lucide-react";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import { getPropertyStatus } from "@/lib/portal-cliente/mock-data";
import { usePaymentPlan } from "@/lib/portal-cliente/payment-data";
import PaymentReceiptModal, { type ReceiptData } from "./detail/PaymentReceiptModal";
import { buildReceiptFromPaymentRecord, buildReceiptFromInstallment, buildReceiptFromMaintenance } from "@/lib/portal-cliente/receipt-utils";
import { fmtMXN as fmt } from "@/lib/utils";
import { PROD_FUNCTIONS_BASE_URL, PROD_SUPABASE_ANON_KEY } from "@/lib/config";

const sozuLogo = "/sozu-logo.png";
const MONTH_NAMES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const currentPeriod = () => { const d = new Date(); return `${MONTH_NAMES_FULL[d.getMonth()]} ${d.getFullYear()}`; };

interface PaymentHistoryViewProps {
  investment: InvestmentProperty;
}

type UnifiedPayment = {
  date: string;
  concept: string;
  amount: number;
  status: "pagado" | "pendiente";
  type: "Inversión" | "Mantenimiento";
  sourceIndex: number;
  pagoId?: number;
  cepUrl?: string;
  evidenceUrl?: string;
};

type PdfModal = { url: string; concept: string; date: string; amount: number } | null;

interface MonthGroup {
  sortKey: string;
  label: string;
  payments: UnifiedPayment[];
}

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTHS_SHORT_MAP: Record<string, string> = {
  "Ene":"01","Feb":"02","Mar":"03","Abr":"04","May":"05","Jun":"06",
  "Jul":"07","Ago":"08","Sep":"09","Oct":"10","Nov":"11","Dic":"12"
};

function groupByMonth(payments: UnifiedPayment[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const p of payments) {
    let sortKey: string;
    let label: string;
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
      const [year, month] = p.date.split("-");
      sortKey = `${year}-${month}`;
      label = `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
    } else {
      const parts = p.date.split(" ");
      if (parts.length === 2 && MONTHS_SHORT_MAP[parts[0]]) {
        sortKey = `${parts[1]}-${MONTHS_SHORT_MAP[parts[0]]}`;
        label = p.date;
      } else {
        sortKey = p.date;
        label = p.date;
      }
    }
    const group = map.get(sortKey);
    if (group) group.payments.push(p);
    else map.set(sortKey, { sortKey, label, payments: [p] });
  }
  return [...map.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function fmtDate(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(date + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  }
  return date;
}

function fmtShortDate(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  }
  return date;
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|bmp)(\?.*)?$/i.test(url);
}

function IconBtn({ onClick, disabled, title, children }: { onClick?: () => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${!disabled ? "hover:bg-muted text-muted-foreground hover:text-primary" : "text-muted-foreground/25 cursor-not-allowed"}`}
    >
      {children}
    </button>
  );
}

const MobilePaymentRow = ({ payment, onReceiptClick, onEyeClick, onCepClick, generatingId }: {
  payment: UnifiedPayment;
  onReceiptClick: (p: UnifiedPayment) => void;
  onEyeClick: (p: UnifiedPayment) => void;
  onCepClick: (p: UnifiedPayment) => void;
  generatingId: number | null;
}) => {
  const isGenerating = !!payment.pagoId && generatingId === payment.pagoId;
  const hasCep = !!(payment.cepUrl || payment.evidenceUrl);
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${payment.status === "pagado" ? "bg-success/10" : "bg-warning/10"}`}>
        {payment.status === "pagado" ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Clock className="w-3.5 h-3.5 text-warning" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{payment.concept}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-muted-foreground">{fmtShortDate(payment.date)}</span>
          {payment.type === "Mantenimiento" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Mant.</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <div className="text-right mr-1">
          <p className={`text-sm font-semibold tabular-nums ${payment.status === "pagado" ? "text-foreground" : "text-warning"}`}>{fmt(payment.amount)}</p>
          <p className={`text-[10px] font-medium ${payment.status === "pagado" ? "text-success" : "text-warning"}`}>{payment.status === "pagado" ? "Pagado" : "Pendiente"}</p>
        </div>
        <IconBtn onClick={() => onReceiptClick(payment)} disabled={payment.status !== "pagado"} title={payment.status !== "pagado" ? "Pago pendiente" : "Ver recibo"}>
          <FileText className="w-4 h-4" />
        </IconBtn>
        <IconBtn onClick={() => !isGenerating && payment.pagoId && onEyeClick(payment)} disabled={!payment.pagoId || payment.status !== "pagado" || isGenerating} title={payment.status !== "pagado" ? "Pago pendiente" : payment.pagoId ? "Generar recibo PDF" : "Sin recibo"}>
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
        </IconBtn>
        <IconBtn onClick={() => hasCep && onCepClick(payment)} disabled={payment.status !== "pagado" || !hasCep} title={payment.status !== "pagado" ? "Pago pendiente" : payment.cepUrl ? "CEP electrónico" : hasCep ? "Comprobante de pago" : "Sin comprobante"}>
          <Receipt className="w-4 h-4" />
        </IconBtn>
      </div>
    </div>
  );
};

const PaymentHistoryView = ({ investment }: PaymentHistoryViewProps) => {
  const { property, payments, financials, maintenance } = investment;
  const status = getPropertyStatus(investment);
  const paymentPlan = usePaymentPlan(property.id);
  const [filterStatus, setFilterStatus] = useState<"todos" | "pagado" | "pendiente">("todos");
  const [filterYear, setFilterYear] = useState<string>("todos");
  const [filterType, setFilterType] = useState<"todos" | "Inversión" | "Mantenimiento">("todos");
  const [toggledGroups, setToggledGroups] = useState<Set<string>>(new Set());
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [pdfModal, setPdfModal] = useState<PdfModal>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const hasMaintenance = !!(maintenance?.history?.length);

  useEffect(() => {
    if (!pdfModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPdfModal(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pdfModal]);

  const handleViewReceipt = (p: UnifiedPayment) => {
    if (p.status !== "pagado") return;
    let receipt: ReceiptData;
    if (p.type === "Mantenimiento") {
      const mRecord = maintenance?.history[p.sourceIndex];
      if (!mRecord) return;
      receipt = buildReceiptFromMaintenance(mRecord.month, mRecord.amount, investment);
    } else if (paymentPlan) {
      receipt = buildReceiptFromInstallment(paymentPlan.installments[p.sourceIndex], paymentPlan, investment);
    } else {
      receipt = buildReceiptFromPaymentRecord(payments[p.sourceIndex], investment);
    }
    setReceiptData(receipt);
  };

  async function downloadPdf(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);
    } catch {
      window.open(url, "_blank");
    }
  }

  function openPdf(url: string, p: UnifiedPayment) {
    setPdfModal({ url, concept: p.concept, date: p.date, amount: p.amount });
  }

  const statusColorClass =
    status.color === "warning" ? "bg-warning/15 text-warning"
    : status.color === "success" ? "bg-success/15 text-success"
    : "bg-primary/15 text-primary";

  const allPayments = useMemo<UnifiedPayment[]>(() => {
    const result: UnifiedPayment[] = [];
    if (paymentPlan) {
      paymentPlan.installments.forEach((inst, i) => result.push({
        date: inst.dueDate,
        concept: inst.number === 1 ? "Enganche" : `Parcialidad ${inst.number}`,
        amount: inst.amount,
        status: inst.status === "pagado" ? "pagado" : "pendiente",
        type: "Inversión",
        sourceIndex: i,
      }));
    } else {
      payments.forEach((p, i) => result.push({
        date: p.date,
        concept: p.concept,
        amount: p.amount,
        status: p.status,
        type: "Inversión",
        sourceIndex: i,
        pagoId: p.pagoId,
        cepUrl: p.cepUrl,
        evidenceUrl: p.evidenceUrl,
      }));
    }
    maintenance?.history?.forEach((m, i) => result.push({
      date: m.month,
      concept: "Mantenimiento",
      amount: m.amount,
      status: m.status,
      type: "Mantenimiento",
      sourceIndex: i,
    }));
    return result;
  }, [payments, paymentPlan, maintenance]);

  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    allPayments.forEach(p => { const match = p.date.match(/\b(20\d{2})\b/); if (match) yrs.add(match[1]); });
    return [...yrs].sort((a, b) => b.localeCompare(a));
  }, [allPayments]);

  const filtered = useMemo(() => {
    let r = allPayments;
    if (filterYear !== "todos") r = r.filter(p => p.date.includes(filterYear));
    if (filterStatus === "pagado") r = r.filter(p => p.status === "pagado");
    if (filterStatus === "pendiente") r = r.filter(p => p.status === "pendiente");
    if (filterType !== "todos") r = r.filter(p => p.type === filterType);
    return r;
  }, [allPayments, filterYear, filterStatus, filterType]);

  // Desktop table: flat, newest first
  const sortedForTable = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  const monthGroups = useMemo(() => groupByMonth(filtered), [filtered]);
  const paidPayments = allPayments.filter(p => p.status === "pagado");
  const totalPaid = paidPayments.reduce((s, p) => s + p.amount, 0);
  const lastPaid = [...paidPayments].sort((a, b) => b.date.localeCompare(a.date))[0];
  const progressPct = Math.min(100, Math.round((financials.totalPaid / financials.initialPrice) * 100));

  const isGroupExpanded = (key: string) => {
    const isFirst = monthGroups[0]?.sortKey === key;
    return isFirst ? !toggledGroups.has(key) : toggledGroups.has(key);
  };
  const toggleMonth = (key: string) =>
    setToggledGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleEyeClick = async (p: UnifiedPayment) => {
    if (!p.pagoId || generatingId) return;
    setGeneratingId(p.pagoId);
    try {
      const res = await fetch(`${PROD_FUNCTIONS_BASE_URL}/generar-recibo-pago`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PROD_SUPABASE_ANON_KEY}`,
          "apikey": PROD_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ pagoId: p.pagoId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url_recibo) {
        console.error("Error generating receipt:", data);
        return;
      }
      setPdfModal({ url: data.url_recibo, concept: p.concept, date: p.date, amount: p.amount });
    } finally {
      setGeneratingId(null);
    }
  };

  // ── Shared blocks ──────────────────────────────────────────────

  const filterBar = (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Período</p>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterYear("todos")} className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${filterYear === "todos" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}>Todos</button>
          {availableYears.map(y => (
            <button key={y} onClick={() => setFilterYear(y)} className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${filterYear === y ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}>{y}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap border-t border-border pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Estatus</p>
        <div className="flex gap-1.5 flex-wrap">
          {([["todos","Todos"],["pagado","Pagados"],["pendiente","Pendientes"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)} className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${filterStatus === val ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}>{label}</button>
          ))}
        </div>
      </div>
      {hasMaintenance && (
        <div className="flex items-center justify-between gap-2 flex-wrap border-t border-border pt-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</p>
          <div className="flex gap-1.5 flex-wrap">
            {([["todos","Todos"],["Inversión","Inversión"],["Mantenimiento","Mantenimiento"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFilterType(val as "todos" | "Inversión" | "Mantenimiento")} className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${filterType === val ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const summaryBlock = (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2 flex-nowrap">
        <img src={sozuLogo} alt="SOZU" className="h-3.5 w-auto object-contain dark:invert shrink-0" />
        <span className="text-muted-foreground text-xs shrink-0">-</span>
        <p className="text-xs font-semibold text-foreground truncate flex-1">Historial de Pagos</p>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${statusColorClass}`}>{status.label}</span>
      </div>
      <div className="text-[11px] text-muted-foreground space-y-1 border-t border-border pt-3">
        <div className="flex justify-between">
          <span>Propiedad</span>
          <span className="font-semibold text-foreground">{property.projectName} · U-{property.unitNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Periodo</span>
          <span className="font-semibold text-foreground">{currentPeriod()}</span>
        </div>
      </div>
      <div className="space-y-2.5 border-t border-border pt-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Total Pagado</span>
          <span className="font-display font-bold text-sm text-primary tabular-nums">{fmt(totalPaid)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Pagos realizados</span>
          <span className="font-semibold text-sm text-foreground">{paidPayments.length}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Último pago</span>
          <span className="font-semibold text-sm text-foreground">{lastPaid ? fmtShortDate(lastPaid.date) : "—"}</span>
        </div>
      </div>
      <div className="border-t border-border pt-3">
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-muted-foreground">Progreso</span>
          <span className="font-semibold text-foreground tabular-nums">{progressPct}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </div>
  );

  // ── Desktop payments table ──
  const desktopPaymentsTable = (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
        <h3 className="font-display font-semibold text-sm text-foreground">Pagos registrados</h3>
        <span className="text-[11px] text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      {sortedForTable.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Sin pagos con ese filtro</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/10 text-left">
                <th className="px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Fecha</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Concepto</th>
                {hasMaintenance && (
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                )}
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap">Monto</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Estatus</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {sortedForTable.map((p, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td className="px-3 py-3 text-[13px] font-medium text-foreground">{p.concept}</td>
                  {hasMaintenance && (
                    <td className="px-3 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${p.type === "Mantenimiento" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                        {p.type}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-[13px] text-foreground">{fmt(p.amount)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                      p.status === "pagado" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}>
                      {p.status === "pagado" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {p.status === "pagado" ? "Pagado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-0.5">
                      <IconBtn onClick={() => handleViewReceipt(p)} disabled={p.status !== "pagado"} title={p.status !== "pagado" ? "Pago pendiente" : "Ver recibo"}>
                        <FileText className="w-4 h-4" />
                      </IconBtn>
                      <IconBtn onClick={() => handleEyeClick(p)} disabled={!p.pagoId || p.status !== "pagado" || generatingId === p.pagoId} title={p.status !== "pagado" ? "Pago pendiente" : p.pagoId ? "Generar recibo PDF" : "Sin recibo"}>
                        {generatingId === p.pagoId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                      </IconBtn>
                      <IconBtn onClick={() => { const url = p.cepUrl ?? p.evidenceUrl; if (url) openPdf(url, p); }} disabled={p.status !== "pagado" || (!p.cepUrl && !p.evidenceUrl)} title={p.status !== "pagado" ? "Pago pendiente" : p.cepUrl ? "CEP electrónico" : p.evidenceUrl ? "Comprobante de pago" : "Sin comprobante"}>
                        <Receipt className="w-4 h-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Mobile payments (month groups) ──
  const mobilePaymentsBlock = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm text-foreground">Pagos registrados</h3>
        <span className="text-[11px] text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-3">
        {monthGroups.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Sin pagos con ese filtro</p>
          </div>
        ) : (
          monthGroups.map(group => (
            <div key={group.sortKey} className="bg-card rounded-xl border border-border overflow-hidden">
              <button onClick={() => toggleMonth(group.sortKey)} className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
                <span className="text-xs font-semibold text-foreground">{group.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {group.payments.filter(p => p.status === "pagado").length} pagado{group.payments.filter(p => p.status === "pagado").length !== 1 ? "s" : ""}
                  </span>
                  {isGroupExpanded(group.sortKey) ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </button>
              {isGroupExpanded(group.sortKey) && (
                <div className="px-4">
                  {group.payments.map((p, i) => <MobilePaymentRow key={i} payment={p} onReceiptClick={handleViewReceipt} onEyeClick={handleEyeClick} onCepClick={(pay) => { const url = pay.cepUrl ?? pay.evidenceUrl; if (url) openPdf(url, pay); }} generatingId={generatingId} />)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in pb-8">
      {/* Mobile */}
      <div className="md:hidden space-y-4 pb-6">
        {filterBar}
        {summaryBlock}
        {mobilePaymentsBlock}
      </div>

      {/* Desktop: 2-col */}
      <div className="hidden md:grid md:grid-cols-[1fr_280px] md:gap-6 md:items-start">
        <div className="space-y-4">
          {filterBar}
          {desktopPaymentsTable}
        </div>
        <div className="sticky top-20 space-y-4">
          {summaryBlock}
        </div>
      </div>

      <PaymentReceiptModal receipt={receiptData} open={!!receiptData} onClose={() => setReceiptData(null)} />

      {pdfModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setPdfModal(null)}
        >
          <div
            className="bg-card w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[90svh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div>
                <p className="text-sm font-semibold text-foreground">{pdfModal.concept}</p>
                <p className="text-[11px] text-muted-foreground">{fmtDate(pdfModal.date)} · {fmt(pdfModal.amount)}</p>
              </div>
              <button
                onClick={() => setPdfModal(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-destructive/15 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4 text-destructive" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex items-center justify-center bg-muted/10" style={{ minHeight: "60vh", maxHeight: "60vh" }}>
              {isImageUrl(pdfModal.url) ? (
                <img
                  src={pdfModal.url}
                  alt="Comprobante de pago"
                  className="max-w-full object-contain"
                  style={{ maxHeight: "60vh", width: "auto" }}
                />
              ) : (
                <iframe
                  src={pdfModal.url}
                  className="w-full border-0"
                  title="Comprobante de pago"
                  style={{ height: "60vh" }}
                />
              )}
            </div>
            <div className="px-5 py-4 border-t border-border shrink-0">
              <button
                onClick={() => downloadPdf(pdfModal.url, `SOZU-Recibo-${pdfModal.concept}-${pdfModal.date}.pdf`)}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-xl hover:bg-primary/90 transition-colors active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PaymentHistoryView;
