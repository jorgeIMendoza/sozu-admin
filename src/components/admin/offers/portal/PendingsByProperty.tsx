import { ChevronRight } from "lucide-react";
import type { InvestmentProperty } from "@/lib/offers/mock-data";
import { fmtMXN as fmt } from "@/lib/utils";

interface PendingsByPropertyProps {
  portfolio: InvestmentProperty[];
  onSelect: (propertyId: string) => void;
}

interface PendingRow {
  propertyId: string;
  project: string;
  unit: string;
  type: string;
  dueDate: string;
  amount: number;
  urgency: "green" | "yellow" | "red";
}

function buildPendingRows(portfolio: InvestmentProperty[]): PendingRow[] {
  const rows: PendingRow[] = [];

  portfolio.forEach((inv) => {
    const activeStage = inv.stages.find((s) => s.status === "active");
    if (!activeStage || inv.financials.pendingBalance <= 0) return;

    let urgency: "green" | "yellow" | "red" = "green";
    let type = "Parcialidad";
    let dueDate = "Próximamente";

    if (activeStage.id === "pago_final") {
      type = "Pago final";
      urgency = "red";
      dueDate = activeStage.details?.["Fecha límite"] || dueDate;
    } else if (activeStage.id === "preventa") {
      type = "Mensualidad";
      urgency = "yellow";
      dueDate = activeStage.contextMessage?.replace("Tu próximo pago de parcialidad es en ", "En ") || dueDate;
    }

    rows.push({
      propertyId: inv.property.id,
      project: inv.property.projectName,
      unit: inv.property.unitNumber,
      type,
      dueDate,
      amount: inv.financials.pendingBalance,
      urgency,
    });
  });

  const urgencyOrder = { red: 0, yellow: 1, green: 2 };
  return rows.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

const urgencyDot: Record<string, string> = {
  red: "bg-destructive",
  yellow: "bg-warning",
  green: "bg-primary",
};

const PendingsByProperty = ({ portfolio, onSelect }: PendingsByPropertyProps) => {
  const rows = buildPendingRows(portfolio);

  if (rows.length === 0) return null;

  return (
    <section className="px-5 md:px-0 py-4 animate-fade-in" style={{ animationDelay: "0.15s" }}>
      <h2 className="font-display font-semibold text-sm text-foreground mb-3">
        Pendientes por propiedad
      </h2>
      <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {rows.map((row) => (
          <button
            key={row.propertyId}
            onClick={() => onSelect(row.propertyId)}
            className="w-full text-left px-4 py-3.5 flex items-center gap-3 transition-all active:bg-muted/50"
          >
            {/* Urgency dot */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${urgencyDot[row.urgency]}`} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-[13px] text-foreground">
                  {row.project}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  U-{row.unit}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">{row.type}</span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="text-[11px] text-muted-foreground">{row.dueDate}</span>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-display font-bold text-sm text-foreground tabular-nums">
                {fmt(row.amount)}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default PendingsByProperty;
