import { AlertTriangle, CheckCircle2, CreditCard, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import { getPropertyCategory } from "@/lib/portal-cliente/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";

interface PendingItem {
  propertyId: string;
  projectName: string;
  unitNumber: string;
  type: string;
  amount: number;
  dueDate: string;
  urgency: "urgent" | "upcoming" | "future";
  category: "in_acquisition" | "active_patrimony" | "archived";
}

interface ActivitySectionProps {
  portfolio: InvestmentProperty[];
  onPayNow: (propertyId: string) => void;
}

function getPendingItems(portfolio: InvestmentProperty[]): PendingItem[] {
  const items: PendingItem[] = [];

  portfolio.forEach((inv) => {
    const category = getPropertyCategory(inv);
    const base = {
      propertyId: inv.property.id,
      projectName: inv.property.projectName,
      unitNumber: inv.property.unitNumber,
      category,
    };
    const activeStage = inv.stages.find((s) => s.status === "active");
    if (activeStage) {
      if (activeStage.id === "pago_final" && inv.financials.pendingBalance > 0) {
        items.push({
          ...base,
          type: "Pago final",
          amount: inv.financials.pendingBalance,
          dueDate: activeStage.details?.["Fecha límite"] || "Próximamente",
          urgency: "urgent",
        });
      } else if (activeStage.id === "preventa" && inv.financials.pendingBalance > 0) {
        items.push({
          ...base,
          type: "Parcialidad",
          amount: inv.financials.pendingBalance,
          dueDate: activeStage.contextMessage || "Próximamente",
          urgency: "upcoming",
        });
      } else if (activeStage.id === "escrituracion") {
        items.push({
          ...base,
          type: "Escrituración",
          amount: 0,
          dueDate: activeStage.contextMessage || "En proceso de escrituración",
          urgency: "upcoming",
        });
      } else if (activeStage.id === "entrega") {
        items.push({
          ...base,
          type: "Entrega",
          amount: 0,
          dueDate: activeStage.contextMessage || "Agenda tu cita de entrega",
          urgency: "upcoming",
        });
      }
    }

    if (inv.maintenance && inv.maintenance.status === "pendiente") {
      items.push({
        ...base,
        type: "Mantenimiento",
        amount: inv.maintenance.monthlyFee,
        dueDate: inv.maintenance.nextDueDate,
        urgency: "future",
      });
    }
  });

  const urgencyOrder = { urgent: 0, upcoming: 1, future: 2 };
  return items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

const badgeStyles: Record<string, string> = {
  "Pago final": "bg-destructive/10 text-destructive",
  "Parcialidad": "bg-warning/10 text-warning",
  "Mantenimiento": "bg-primary/10 text-primary",
  "Escrituración": "bg-primary/10 text-primary",
  "Entrega": "bg-primary/10 text-primary",
};

const urgencyStyles = {
  urgent: {
    border: "border-l-destructive",
  },
  upcoming: {
    border: "border-l-warning",
  },
  future: {
    border: "border-l-primary",
  },
};

const MAX_VISIBLE = 3;

const ActivitySection = ({ portfolio, onPayNow }: ActivitySectionProps) => {
  const navigate = useNavigate();
  const allItems = getPendingItems(portfolio);
  const visibleItems = allItems.slice(0, MAX_VISIBLE);
  const hasMore = allItems.length > MAX_VISIBLE;
  const hasPending = allItems.length > 0;

  // Context message for "al día" state
  const nextPaymentDate = portfolio
    .flatMap((inv) => inv.stages.filter((s) => s.status === "active"))
    .find((s) => s.contextMessage)?.contextMessage;

  return (
    <section className="px-5 md:px-0 pt-6 pb-2 animate-fade-in">
      <h2 className="font-display font-semibold text-[15px] text-foreground mb-3">
        Tu actividad
      </h2>

      {hasPending ? (
        <div className="space-y-3">
          {/* Summary banner */}
          <div className="flex items-center gap-3 bg-warning/8 rounded-2xl px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm text-foreground">
                Tienes {allItems.length} pendiente{allItems.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revisa y liquida tus pagos
              </p>
            </div>
          </div>

          {/* Pending items — max 3 */}
          {visibleItems.map((item, i) => {
            const styles = urgencyStyles[item.urgency];
            const badge = badgeStyles[item.type] || "bg-muted text-muted-foreground";
            const hasAmount = item.amount > 0;
            return (
              <button
                key={`${item.propertyId}-${item.type}-${i}`}
                onClick={() => onPayNow(item.propertyId)}
                className={`w-full text-left bg-card rounded-2xl border border-border border-l-[3px] ${styles.border} p-4 transition-all active:scale-[0.98]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-display font-semibold text-sm text-foreground">
                        {item.projectName} {item.unitNumber}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge}`}>
                        {item.type}
                      </span>
                      <span
                        className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${
                          item.category === "active_patrimony"
                            ? "border-success/30 text-success bg-success/5"
                            : "border-border text-muted-foreground bg-muted/40"
                        }`}
                      >
                        {item.category === "active_patrimony" ? "Patrimonio" : "En adquisición"}
                      </span>
                    </div>
                    {item.dueDate && <p className="text-xs text-muted-foreground leading-relaxed">{item.dueDate}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {hasAmount ? (
                      <>
                        <p className="font-display font-bold text-base text-foreground tabular-nums">
                          {fmt(item.amount)}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-primary">
                          <CreditCard className="w-3 h-3" />
                          <span className="text-[11px] font-semibold">Pagar</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1 mt-1 text-primary">
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-semibold">Ver</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* "Ver todo" button when there are more than 3 */}
          {hasMore && (
            <button
              onClick={() => navigate("/admin/portal-cliente/en-adquisicion")}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-medium text-primary hover:bg-primary/5 transition-colors border border-dashed border-primary/30"
            >
              Ver {allItems.length - MAX_VISIBLE} más
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="font-display font-semibold text-sm text-foreground">
              Estás al día
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {nextPaymentDate || "Sin pagos pendientes"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default ActivitySection;
