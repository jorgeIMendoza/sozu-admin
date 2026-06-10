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

export const mockPortfolio: InvestmentProperty[] = [
  {
    property: {
      id: "margot-707",
      projectName: "Margot",
      unitNumber: "707",
      location: "Av de Las Rosas 1297, Chapalita, 44500 Guadalajara, Jal.",
      address: "Av. Chapalita 1234, Guadalajara, Jalisco",
      type: "Departamento",
      area: "78.0 m²",
      floor: "7",
      bedrooms: 2,
      bathrooms: 2,
      deliveryDate: "Entregada",
      imageGradient: "from-success/20 via-success/10 to-accent",
    },
    financials: {
      initialPrice: 3200000,
      totalPaid: 3200000,
      pendingBalance: 0,
      estimatedAppreciation: 22.5,
      currentEstimatedValue: 3920000,
      pricePerM2Initial: 41025,
      pricePerM2Current: 50256,
      currency: "MXN",
    },
    stages: [
      {
        id: "preventa",
        label: "Preventa",
        description: "Completado",
        status: "completed",
      },
      {
        id: "pago_final",
        label: "Pago Final",
        description: "Completado",
        status: "completed",
      },
      {
        id: "escrituracion",
        label: "Escrituración",
        description: "Completado",
        status: "completed",
      },
      {
        id: "entrega",
        label: "Entrega",
        description: "Entregado al cliente",
        status: "completed",
      },
      {
        id: "post_entrega",
        label: "Post-Entrega",
        description: "Propiedad entregada y escriturada",
        status: "active",
        cta: { label: "Habilitar reventa", action: "resale" },
        contextMessage: "Lista para reventa",
        details: {
          Reventa: "Disponible",
          "Cuota mantenimiento": "$4,500 MXN/mes",
          "Estado mantenimiento": "Al corriente",
        },
      },
    ],
    payments: [],
    maintenance: {
      monthlyFee: 4500,
      nextDueDate: "5 Marzo 2026",
      status: "pendiente",
      history: [
        { month: "Enero 2026", amount: 4500, status: "pagado" },
        { month: "Febrero 2026", amount: 4500, status: "pagado" },
      ],
    },
    additionalProducts: [
      {
        id: "muebles-margot",
        name: "Paquete de muebles",
        totalPrice: 180000,
        totalPaid: 180000,
        pendingBalance: 0,
        status: "entregado",
        estimatedDelivery: "Entregado",
        documents: [
          { name: "Carta acuerdo", status: "disponible" },
          { name: "Factura", status: "disponible" },
        ],
      },
      {
        id: "condensadora-margot",
        name: "Condensadora",
        totalPrice: 45000,
        totalPaid: 45000,
        pendingBalance: 0,
        status: "entregado",
        estimatedDelivery: "Entregado",
        documents: [
          { name: "Carta acuerdo", status: "disponible" },
        ],
      },
    ],
  },
  {
    property: {
      id: "bottura-709",
      projectName: "Bottura",
      unitNumber: "709",
      location: "C. Manuel López Cotilla 2185, Arcos Vallarta, 44600 Guadalajara, Jal.",
      type: "Departamento",
      area: "62.0 m²",
      floor: "7",
      bedrooms: 1,
      bathrooms: 1,
      deliveryDate: "Mayo 2026",
      imageGradient: "from-warning/20 via-warning/10 to-accent",
    },
    financials: {
      initialPrice: 2500000,
      totalPaid: 1800000,
      pendingBalance: 700000,
      estimatedAppreciation: 17.3,
      currentEstimatedValue: 2932500,
      pricePerM2Initial: 40322,
      pricePerM2Current: 47298,
      currency: "MXN",
    },
    stages: [
      {
        id: "preventa",
        label: "Preventa",
        description: "Completado",
        status: "completed",
      },
      {
        id: "pago_final",
        label: "Pago Final",
        description: "Liquidación del saldo pendiente",
        status: "active",
        cta: { label: "Pagar ahora", action: "balance" },
        contextMessage: "Estás a 12 días de tu escrituración. Realiza tu pago final para continuar.",
        details: {
          "Saldo pendiente": "$700,000 MXN",
          "Fecha límite": "Abril 2026",
        },
      },
      {
        id: "escrituracion",
        label: "Escrituración",
        description: "Pendiente",
        status: "pending",
      },
      {
        id: "entrega",
        label: "Entrega",
        description: "Pendiente",
        status: "pending",
      },
      {
        id: "post_entrega",
        label: "Post-Entrega",
        description: "Pendiente",
        status: "pending",
      },
    ],
    payments: [
      { date: "Oct 2025", concept: "Enganche", amount: 1000000, status: "pagado" },
      { date: "Ene 2026", concept: "Abono", amount: 800000, status: "pagado" },
    ],
    additionalProducts: [
      {
        id: "muebles-bottura",
        name: "Paquete de muebles",
        totalPrice: 220000,
        totalPaid: 110000,
        pendingBalance: 110000,
        status: "financiado",
        financingPlan: "3 mensualidades sin intereses",
        nextDueDate: "15 Marzo 2026",
        nextDueAmount: 55000,
        estimatedDelivery: "Mayo 2026",
        documents: [
          { name: "Carta acuerdo", status: "disponible" },
          { name: "Contrato financiamiento", status: "disponible" },
        ],
      },
      {
        id: "bodega-bottura",
        name: "Bodega B-12",
        totalPrice: 150000,
        totalPaid: 0,
        pendingBalance: 150000,
        status: "pendiente",
        estimatedDelivery: "Mayo 2026",
        documents: [
          { name: "Carta acuerdo", status: "pendiente" },
        ],
      },
      {
        id: "cajon-bottura",
        name: "Cajón adicional E-3",
        totalPrice: 280000,
        totalPaid: 280000,
        pendingBalance: 0,
        status: "pagado",
        estimatedDelivery: "Mayo 2026",
        documents: [
          { name: "Carta acuerdo", status: "disponible" },
          { name: "Contrato específico", status: "disponible" },
        ],
      },
    ],
  },
  {
    property: {
      id: "daiku-712",
      projectName: "Daiku",
      unitNumber: "712",
      location: "Av. Miguel Hidalgo y Costilla 1910, Arcos Vallarta, 44130 Guadalajara, Jal.",
      type: "Departamento",
      area: "72.74 m²",
      floor: "7",
      bedrooms: 2,
      bathrooms: 2,
      deliveryDate: "Diciembre 2027",
      imageGradient: "from-primary/20 via-primary/10 to-accent",
    },
    financials: {
      initialPrice: 5800000,
      totalPaid: 1800000,
      pendingBalance: 4000000,
      estimatedAppreciation: 9.7,
      currentEstimatedValue: 6362600,
      pricePerM2Initial: 61052,
      pricePerM2Current: 66974,
      currency: "MXN",
    },
    stages: [
      {
        id: "preventa",
        label: "Preventa",
        description: "Plan de pagos activado",
        status: "active",
        contextMessage: "Tu próximo pago de parcialidad es en 9 días.",
        details: {
          "Fecha de inicio": "Enero 2026",
          "Enganche pagado": "$1,000,000 MXN",
        },
      },
      {
        id: "pago_final",
        label: "Pago Final",
        description: "Pendiente",
        status: "pending",
      },
      {
        id: "escrituracion",
        label: "Escrituración",
        description: "Pendiente",
        status: "pending",
      },
      {
        id: "entrega",
        label: "Entrega",
        description: "Pendiente",
        status: "pending",
      },
      {
        id: "post_entrega",
        label: "Post-Entrega",
        description: "Pendiente",
        status: "pending",
      },
    ],
    payments: [
      { date: "Ene 2026", concept: "Enganche", amount: 1000000, status: "pagado" },
      { date: "Feb 2026", concept: "Mensualidad 1", amount: 800000, status: "pagado" },
    ],
    additionalProducts: [
      {
        id: "bodega-daiku",
        name: "Bodega",
        totalPrice: 120000,
        totalPaid: 60000,
        pendingBalance: 60000,
        status: "financiado",
        financingPlan: "6 mensualidades de $10,000",
        nextDueDate: "15 Marzo 2026",
        nextDueAmount: 10000,
        estimatedDelivery: "Diciembre 2027",
        documents: [
          { name: "Carta acuerdo bodega", status: "disponible" },
        ],
      },
      {
        id: "cajon-daiku",
        name: "Cajón de estacionamiento adicional",
        totalPrice: 350000,
        totalPaid: 0,
        pendingBalance: 350000,
        status: "pendiente",
        documents: [
          { name: "Cotización", status: "disponible" },
        ],
      },
    ],
  },
  {
    property: {
      id: "bottura-812",
      projectName: "Bottura",
      unitNumber: "812",
      location: "C. Manuel López Cotilla 2185, Arcos Vallarta, 44600 Guadalajara, Jal.",
      type: "Departamento",
      area: "75.0 m²",
      floor: "8",
      bedrooms: 2,
      bathrooms: 2,
      deliveryDate: "Junio 2026",
      imageGradient: "from-primary/20 via-primary/10 to-accent",
    },
    financials: {
      initialPrice: 2800000,
      totalPaid: 2800000,
      pendingBalance: 0,
      estimatedAppreciation: 19.2,
      currentEstimatedValue: 3337600,
      pricePerM2Initial: 37333,
      pricePerM2Current: 44501,
      currency: "MXN",
    },
    stages: [
      {
        id: "preventa",
        label: "Preventa",
        description: "Completado",
        status: "completed",
      },
      {
        id: "pago_final",
        label: "Pago Final",
        description: "Completado",
        status: "completed",
      },
      {
        id: "escrituracion",
        label: "Escrituración",
        description: "En proceso de escrituración",
        status: "active",
        cta: { label: "Ver proceso", action: "escrituracion" },
        contextMessage: "Tu unidad está lista para formalizarse ante notario.",
        details: {
          "Notaría": "Notaría 45 de Guadalajara",
          "Notario": "Lic. Roberto Méndez Castellanos",
          "Estado": "Proyecto de escritura disponible",
        },
      },
      {
        id: "entrega",
        label: "Entrega",
        description: "Pendiente",
        status: "pending",
      },
      {
        id: "post_entrega",
        label: "Post-Entrega",
        description: "Pendiente",
        status: "pending",
      },
    ],
    payments: [
      { date: "Sep 2025", concept: "Enganche", amount: 1200000, status: "pagado" },
      { date: "Nov 2025", concept: "Abono", amount: 800000, status: "pagado" },
      { date: "Ene 2026", concept: "Liquidación", amount: 800000, status: "pagado" },
    ],
    additionalProducts: [],
  },
  {
    property: {
      id: "bottura-915",
      projectName: "Bottura",
      unitNumber: "915",
      location: "C. Manuel López Cotilla 2185, Arcos Vallarta, 44600 Guadalajara, Jal.",
      type: "Departamento",
      area: "68.0 m²",
      floor: "9",
      bedrooms: 2,
      bathrooms: 2,
      deliveryDate: "Marzo 2026",
      imageGradient: "from-primary/20 via-primary/10 to-accent",
    },
    financials: {
      initialPrice: 2650000,
      totalPaid: 2650000,
      pendingBalance: 0,
      estimatedAppreciation: 18.5,
      currentEstimatedValue: 3140250,
      pricePerM2Initial: 38970,
      pricePerM2Current: 46180,
      currency: "MXN",
    },
    stages: [
      {
        id: "preventa",
        label: "Preventa",
        description: "Completado",
        status: "completed",
      },
      {
        id: "pago_final",
        label: "Pago Final",
        description: "Completado",
        status: "completed",
      },
      {
        id: "escrituracion",
        label: "Escrituración",
        description: "Completado",
        status: "completed",
      },
      {
        id: "entrega",
        label: "Entrega",
        description: "Agenda y recibe tu unidad",
        status: "active",
        cta: { label: "Ver proceso", action: "entrega" },
        contextMessage: "Tu unidad está lista para entrega. Agenda tu cita.",
        details: {
          "Responsable": "Arq. Carolina Vega",
          "Contacto": "+52 33 1234 5678",
          "Estado": "Lista para entrega",
        },
      },
      {
        id: "post_entrega",
        label: "Post-Entrega",
        description: "Pendiente",
        status: "pending",
      },
    ],
    payments: [
      { date: "Ago 2025", concept: "Enganche", amount: 1100000, status: "pagado" },
      { date: "Oct 2025", concept: "Abono", amount: 750000, status: "pagado" },
      { date: "Dic 2025", concept: "Liquidación", amount: 800000, status: "pagado" },
    ],
    additionalProducts: [],
  },
];

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

// Backward compat exports
export const mockProperty = mockPortfolio[0].property;
export const mockFinancials = mockPortfolio[0].financials;
export const mockStages = mockPortfolio[0].stages;
export const mockPayments = mockPortfolio[0].payments;
