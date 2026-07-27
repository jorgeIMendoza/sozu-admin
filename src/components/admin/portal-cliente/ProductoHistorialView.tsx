import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2, Clock, ChevronDown, ChevronUp,
  Receipt,
} from "lucide-react";
import DocViewerPortal from "@/components/admin/portal-cliente/DocViewerPortal";
import type { ProductoCliente, AcuerdoProducto } from "@/hooks/useClienteProductos";
import { fmtMXN as fmt } from "@/lib/utils";

const sozuLogo = "/sozu-logo.png";
const MONTH_NAMES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const currentPeriod = () => { const d = new Date(); return `${MONTH_NAMES_FULL[d.getMonth()]} ${d.getFullYear()}`; };

const STATUS_LABEL: Record<ProductoCliente["status"], string> = {
  pendiente: "Pendiente",
  financiado: "En curso",
  pagado: "Pagado",
};
const STATUS_CLASS: Record<ProductoCliente["status"], string> = {
  pendiente: "bg-warning/15 text-warning",
  financiado: "bg-primary/15 text-primary",
  pagado: "bg-success/15 text-success",
};

interface Props {
  producto: ProductoCliente;
  proyectoNombre?: string;
  numPropiedad?: string;
}

interface Movement {
  id: number;
  date: string;       // fecha_pago si completado, else fecha_vencimiento
  displayDate: string;
  concept: string;
  amount: number;
  status: "pagado" | "pendiente";
  cepUrl?: string;
  trackingKey?: string;
}

interface MonthGroup {
  sortKey: string;
  label: string;
  movements: Movement[];
}

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function toMovement(a: AcuerdoProducto): Movement {
  const date = (a.completado && a.fechaPago) ? a.fechaPago : a.fecha;
  return {
    id: a.id,
    date,
    displayDate: new Date(date + "T12:00:00").toLocaleDateString("es-MX", {
      day: "numeric", month: "short", year: "numeric",
    }),
    concept: a.concepto,
    amount: a.monto,
    status: a.completado ? "pagado" : "pendiente",
    cepUrl: a.cepUrl,
    trackingKey: a.trackingKey,
  };
}

function groupByMonth(movements: Movement[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const m of movements) {
    const match = m.date.match(/^(\d{4})-(\d{2})/);
    if (!match) continue;
    const [, year, month] = match;
    const sortKey = `${year}-${month}`;
    const label = `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
    const g = map.get(sortKey);
    if (g) g.movements.push(m);
    else map.set(sortKey, { sortKey, label, movements: [m] });
  }
  return [...map.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(url);
}

type PdfModal = { url: string; concept: string; date: string; amount: number } | null;

const IconBtn = ({
  onClick, disabled, title, children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded-lg transition-colors ${
      !disabled
        ? "hover:bg-muted text-muted-foreground hover:text-primary"
        : "text-muted-foreground/25 cursor-not-allowed"
    }`}
  >
    {children}
  </button>
);

const MobileRow = ({
  m,
  onCep,
}: {
  m: Movement;
  onCep: (m: Movement) => void;
}) => (
  <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
    <div
      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
        m.status === "pagado" ? "bg-success/10" : "bg-warning/10"
      }`}
    >
      {m.status === "pagado"
        ? <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        : <Clock className="w-3.5 h-3.5 text-warning" />}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-foreground">{m.concept}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-[11px] text-muted-foreground">{m.displayDate}</span>
        {m.trackingKey && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
            {m.trackingKey.slice(-6)}
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-0.5 shrink-0">
      <div className="text-right mr-1">
        <p className={`text-sm font-semibold tabular-nums ${m.status === "pagado" ? "text-foreground" : "text-warning"}`}>
          {fmt(m.amount)}
        </p>
        <p className={`text-[10px] font-medium ${m.status === "pagado" ? "text-success" : "text-warning"}`}>
          {m.status === "pagado" ? "Pagado" : "Pendiente"}
        </p>
      </div>
      <IconBtn
        onClick={() => m.cepUrl && onCep(m)}
        disabled={!m.cepUrl || m.status !== "pagado"}
        title={m.cepUrl ? "Ver CEP" : "Sin comprobante"}
      >
        <Receipt className="w-4 h-4" />
      </IconBtn>
    </div>
  </div>
);

const ProductoHistorialView = ({ producto, proyectoNombre, numPropiedad }: Props) => {
  const [filterYear, setFilterYear] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<"todos" | "pagado" | "pendiente">("todos");
  const [toggledGroups, setToggledGroups] = useState<Set<string>>(new Set());
  const [pdfModal, setPdfModal] = useState<PdfModal>(null);

  useEffect(() => {
    if (!pdfModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPdfModal(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pdfModal]);

  const allMovements = useMemo<Movement[]>(
    () => producto.acuerdos.map(toMovement),
    [producto],
  );

  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    allMovements.forEach((m) => { const match = m.date.match(/^(\d{4})/); if (match) yrs.add(match[1]); });
    return [...yrs].sort((a, b) => b.localeCompare(a));
  }, [allMovements]);

  const filtered = useMemo(() => {
    let r = allMovements;
    if (filterYear !== "todos") r = r.filter((m) => m.date.startsWith(filterYear));
    if (filterStatus !== "todos") r = r.filter((m) => m.status === filterStatus);
    return r;
  }, [allMovements, filterYear, filterStatus]);

  const sortedForTable = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );
  const monthGroups = useMemo(() => groupByMonth(filtered), [filtered]);

  const paidMovements = allMovements.filter((m) => m.status === "pagado");
  const totalPagado = paidMovements.reduce((s, m) => s + m.amount, 0);
  const lastPaid = [...paidMovements].sort((a, b) => b.date.localeCompare(a.date))[0];
  const progressPct = producto.precioFinal > 0
    ? Math.min(100, Math.round((producto.totalPagado / producto.precioFinal) * 100))
    : 0;

  const isGroupExpanded = (key: string) => {
    const isFirst = monthGroups[0]?.sortKey === key;
    return isFirst ? !toggledGroups.has(key) : toggledGroups.has(key);
  };
  const toggleMonth = (key: string) =>
    setToggledGroups((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  function openPdf(m: Movement) {
    if (m.cepUrl) setPdfModal({ url: m.cepUrl, concept: m.concept, date: m.displayDate, amount: m.amount });
  }

  async function downloadPdf(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);
    } catch {
      window.open(url, "_blank");
    }
  }

  // ── Filter bar ───────────────────────────────────────────────────
  const filterBar = (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Período</p>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterYear("todos")}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${filterYear === "todos" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}
          >
            Todos
          </button>
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setFilterYear(y)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${filterYear === y ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap border-t border-border pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Estatus</p>
        <div className="flex gap-1.5 flex-wrap">
          {(["todos", "pagado", "pendiente"] as const).map((val) => (
            <button
              key={val}
              onClick={() => setFilterStatus(val)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${filterStatus === val ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}
            >
              {val === "todos" ? "Todos" : val === "pagado" ? "Pagados" : "Pendientes"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const nextPendiente = producto.acuerdos.find((a) => !a.completado);

  // ── Summary card ─────────────────────────────────────────────────
  const summaryBlock = (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2 flex-nowrap">
        <img src={sozuLogo} alt="SOZU" className="h-3.5 w-auto object-contain dark:invert shrink-0" />
        <span className="text-muted-foreground text-xs shrink-0">-</span>
        <p className="text-xs font-semibold text-foreground truncate flex-1">Producto Adicional</p>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${STATUS_CLASS[producto.status]}`}>
          {STATUS_LABEL[producto.status]}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground space-y-1 border-t border-border pt-3">
        <div className="flex justify-between gap-4">
          <span className="shrink-0">Producto</span>
          <span className="font-semibold text-foreground text-right truncate">{producto.nombre}</span>
        </div>
        {proyectoNombre && (
          <div className="flex justify-between gap-4">
            <span className="shrink-0">Propiedad</span>
            <span className="font-semibold text-foreground text-right">{proyectoNombre}{numPropiedad ? ` · U-${numPropiedad}` : ""}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Periodo</span>
          <span className="font-semibold text-foreground">{currentPeriod()}</span>
        </div>
      </div>
      <div className="space-y-2.5 border-t border-border pt-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Valor del Activo</span>
          <span className="font-display font-bold text-sm text-foreground tabular-nums">{fmt(producto.precioFinal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Total Pagado</span>
          <span className="font-semibold text-sm text-primary tabular-nums">{fmt(producto.totalPagado)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Saldo Pendiente</span>
          <span className="font-semibold text-sm text-foreground tabular-nums">{fmt(producto.saldoPendiente)}</span>
        </div>
        {nextPendiente && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Próximo Pago</p>
            <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">{fmt(nextPendiente.monto)}</p>
            <p className="text-[11px] text-muted-foreground">
              Vence {new Date(nextPendiente.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-border pt-3">
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-muted-foreground">Progreso</span>
          <span className="font-semibold text-foreground tabular-nums">{progressPct}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressPct === 100 ? "bg-success" : "bg-primary"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      {producto.clabe && (
        <div className="border-t border-border pt-3 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">CLABE STP</p>
          <p className="text-[11px] font-mono text-foreground">{producto.clabe}</p>
        </div>
      )}
    </div>
  );

  // ── Desktop table ────────────────────────────────────────────────
  const desktopTable = (
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
                <th className="px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">CEP</th>
              </tr>
            </thead>
            <tbody>
              {sortedForTable.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{m.displayDate}</td>
                  <td className="px-3 py-3 text-[13px] font-medium text-foreground">{m.concept}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-[13px] text-foreground">{fmt(m.amount)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                      m.status === "pagado" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}>
                      {m.status === "pagado"
                        ? <CheckCircle2 className="w-3 h-3" />
                        : <Clock className="w-3 h-3" />}
                      {m.status === "pagado" ? "Pagado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {m.cepUrl && m.status === "pagado" ? (
                      <IconBtn onClick={() => openPdf(m)} title="Ver CEP">
                        <Receipt className="w-4 h-4" />
                      </IconBtn>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/40">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Mobile month groups ──────────────────────────────────────────
  const mobileBlock = (
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
        ) : monthGroups.map((group) => (
          <div key={group.sortKey} className="bg-card rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => toggleMonth(group.sortKey)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <span className="text-xs font-semibold text-foreground">{group.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {group.movements.filter(m => m.status === "pagado").length} pagado{group.movements.filter(m => m.status === "pagado").length !== 1 ? "s" : ""}
                </span>
                {isGroupExpanded(group.sortKey)
                  ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </button>
            {isGroupExpanded(group.sortKey) && (
              <div className="px-4">
                {group.movements.map((m) => <MobileRow key={m.id} m={m} onCep={openPdf} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in pb-8">
      {/* Mobile */}
      <div className="md:hidden space-y-4 pb-6">
        {filterBar}
        {summaryBlock}
        {mobileBlock}
      </div>

      {/* Desktop: 2-col */}
      <div className="hidden md:grid md:grid-cols-[1fr_280px] md:gap-6 md:items-start">
        <div className="space-y-4">
          {filterBar}
          {desktopTable}
        </div>
        <div className="sticky top-20 space-y-4">
          {summaryBlock}
        </div>
      </div>

      <DocViewerPortal
        open={!!pdfModal}
        onClose={() => setPdfModal(null)}
        url={pdfModal?.url ?? ""}
        title={pdfModal?.concept ?? ""}
        subtitle={pdfModal ? `${pdfModal.date} · ${fmt(pdfModal.amount)}` : undefined}
        downloadFilename={pdfModal ? `CEP-${pdfModal.concept}-${pdfModal.date}.pdf` : undefined}
      />
    </div>
  );
};

export default ProductoHistorialView;
