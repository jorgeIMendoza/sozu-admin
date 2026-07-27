import { useState, useMemo, useEffect, Fragment } from "react";
import { Copy, CheckCircle2, Clock, Shield, FileText, ChevronDown, ChevronUp, Receipt, Eye, Loader2, Layers } from "lucide-react";
import DocViewerPortal from "@/components/admin/portal-cliente/DocViewerPortal";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import { getPropertyStatus } from "@/lib/portal-cliente/mock-data";
import { usePaymentPlan, type PropertyPaymentPlan, type PaymentApplication } from "@/lib/portal-cliente/payment-data";
import PaymentReceiptModal, { type ReceiptData } from "./detail/PaymentReceiptModal";
import { buildReceiptFromInstallment, buildReceiptFromPaymentRecord } from "@/lib/portal-cliente/receipt-utils";
import { fmtMXNDecimals as fmt } from "@/lib/utils";
import { toast } from "sonner";
const sozuLogo = "/sozu-logo.png";
import { PROD_FUNCTIONS_BASE_URL, PROD_SUPABASE_ANON_KEY } from "@/lib/config";

interface AccountStatementViewProps {
  investment: InvestmentProperty;
}

type MovementStatus = "pagado" | "pendiente" | "parcial";

interface Movement {
  date: string;
  concept: string;
  referenceSTP: string;
  amount: number;   // monto planeado del concepto
  applied: number;  // suma de pagos aplicados
  status: MovementStatus;
  sourceIndex: number;
  rowKey: string;
  pagoId?: number;
  cepUrl?: string;
  evidenceUrl?: string;
  applications?: PaymentApplication[];
}

const statusLabel = (s: MovementStatus) => s === "pagado" ? "Pagado" : s === "parcial" ? "Parcial" : "Pendiente";

type PdfModal = { url: string; concept: string; date: string; amount: number } | null;

interface MonthGroup {
  sortKey: string;
  label: string;
  movements: Movement[];
}

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTHS_SHORT_MAP: Record<string, string> = {
  "Ene":"01","Feb":"02","Mar":"03","Abr":"04","May":"05","Jun":"06",
  "Jul":"07","Ago":"08","Sep":"09","Oct":"10","Nov":"11","Dic":"12"
};

function buildMovements(inv: InvestmentProperty, plan: PropertyPaymentPlan | undefined): Movement[] {
  if (plan) {
    return plan.installments.map((inst, i) => {
      const apps = inst.applications ?? [];
      const applied = inst.appliedAmount;
      const status: MovementStatus = inst.status === "pagado" ? "pagado" : applied > 0.01 ? "parcial" : "pendiente";
      const single = apps.length === 1 ? apps[0] : undefined;
      // Referencia real: la clave de rastreo del pago (o "Varios" si son múltiples). Nunca fabricar.
      const referenceSTP = apps.length > 1
        ? "Varios"
        : single?.trackingKey ?? (status === "pagado" ? "-" : "Pendiente");
      return {
        date: inst.dueDate,
        concept: inst.concepto,
        referenceSTP,
        amount: inst.amount,
        applied,
        status,
        sourceIndex: i,
        rowKey: `inv-${inst.id}`,
        pagoId: single?.pagoId,
        cepUrl: single?.cepUrl,
        evidenceUrl: single?.evidenceUrl,
        applications: apps,
      };
    });
  }
  return inv.payments.map((p, i) => ({
    date: p.date,
    concept: p.concept,
    referenceSTP: p.trackingKey ?? "-",
    amount: p.amount,
    applied: p.status === "pagado" ? p.amount : 0,
    status: p.status,
    sourceIndex: i,
    rowKey: `inv-${i}`,
    pagoId: p.pagoId,
    cepUrl: p.cepUrl,
    evidenceUrl: p.evidenceUrl,
  }));
}

// Monto por fila: parcial muestra aplicado de total + faltante.
const MontoCell = ({ m, className = "" }: { m: Movement; className?: string }) => {
  if (m.status === "parcial") {
    return (
      <div className="flex flex-col items-end leading-tight">
        <span className="text-[13px] font-semibold tabular-nums text-foreground whitespace-nowrap">{fmt(m.applied)}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">de {fmt(m.amount)}</span>
        <span className="text-[10px] font-medium text-warning tabular-nums whitespace-nowrap">Faltan {fmt(Math.max(0, m.amount - m.applied))}</span>
      </div>
    );
  }
  const amt = m.status === "pagado" ? (m.applied || m.amount) : m.amount;
  return <span className={`tabular-nums whitespace-nowrap ${className}`}>{fmt(amt)}</span>;
};

function groupByMonth(movements: Movement[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const mov of movements) {
    let sortKey: string;
    let label: string;
    if (/^\d{4}-\d{2}-\d{2}$/.test(mov.date)) {
      const [year, month] = mov.date.split("-");
      sortKey = `${year}-${month}`;
      label = `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
    } else {
      const parts = mov.date.split(" ");
      if (parts.length === 2 && MONTHS_SHORT_MAP[parts[0]]) {
        sortKey = `${parts[1]}-${MONTHS_SHORT_MAP[parts[0]]}`;
        label = mov.date;
      } else {
        sortKey = mov.date;
        label = mov.date;
      }
    }
    const group = map.get(sortKey);
    if (group) group.movements.push(mov);
    else map.set(sortKey, { sortKey, label, movements: [mov] });
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

const currentPeriod = () => {
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
};

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

// ── Mobile movement row ──
const MovementRow = ({ mov, onReceiptClick, onEyeClick, onCepClick, generatingId, multiCount = 0, expanded = false, onToggle }: {
  mov: Movement;
  onReceiptClick: (m: Movement) => void;
  onEyeClick: (m: Movement) => void;
  onCepClick: (m: Movement) => void;
  generatingId: number | null;
  multiCount?: number;
  expanded?: boolean;
  onToggle?: () => void;
}) => {
  const isGenerating = !!mov.pagoId && generatingId === mov.pagoId;
  const hasCep = !!(mov.cepUrl || mov.evidenceUrl);
  const multi = multiCount > 1;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${mov.status === "pagado" ? "bg-success/10" : "bg-warning/10"}`}>
        {mov.status === "pagado" ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Clock className="w-3.5 h-3.5 text-warning" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-foreground">{mov.concept}</p>
          {multi && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              <Layers className="w-2.5 h-2.5" />{multiCount} pagos
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{fmtShortDate(mov.date)}</p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <div className="text-right mr-1">
          <MontoCell m={mov} className={`text-sm font-semibold ${mov.status === "pagado" ? "text-foreground" : "text-warning"}`} />
          <p className={`text-[10px] font-medium ${mov.status === "pagado" ? "text-success" : "text-warning"}`}>{statusLabel(mov.status)}</p>
        </div>
        {multi ? (
          <IconBtn onClick={onToggle} title="Ver pagos aplicados">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </IconBtn>
        ) : (
          <>
            <IconBtn onClick={() => onReceiptClick(mov)} disabled={mov.status !== "pagado"} title={mov.status !== "pagado" ? "Pago pendiente" : "Ver recibo"}>
              <FileText className="w-4 h-4" />
            </IconBtn>
            <IconBtn onClick={() => !isGenerating && mov.pagoId && onEyeClick(mov)} disabled={!mov.pagoId || mov.status !== "pagado" || isGenerating} title={mov.status !== "pagado" ? "Pago pendiente" : mov.pagoId ? "Generar recibo PDF" : "Sin recibo"}>
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            </IconBtn>
            <IconBtn onClick={() => hasCep && onCepClick(mov)} disabled={mov.status !== "pagado" || !hasCep} title={mov.status !== "pagado" ? "Pago pendiente" : mov.cepUrl ? "CEP electrónico" : hasCep ? "Comprobante de pago" : "Sin comprobante"}>
              <Receipt className="w-4 h-4" />
            </IconBtn>
          </>
        )}
      </div>
    </div>
  );
};

const AccountStatementView = ({ investment }: AccountStatementViewProps) => {
  const { property, financials } = investment;
  const status = getPropertyStatus(investment);
  const paymentPlan = usePaymentPlan(property.id);
  const [filterStatus, setFilterStatus] = useState<"todos" | "pagado" | "pendiente">("todos");
  const [filterYear, setFilterYear] = useState<string>("todos");
  const [toggledGroups, setToggledGroups] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [pdfModal, setPdfModal] = useState<PdfModal>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const toggleRow = (key: string) =>
    setExpandedRows(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const appCount = (m: Movement) => m.applications?.length ?? 0;

  useEffect(() => {
    if (!pdfModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPdfModal(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pdfModal]);

  const allMovements = useMemo(() => buildMovements(investment, paymentPlan), [investment, paymentPlan]);

  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    allMovements.forEach(m => { const match = m.date.match(/\b(20\d{2})\b/); if (match) yrs.add(match[1]); });
    return [...yrs].sort((a, b) => b.localeCompare(a));
  }, [allMovements]);

  const filtered = useMemo(() => {
    let r = allMovements;
    if (filterYear !== "todos") r = r.filter(m => m.date.includes(filterYear));
    if (filterStatus === "pagado") r = r.filter(m => m.status === "pagado");
    if (filterStatus === "pendiente") r = r.filter(m => m.status !== "pagado");
    return r;
  }, [allMovements, filterYear, filterStatus]);

  // Desktop table: flat, newest first
  const sortedForTable = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  const monthGroups = useMemo(() => groupByMonth(filtered), [filtered]);
  const nextInstallment = paymentPlan?.installments.find(i => i.status !== "pagado");
  const progressPct = Math.min(100, Math.round((financials.totalPaid / financials.initialPrice) * 100));

  const statusColorClass =
    status.color === "warning" ? "bg-warning/15 text-warning"
    : status.color === "success" ? "bg-success/15 text-success"
    : "bg-primary/15 text-primary";

  const isGroupExpanded = (key: string) => {
    const isFirst = monthGroups[0]?.sortKey === key;
    return isFirst ? !toggledGroups.has(key) : toggledGroups.has(key);
  };
  const toggleMonth = (key: string) =>
    setToggledGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleCopyCLABE = () => {
    if (paymentPlan?.stpInfo.clabe) {
      navigator.clipboard.writeText(paymentPlan.stpInfo.clabe);
      toast.success("CLABE copiada al portapapeles");
    }
  };

  const handleViewReceipt = (m: Movement) => {
    if (m.status !== "pagado") return;
    const receipt: ReceiptData = paymentPlan
      ? buildReceiptFromInstallment(paymentPlan.installments[m.sourceIndex], paymentPlan, investment)
      : buildReceiptFromPaymentRecord(investment.payments[m.sourceIndex], investment);
    setReceiptData(receipt);
  };

  function openPdf(url: string, m: Movement) {
    setPdfModal({ url, concept: m.concept, date: m.date, amount: m.amount });
  }

  const handleEyeClick = async (m: Movement) => {
    if (!m.pagoId || generatingId) return;
    setGeneratingId(m.pagoId);
    try {
      const res = await fetch(`${PROD_FUNCTIONS_BASE_URL}/generar-recibo-pago`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PROD_SUPABASE_ANON_KEY}`,
          "apikey": PROD_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ pagoId: m.pagoId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url_recibo) {
        console.error("Error generating receipt:", data);
        return;
      }
      setPdfModal({ url: data.url_recibo, concept: m.concept, date: m.date, amount: m.amount });
    } finally {
      setGeneratingId(null);
    }
  };

  // Sub-fila: un pago dispersado individual dentro de un concepto con varios pagos
  const AppRow = ({ app, concept }: { app: PaymentApplication; concept: string }) => {
    const isGenerating = generatingId === app.pagoId;
    const hasCep = !!(app.cepUrl || app.evidenceUrl);
    const synthetic = { concept, date: app.date, amount: app.amount, pagoId: app.pagoId } as Movement;
    return (
      <div className="flex items-center gap-2 py-2 pl-3 border-l-2 border-primary/20">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground truncate">
            {app.methodName ?? "Pago"} · <span className="tabular-nums">{fmt(app.amount)}</span>
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {app.dateDisplay}{app.trackingKey ? ` · Clave ${app.trackingKey}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <IconBtn onClick={() => !isGenerating && app.pagoId && handleEyeClick(synthetic)} disabled={!app.pagoId || isGenerating} title={app.pagoId ? "Generar recibo PDF" : "Sin recibo"}>
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          </IconBtn>
          <IconBtn onClick={() => { const url = app.cepUrl ?? app.evidenceUrl; if (url) openPdf(url, synthetic); }} disabled={!hasCep} title={app.cepUrl ? "CEP electrónico" : hasCep ? "Comprobante de pago" : "Sin comprobante"}>
            <Receipt className="w-4 h-4" />
          </IconBtn>
        </div>
      </div>
    );
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
    </div>
  );

  const summaryBlock = (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2 flex-nowrap">
        <img src={sozuLogo} alt="SOZU" className="h-3.5 w-auto object-contain dark:invert shrink-0" />
        <span className="text-muted-foreground text-xs shrink-0">-</span>
        <p className="text-xs font-semibold text-foreground truncate flex-1">Estado de Cuenta</p>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${statusColorClass}`}>{status.label}</span>
      </div>
      <div className="text-[11px] text-muted-foreground space-y-1 border-t border-border pt-3">
        <div className="flex justify-between">
          <span>Propiedad</span>
          <span className="font-semibold text-foreground">{property.projectName} - U-{property.unitNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Periodo</span>
          <span className="font-semibold text-foreground">{currentPeriod()}</span>
        </div>
      </div>
      <div className="space-y-2.5 border-t border-border pt-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Valor del Activo</span>
          <span className="font-display font-bold text-sm text-foreground tabular-nums">{fmt(financials.initialPrice)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Total Pagado</span>
          <span className="font-semibold text-sm text-primary tabular-nums">{fmt(financials.totalPaid)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Saldo Pendiente</span>
          <span className="font-semibold text-sm text-foreground tabular-nums">{fmt(financials.pendingBalance)}</span>
        </div>
        {nextInstallment && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Próxima Parcialidad</p>
            <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">{fmt(nextInstallment.amount)}</p>
            <p className="text-[11px] text-muted-foreground">Vence {nextInstallment.dueDateDisplay}</p>
          </div>
        )}
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

  const stpBlock = paymentPlan && (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="bg-primary/5 border-b border-border px-5 py-3">
        <h3 className="font-semibold text-xs text-foreground">Instrucciones de Pago</h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-2.5 text-[11px]">
          <div className="flex justify-between items-start gap-4">
            <span className="text-muted-foreground shrink-0">Banco Receptor</span>
            <span className="font-semibold text-foreground text-right">{paymentPlan.stpInfo.bankName}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-muted-foreground shrink-0">CLABE</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-semibold text-foreground text-xs">{paymentPlan.stpInfo.clabe}</span>
              <button onClick={handleCopyCLABE} className="p-1 rounded-md hover:bg-muted transition-colors">
                <Copy className="w-3 h-3 text-primary" />
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-muted-foreground shrink-0">Referencia</span>
            <span className="font-mono font-semibold text-foreground text-xs">{paymentPlan.stpInfo.reference}</span>
          </div>
        </div>
        <div className="border-t border-border pt-3 flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">CLABE vinculada exclusivamente a tu propiedad y RFC.</p>
        </div>
      </div>
    </div>
  );

  // ── Desktop movements table ──
  const desktopMovementsTable = (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
        <h3 className="font-display font-semibold text-sm text-foreground">Movimientos</h3>
        <span className="text-[11px] text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      {sortedForTable.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Sin movimientos con ese filtro</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/10 text-left">
                <th className="px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Fecha</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Concepto</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap">Monto</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Estatus</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {sortedForTable.map((mov) => {
                const multi = appCount(mov) > 1;
                const isExpanded = expandedRows.has(mov.rowKey);
                return (
                  <Fragment key={mov.rowKey}>
                    <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDate(mov.date)}</td>
                      <td className="px-3 py-3 text-[13px] font-medium text-foreground">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{mov.concept}</span>
                          {multi && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap shrink-0">
                              <Layers className="w-3 h-3" />{appCount(mov)} pagos
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-foreground"><div className="flex justify-end"><MontoCell m={mov} className="font-semibold" /></div></td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          mov.status === "pagado" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                        }`}>
                          {mov.status === "pagado" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {statusLabel(mov.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          {multi ? (
                            <IconBtn onClick={() => toggleRow(mov.rowKey)} title="Ver pagos aplicados">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </IconBtn>
                          ) : (
                            <>
                              <IconBtn onClick={() => handleViewReceipt(mov)} disabled={mov.status !== "pagado"} title={mov.status !== "pagado" ? "Pago pendiente" : "Ver recibo"}>
                                <FileText className="w-4 h-4" />
                              </IconBtn>
                              <IconBtn onClick={() => handleEyeClick(mov)} disabled={!mov.pagoId || mov.status !== "pagado" || generatingId === mov.pagoId} title={mov.status !== "pagado" ? "Pago pendiente" : mov.pagoId ? "Generar recibo PDF" : "Sin recibo"}>
                                {generatingId === mov.pagoId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                              </IconBtn>
                              <IconBtn onClick={() => { const url = mov.cepUrl ?? mov.evidenceUrl; if (url) openPdf(url, mov); }} disabled={mov.status !== "pagado" || (!mov.cepUrl && !mov.evidenceUrl)} title={mov.status !== "pagado" ? "Pago pendiente" : mov.cepUrl ? "CEP electrónico" : mov.evidenceUrl ? "Comprobante de pago" : "Sin comprobante"}>
                                <Receipt className="w-4 h-4" />
                              </IconBtn>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {multi && isExpanded && (
                      <tr className="bg-muted/10">
                        <td colSpan={5} className="px-5 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            {appCount(mov)} pagos aplicados a {mov.concept}
                          </p>
                          <div className="space-y-0.5">
                            {mov.applications!.map((app, ai) => <AppRow key={ai} app={app} concept={mov.concept} />)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground text-center py-3 border-t border-border">
        Estado de cuenta generado automáticamente por SOZU.
      </p>
    </div>
  );

  // ── Mobile movements (month groups) ──
  const mobileMovementsBlock = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm text-foreground">Movimientos</h3>
        <span className="text-[11px] text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-3">
        {monthGroups.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Sin movimientos con ese filtro</p>
          </div>
        ) : (
          monthGroups.map(group => (
            <div key={group.sortKey} className="bg-card rounded-xl border border-border overflow-hidden">
              <button onClick={() => toggleMonth(group.sortKey)} className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
                <span className="text-xs font-semibold text-foreground">{group.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {fmt(group.movements.filter(m => m.status === "pagado").reduce((s, m) => s + m.amount, 0))} pagado
                  </span>
                  {isGroupExpanded(group.sortKey) ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </button>
              {isGroupExpanded(group.sortKey) && (
                <div className="px-4">
                  {group.movements.map((mov) => {
                    const multi = appCount(mov) > 1;
                    const rowExpanded = expandedRows.has(mov.rowKey);
                    return (
                      <Fragment key={mov.rowKey}>
                        <MovementRow
                          mov={mov}
                          onReceiptClick={handleViewReceipt}
                          onEyeClick={handleEyeClick}
                          onCepClick={(m) => { const url = m.cepUrl ?? m.evidenceUrl; if (url) openPdf(url, m); }}
                          generatingId={generatingId}
                          multiCount={appCount(mov)}
                          expanded={rowExpanded}
                          onToggle={() => toggleRow(mov.rowKey)}
                        />
                        {multi && rowExpanded && (
                          <div className="pb-3 pl-10 space-y-0.5">
                            {mov.applications!.map((app, ai) => <AppRow key={ai} app={app} concept={mov.concept} />)}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-5">Estado de cuenta generado automáticamente por SOZU.</p>
    </div>
  );

  return (
    <div className="animate-fade-in pb-8">
      {/* Mobile */}
      <div className="md:hidden space-y-4 pb-6">
        {filterBar}
        {summaryBlock}
        {mobileMovementsBlock}
        {stpBlock}
      </div>

      {/* Desktop: 2-col */}
      <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_300px] md:gap-6 md:items-start">
        <div className="space-y-4 min-w-0">
          {filterBar}
          {desktopMovementsTable}
        </div>
        <div className="sticky top-20 space-y-4">
          {summaryBlock}
          {stpBlock}
        </div>
      </div>

      <PaymentReceiptModal receipt={receiptData} open={!!receiptData} onClose={() => setReceiptData(null)} />

      <DocViewerPortal
        open={!!pdfModal}
        onClose={() => setPdfModal(null)}
        url={pdfModal?.url ?? ""}
        title={pdfModal?.concept ?? ""}
        subtitle={pdfModal ? `${fmtDate(pdfModal.date)} · ${fmt(pdfModal.amount)}` : undefined}
        downloadFilename={pdfModal ? `SOZU-Recibo-${pdfModal.concept}-${pdfModal.date}.pdf` : undefined}
      />
    </div>
  );
};

export default AccountStatementView;
