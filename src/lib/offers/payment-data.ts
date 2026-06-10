// ── STP Payment types & mock data ──

import { create } from "zustand";
export type InstallmentStatus = "proximo" | "cercano" | "vencido" | "pagado";
export type PaymentConfirmationStatus = "recibido" | "validando" | "confirmado";

export interface Installment {
  id: string;
  number: number;
  amount: number;
  dueDate: string; // ISO date or display string
  dueDateDisplay: string;
  daysUntilDue: number; // negative = overdue
  status: InstallmentStatus;
  paidAt?: string;
  confirmationStatus?: PaymentConfirmationStatus;
  confirmationTimestamp?: string;
  constructionMilestone?: string;
}

export interface STPPaymentInfo {
  clabe: string;
  bankName: string;
  beneficiary: string;
  reference: string;
  propertyId: string;
  clientRFC: string;
}

export interface PropertyPaymentPlan {
  propertyId: string;
  totalInstallments: number;
  completedInstallments: number;
  installments: Installment[];
  stpInfo: STPPaymentInfo;
  // When ops confirms the construction completion + delivery date, the client
  // gets notified 30 days in advance to prepare the lump-sum liquidation.
  estimatedDeliveryDate?: string; // ISO "2026-08-15"
  accelerationNoticeDate?: string; // ISO "2026-07-16" (30 days before delivery)
}

// ── Badge config ──

export function getInstallmentBadge(status: InstallmentStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "pagado":
      return { label: "Pagado", className: "bg-primary/10 text-primary" };
    case "proximo":
      return { label: "Próximo", className: "bg-primary/10 text-primary" };
    case "cercano":
      return { label: "Cercano", className: "bg-warning/10 text-warning-foreground" };
    case "vencido":
      return { label: "Vencido", className: "bg-destructive/10 text-destructive" };
  }
}

// ── Mock payment plans ──

const DAIKU_MILESTONES: Record<number, string> = {
  1: "Cimentación",
  2: "Cimentación",
  3: "Estructura nivel 1",
  4: "Estructura nivel 2",
  5: "Estructura nivel 3",
  6: "Estructura nivel 4",
  7: "Estructura nivel 5",
  8: "Estructura nivel 6",
  9: "Estructura nivel 7",
  10: "Estructura nivel 8 y losa de azotea",
  11: "Estructura nivel 8 y losa de azotea",
  12: "Albañilería y muros divisorios",
  13: "Albañilería y muros divisorios",
  14: "Albañilería y muros divisorios",
  15: "Instalaciones (hidráulica, eléctrica, gas)",
  16: "Instalaciones (hidráulica, eléctrica, gas)",
  17: "Instalaciones (hidráulica, eléctrica, gas)",
  18: "Acabados (pisos, baños, cocina)",
  19: "Acabados (pisos, baños, cocina)",
  20: "Acabados (pisos, baños, cocina)",
  21: "Cancelería y herrería",
  22: "Cancelería y herrería",
  23: "Detalles finales y limpieza de entrega",
  24: "Detalles finales y limpieza de entrega",
};

function buildDaikuInstallments(): Installment[] {
  const installments: Installment[] = [];

  installments.push({
    id: "daiku-712-1",
    number: 1,
    amount: 1000000,
    dueDate: "2026-01-15",
    dueDateDisplay: "15 enero 2026",
    daysUntilDue: -116,
    status: "pagado",
    paidAt: "2026-01-14T18:32:00",
    confirmationStatus: "confirmado",
    confirmationTimestamp: "2026-01-14T19:45:00",
    constructionMilestone: DAIKU_MILESTONES[1],
  });

  installments.push({
    id: "daiku-712-2",
    number: 2,
    amount: 800000,
    dueDate: "2026-02-05",
    dueDateDisplay: "5 febrero 2026",
    daysUntilDue: -95,
    status: "pagado",
    paidAt: "2026-02-04T10:15:00",
    confirmationStatus: "confirmado",
    confirmationTimestamp: "2026-02-04T12:30:00",
    constructionMilestone: DAIKU_MILESTONES[2],
  });

  const months = [
    { num: 3, due: "2026-03-05", display: "5 marzo 2026", days: -67 },
    { num: 4, due: "2026-04-05", display: "5 abril 2026", days: -36 },
    { num: 5, due: "2026-05-05", display: "5 mayo 2026", days: -6 },
    { num: 6, due: "2026-06-05", display: "5 junio 2026", days: 25 },
    { num: 7, due: "2026-07-05", display: "5 julio 2026", days: 55 },
    { num: 8, due: "2026-08-05", display: "5 agosto 2026", days: 86 },
    { num: 9, due: "2026-09-05", display: "5 septiembre 2026", days: 117 },
    { num: 10, due: "2026-10-05", display: "5 octubre 2026", days: 147 },
    { num: 11, due: "2026-11-05", display: "5 noviembre 2026", days: 178 },
    { num: 12, due: "2026-12-05", display: "5 diciembre 2026", days: 208 },
    { num: 13, due: "2027-01-05", display: "5 enero 2027", days: 239 },
    { num: 14, due: "2027-02-05", display: "5 febrero 2027", days: 270 },
    { num: 15, due: "2027-03-05", display: "5 marzo 2027", days: 298 },
    { num: 16, due: "2027-04-05", display: "5 abril 2027", days: 329 },
    { num: 17, due: "2027-05-05", display: "5 mayo 2027", days: 359 },
    { num: 18, due: "2027-06-05", display: "5 junio 2027", days: 390 },
    { num: 19, due: "2027-07-05", display: "5 julio 2027", days: 420 },
    { num: 20, due: "2027-08-05", display: "5 agosto 2027", days: 451 },
    { num: 21, due: "2027-09-05", display: "5 septiembre 2027", days: 482 },
    { num: 22, due: "2027-10-05", display: "5 octubre 2027", days: 512 },
    { num: 23, due: "2027-11-05", display: "5 noviembre 2027", days: 543 },
    { num: 24, due: "2027-12-05", display: "5 diciembre 2027", days: 573 },
  ];

  for (const m of months) {
    const paid = m.num <= 4;
    const status: InstallmentStatus = paid
      ? "pagado"
      : m.num === 5
        ? "cercano"
        : "proximo";

    installments.push({
      id: `daiku-712-${m.num}`,
      number: m.num,
      amount: 181818,
      dueDate: m.due,
      dueDateDisplay: m.display,
      daysUntilDue: m.days,
      status,
      paidAt: paid ? `${m.due}T10:00:00` : undefined,
      confirmationStatus: paid ? "confirmado" : undefined,
      confirmationTimestamp: paid ? `${m.due}T12:00:00` : undefined,
      constructionMilestone: DAIKU_MILESTONES[m.num],
    });
  }

  return installments;
}

const initialPaymentPlans: PropertyPaymentPlan[] = [
  {
    propertyId: "daiku-712",
    totalInstallments: 24,
    completedInstallments: 4,
    installments: buildDaikuInstallments(),
    stpInfo: {
      clabe: "646180157000012345",
      bankName: "STP (Sistema de Transferencias y Pagos)",
      beneficiary: "SOZU Desarrollos S.A. de C.V.",
      reference: "DAIKU-712-PAROTA",
      propertyId: "daiku-712",
      clientRFC: "GARC900101ABC",
    },
    estimatedDeliveryDate: "2026-08-15",
    accelerationNoticeDate: "2026-07-16",
  },
  {
    propertyId: "bottura-709",
    totalInstallments: 12,
    completedInstallments: 2,
    installments: [
      {
        id: "bottura-709-1",
        number: 1,
        amount: 1000000,
        dueDate: "2025-10-15",
        dueDateDisplay: "15 octubre 2025",
        daysUntilDue: -129,
        status: "pagado",
        paidAt: "2025-10-14T14:20:00",
        confirmationStatus: "confirmado",
        confirmationTimestamp: "2025-10-14T16:00:00",
      },
      {
        id: "bottura-709-2",
        number: 2,
        amount: 800000,
        dueDate: "2026-01-15",
        dueDateDisplay: "15 enero 2026",
        daysUntilDue: -37,
        status: "pagado",
        paidAt: "2026-01-15T09:45:00",
        confirmationStatus: "confirmado",
        confirmationTimestamp: "2026-01-15T11:20:00",
      },
      {
        id: "bottura-709-3",
        number: 3,
        amount: 700000,
        dueDate: "2026-03-15",
        dueDateDisplay: "15 marzo 2026",
        daysUntilDue: 22,
        status: "proximo",
      },
    ],
    stpInfo: {
      clabe: "646180157000067890",
      bankName: "STP (Sistema de Transferencias y Pagos)",
      beneficiary: "SOZU Desarrollos S.A. de C.V.",
      reference: "BOTTURA-709",
      propertyId: "bottura-709",
      clientRFC: "GARC900101ABC",
    },
  },
];

interface PaymentState {
  plans: PropertyPaymentPlan[];
  simulateSTPDetection: (propertyId: string, installmentId: string) => void;
  submitCashPaymentReceipt: (propertyId: string, installmentId: string, fileName: string) => void;
  markInstallmentAsPaid: (propertyId: string, installmentId: string) => void;
  reset: () => void;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  plans: structuredClone(initialPaymentPlans),

  simulateSTPDetection: (propertyId, installmentId) => {
    const now = new Date().toISOString();
    set({
      plans: get().plans.map((plan) => {
        if (plan.propertyId !== propertyId) return plan;
        return {
          ...plan,
          installments: plan.installments.map((i) =>
            i.id === installmentId && i.status !== "pagado"
              ? { ...i, confirmationStatus: "validando", paidAt: now }
              : i,
          ),
        };
      }),
    });

    setTimeout(() => {
      const ts = new Date().toISOString();
      set({
        plans: get().plans.map((plan) => {
          if (plan.propertyId !== propertyId) return plan;
          let bumped = false;
          const installments = plan.installments.map((i) => {
            if (i.id === installmentId && i.status !== "pagado") {
              bumped = true;
              return {
                ...i,
                status: "pagado" as const,
                confirmationStatus: "confirmado" as const,
                confirmationTimestamp: ts,
              };
            }
            return i;
          });
          // Promote next "proximo" → "cercano"
          const nextIdx = installments.findIndex((i) => i.status === "proximo");
          if (nextIdx !== -1 && bumped) {
            installments[nextIdx] = { ...installments[nextIdx], status: "cercano" };
          }
          return {
            ...plan,
            installments,
            completedInstallments: bumped
              ? plan.completedInstallments + 1
              : plan.completedInstallments,
          };
        }),
      });
    }, 1500);
  },

  submitCashPaymentReceipt: (propertyId, installmentId) => {
    set({
      plans: get().plans.map((plan) => {
        if (plan.propertyId !== propertyId) return plan;
        return {
          ...plan,
          installments: plan.installments.map((i) =>
            i.id === installmentId && i.status !== "pagado"
              ? { ...i, confirmationStatus: "recibido" }
              : i,
          ),
        };
      }),
    });
  },

  markInstallmentAsPaid: (propertyId, installmentId) => {
    set({
      plans: get().plans.map((plan) => {
        if (plan.propertyId !== propertyId) return plan;
        let bumped = false;
        const installments = plan.installments.map((i) => {
          if (i.id === installmentId && i.status !== "pagado") {
            bumped = true;
            return {
              ...i,
              status: "pagado" as const,
              paidAt: new Date().toISOString(),
              confirmationStatus: "validando" as const,
            };
          }
          return i;
        });
        const nextIdx = installments.findIndex((i) => i.status === "proximo");
        if (nextIdx !== -1 && bumped) {
          installments[nextIdx] = { ...installments[nextIdx], status: "cercano" };
        }
        return {
          ...plan,
          installments,
          completedInstallments: bumped
            ? plan.completedInstallments + 1
            : plan.completedInstallments,
        };
      }),
    });
  },

  reset: () => set({ plans: structuredClone(initialPaymentPlans) }),
}));

/** @deprecated Use usePaymentStore.getState().plans for non-reactive reads. */
export const mockPaymentPlans: PropertyPaymentPlan[] = initialPaymentPlans;

export function getPaymentPlan(propertyId: string): PropertyPaymentPlan | undefined {
  return usePaymentStore.getState().plans.find((p) => p.propertyId === propertyId);
}

export function usePaymentPlan(propertyId: string): PropertyPaymentPlan | undefined {
  return usePaymentStore((s) => s.plans.find((p) => p.propertyId === propertyId));
}

export function getNextInstallment(plan: PropertyPaymentPlan): Installment | undefined {
  return plan.installments.find((i) => i.status !== "pagado");
}

export function getLastPaidInstallment(plan: PropertyPaymentPlan): Installment | undefined {
  const paid = plan.installments.filter((i) => i.status === "pagado");
  return paid[paid.length - 1];
}

export function getPlanProgress(plan: PropertyPaymentPlan): {
  paidCount: number;
  pendingCount: number;
  paidAmount: number;
  pendingAmount: number;
  progressPct: number;
} {
  const paid = plan.installments.filter((i) => i.status === "pagado");
  const pending = plan.installments.filter((i) => i.status !== "pagado");
  const paidAmount = paid.reduce((s, i) => s + i.amount, 0);
  const pendingAmount = pending.reduce((s, i) => s + i.amount, 0);
  const progressPct = (paid.length / plan.totalInstallments) * 100;
  return { paidCount: paid.length, pendingCount: pending.length, paidAmount, pendingAmount, progressPct };
}

/**
 * @deprecated Kept only to avoid breaking older imports.
 */
export function markInstallmentAsPaid(propertyId: string, installmentId: string): void {
  usePaymentStore.getState().markInstallmentAsPaid(propertyId, installmentId);
}

/**
 * Simulates STP webhook detecting an incoming SPEI transfer.
 * Demo: marks "validando" immediately, then "confirmado"+"pagado" after 1.5s.
 */
export function simulateSTPDetection(propertyId: string, installmentId: string): void {
  usePaymentStore.getState().simulateSTPDetection(propertyId, installmentId);
}

/**
 * Client uploaded their cash-deposit receipt from a bank window.
 */
export function submitCashPaymentReceipt(
  propertyId: string,
  installmentId: string,
  fileName: string,
): void {
  usePaymentStore.getState().submitCashPaymentReceipt(propertyId, installmentId, fileName);
}

// ── Acceleration clause (early liquidation) ──

export type AccelerationTier = "none" | "informative" | "urgent" | "critical";

export function getAccelerationState(plan: PropertyPaymentPlan): {
  tier: AccelerationTier;
  daysUntilDelivery: number | null;
  remainingBalance: number;
  remainingInstallmentsCount: number;
} {
  const remaining = plan.installments.filter((i) => i.status !== "pagado");
  const remainingBalance = remaining.reduce((s, i) => s + i.amount, 0);
  const remainingInstallmentsCount = remaining.length;

  if (!plan.accelerationNoticeDate || !plan.estimatedDeliveryDate) {
    return { tier: "none", daysUntilDelivery: null, remainingBalance, remainingInstallmentsCount };
  }

  const today = new Date();
  const noticeDate = new Date(plan.accelerationNoticeDate);
  const deliveryDate = new Date(plan.estimatedDeliveryDate);

  if (today < noticeDate) {
    return { tier: "none", daysUntilDelivery: null, remainingBalance, remainingInstallmentsCount };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / msPerDay);

  let tier: AccelerationTier;
  if (daysUntilDelivery > 15) tier = "informative";
  else if (daysUntilDelivery > 7) tier = "urgent";
  else tier = "critical";

  return { tier, daysUntilDelivery, remainingBalance, remainingInstallmentsCount };
}

export function formatDeliveryDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

// ── Collapsible installment timeline ──

export function getVisibleInstallments(plan: PropertyPaymentPlan): Installment[] {
  const sorted = [...plan.installments].sort((a, b) => a.number - b.number);

  const overdue = sorted.find((i) => i.status === "vencido");
  const nearest = sorted.find((i) => i.status === "cercano");
  const nearestNumber = nearest?.number ?? overdue?.number ?? 0;
  const upcoming = sorted
    .filter((i) => i.status === "proximo" && i.number > nearestNumber)
    .slice(0, 3);
  const recentPaid = sorted.filter((i) => i.status === "pagado").slice(-2);

  const visibleSet = new Set<string>();
  if (overdue) visibleSet.add(overdue.id);
  if (nearest) visibleSet.add(nearest.id);
  upcoming.forEach((i) => visibleSet.add(i.id));
  recentPaid.forEach((i) => visibleSet.add(i.id));

  // Fallback: if no nearest/overdue, surface first 3 proximos
  if (!overdue && !nearest) {
    sorted.filter((i) => i.status === "proximo").slice(0, 3).forEach((i) => visibleSet.add(i.id));
  }

  return sorted.filter((i) => visibleSet.has(i.id));
}
