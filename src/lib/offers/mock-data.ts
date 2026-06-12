// Re-export all types from the dedicated types module
export type {
  TransactionStage,
  StageStatus,
  StageInfo,
  PropertyData,
  FinancialData,
  MaintenanceData,
  PaymentRecord,
  AdditionalProduct,
  InvestmentProperty,
  SmartAlert,
} from "./types";

import type { InvestmentProperty, SmartAlert } from "./types";

// ── Portfolio Data ──

export const mockPortfolio: InvestmentProperty[] = [];


// ── Derived helpers ──

export function getPortfolioTotals(portfolio: InvestmentProperty[]) {
  const totalInvested = portfolio.reduce((s, p) => s + p.financials.initialPrice, 0);
  const totalPaid = portfolio.reduce((s, p) => s + p.financials.totalPaid, 0);
  const totalPending = portfolio.reduce((s, p) => s + p.financials.pendingBalance, 0);
  const totalCurrentValue = portfolio.reduce((s, p) => s + p.financials.currentEstimatedValue, 0);
  const appreciationPercent =
    totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;

  return { totalInvested, totalPaid, totalPending, totalCurrentValue, appreciationPercent, count: portfolio.length };
}

export function getSmartAlerts(portfolio: InvestmentProperty[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  portfolio.forEach((inv) => {
    const activeStage = inv.stages.find((s) => s.status === "active");
    if (!activeStage) return;

    if (activeStage.id === "pago_final") {
      alerts.push({
        id: `pay-${inv.property.id}`,
        type: "warning",
        icon: "⚠️",
        message: `${inv.property.projectName} ${inv.property.unitNumber} — Pago final pendiente`,
        propertyId: inv.property.id,
        priority: 1,
      });
    } else if (activeStage.id === "escrituracion") {
      alerts.push({
        id: `esc-${inv.property.id}`,
        type: "info",
        icon: "📅",
        message: `${inv.property.projectName} ${inv.property.unitNumber} — Escrituración próxima`,
        propertyId: inv.property.id,
        priority: 2,
      });
    } else if (activeStage.id === "preventa" && activeStage.contextMessage) {
      alerts.push({
        id: `pre-${inv.property.id}`,
        type: "info",
        icon: "📋",
        message: `${inv.property.projectName} ${inv.property.unitNumber} — ${activeStage.contextMessage}`,
        propertyId: inv.property.id,
        priority: 3,
      });
    } else if (activeStage.id === "post_entrega") {
      if (inv.maintenance && inv.maintenance.status === "pendiente") {
        alerts.push({
          id: `maint-${inv.property.id}`,
          type: "info",
          icon: "🏠",
          message: `${inv.property.projectName} ${inv.property.unitNumber} — Mantenimiento pendiente`,
          propertyId: inv.property.id,
          priority: 4,
        });
      }
    } else if (activeStage.id === "entrega") {
      alerts.push({
        id: `ent-${inv.property.id}`,
        type: "info",
        icon: "🏠",
        message: `${inv.property.projectName} ${inv.property.unitNumber} — ${activeStage.contextMessage || "Entrega próxima"}`,
        propertyId: inv.property.id,
        priority: 2,
      });
    }
  });

  return alerts.sort((a, b) => a.priority - b.priority);
}

export function getPropertyStatus(inv: InvestmentProperty): {
  label: string;
  color: "warning" | "primary" | "success" | "destructive";
} {
  const active = inv.stages.find((s) => s.status === "active");
  if (!active) return { label: "Completado", color: "success" };

  switch (active.id) {
    case "preventa":
      return { label: "En Preventa", color: "primary" };
    case "pago_final":
      return { label: "Pago Pendiente", color: "warning" };
    case "escrituracion":
      return { label: "En Escrituración", color: "primary" };
    case "entrega":
      return { label: "Por Entregar", color: "primary" };
    case "post_entrega":
      return { label: "Entregada", color: "success" };
    default:
      return { label: active.label, color: "primary" };
  }
}

// ── Property category (En adquisición vs Mi patrimonio) ──

export type PropertyCategory = "in_acquisition" | "active_patrimony" | "archived";

export const PROPERTY_CATEGORY_LABELS: Record<
  PropertyCategory,
  { title: string; description: string }
> = {
  in_acquisition: {
    title: "En adquisición",
    description: "Propiedades en proceso de compra",
  },
  active_patrimony: {
    title: "Mi patrimonio",
    description: "Propiedades entregadas que ya son tuyas",
  },
  archived: {
    title: "Archivadas",
    description: "Propiedades vendidas o liberadas",
  },
};

/**
 * Deriva la categoría conceptual a partir de las etapas existentes.
 * Una propiedad cuya etapa activa (o última completada) es `post_entrega`
 * pertenece al patrimonio activo. Todo lo demás está en adquisición.
 */
export function getPropertyCategory(inv: InvestmentProperty): PropertyCategory {
  const active = inv.stages.find((s) => s.status === "active");
  if (active?.id === "post_entrega") return "active_patrimony";
  if (!active) {
    // Todas completed → ya entregada
    const last = inv.stages[inv.stages.length - 1];
    if (last?.id === "post_entrega") return "active_patrimony";
  }
  return "in_acquisition";
}

export function filterPortfolioByCategory(
  portfolio: InvestmentProperty[],
  category: PropertyCategory,
): InvestmentProperty[] {
  return portfolio.filter((inv) => getPropertyCategory(inv) === category);
}

