// ── Mantenimiento: tipos, datos mock e helpers ──
// Cuotas mensuales de mantenimiento para propiedades entregadas.
// Estructura paralela a payment-data.ts pero específica para post-entrega.

import { create } from "zustand";

export type MaintenanceChargeStatus = "pagado" | "proximo" | "pendiente" | "vencido";

export interface MaintenanceCharge {
  id: string;
  month: string;
  monthKey: string;
  year: number;
  dueDate: string;
  dueDateDisplay: string;
  amount: number;
  status: MaintenanceChargeStatus;
  daysUntilDue: number;
  paidAt?: string;
  paidAtDisplay?: string;
  paymentMethod?: "transferencia" | "ventanilla";
  referenceSTP?: string;
}

export interface MaintenancePaymentInfo {
  clabe: string;
  bankName: string;
  beneficiary: string;
  referencePrefix: string;
}

export interface MaintenanceAccount {
  propertyId: string;
  projectName: string;
  monthlyFee: number;
  startedAt: string;
  charges: MaintenanceCharge[];
  paymentInfo: MaintenancePaymentInfo;
}

const initialMaintenanceStore: Record<string, MaintenanceAccount> = {
  "margot-707": {
    propertyId: "margot-707",
    projectName: "Margot",
    monthlyFee: 4500,
    startedAt: "2026-01-01",
    paymentInfo: {
      clabe: "646180157000098765",
      bankName: "STP (Sistema de Transferencias y Pagos)",
      beneficiary: "Administración Margot S.A. de C.V.",
      referencePrefix: "MARGOT-707-MANT",
    },
    charges: [
      { id: "margot-707-mant-2026-01", month: "Enero 2026", monthKey: "2026-01", year: 2026, dueDate: "2026-01-05", dueDateDisplay: "5 enero 2026", amount: 4500, status: "pagado", daysUntilDue: -126, paidAt: "2026-01-04T10:30:00", paidAtDisplay: "4 enero 2026", paymentMethod: "transferencia", referenceSTP: "MARGOT-707-MANT-202601" },
      { id: "margot-707-mant-2026-02", month: "Febrero 2026", monthKey: "2026-02", year: 2026, dueDate: "2026-02-05", dueDateDisplay: "5 febrero 2026", amount: 4500, status: "pagado", daysUntilDue: -95, paidAt: "2026-02-03T15:20:00", paidAtDisplay: "3 febrero 2026", paymentMethod: "transferencia", referenceSTP: "MARGOT-707-MANT-202602" },
      { id: "margot-707-mant-2026-03", month: "Marzo 2026", monthKey: "2026-03", year: 2026, dueDate: "2026-03-05", dueDateDisplay: "5 marzo 2026", amount: 4500, status: "pagado", daysUntilDue: -67, paidAt: "2026-03-05T09:10:00", paidAtDisplay: "5 marzo 2026", paymentMethod: "transferencia", referenceSTP: "MARGOT-707-MANT-202603" },
      { id: "margot-707-mant-2026-04", month: "Abril 2026", monthKey: "2026-04", year: 2026, dueDate: "2026-04-05", dueDateDisplay: "5 abril 2026", amount: 4500, status: "pagado", daysUntilDue: -36, paidAt: "2026-04-04T11:45:00", paidAtDisplay: "4 abril 2026", paymentMethod: "transferencia", referenceSTP: "MARGOT-707-MANT-202604" },
      { id: "margot-707-mant-2026-05", month: "Mayo 2026", monthKey: "2026-05", year: 2026, dueDate: "2026-05-05", dueDateDisplay: "5 mayo 2026", amount: 4500, status: "pendiente", daysUntilDue: -6 },
      { id: "margot-707-mant-2026-06", month: "Junio 2026", monthKey: "2026-06", year: 2026, dueDate: "2026-06-05", dueDateDisplay: "5 junio 2026", amount: 4500, status: "proximo", daysUntilDue: 25 },
    ],
  },
};

interface MaintenanceState {
  accounts: Record<string, MaintenanceAccount>;
  markChargeAsPaid: (propertyId: string, chargeId: string) => void;
  reset: () => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set, get) => ({
  accounts: structuredClone(initialMaintenanceStore),
  markChargeAsPaid: (propertyId, chargeId) => {
    const account = get().accounts[propertyId];
    if (!account) return;
    const updated: MaintenanceAccount = {
      ...account,
      charges: account.charges.map((c) =>
        c.id !== chargeId
          ? c
          : {
              ...c,
              status: "pagado",
              paidAt: new Date().toISOString(),
              paidAtDisplay: new Date().toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
              paymentMethod: "transferencia",
              referenceSTP: `${account.paymentInfo.referencePrefix}-${c.monthKey.replace("-", "")}`,
            },
      ),
    };
    set({ accounts: { ...get().accounts, [propertyId]: updated } });
  },
  reset: () => set({ accounts: structuredClone(initialMaintenanceStore) }),
}));

export function getMaintenanceAccount(propertyId: string): MaintenanceAccount | undefined {
  return useMaintenanceStore.getState().accounts[propertyId];
}

export function useMaintenanceAccount(propertyId: string): MaintenanceAccount | undefined {
  return useMaintenanceStore((s) => s.accounts[propertyId]);
}

export function markChargeAsPaid(propertyId: string, chargeId: string): void {
  useMaintenanceStore.getState().markChargeAsPaid(propertyId, chargeId);
}

export function getCurrentCharge(account: MaintenanceAccount): MaintenanceCharge | undefined {
  const unpaid = account.charges.filter((c) => c.status !== "pagado");
  if (unpaid.length === 0) return undefined;
  return unpaid.sort((a, b) => a.monthKey.localeCompare(b.monthKey))[0];
}

export type AccountStatus = "al_corriente" | "proximo_pago" | "pendiente" | "vencido";

export function getAccountStatus(account: MaintenanceAccount): {
  status: AccountStatus;
  label: string;
  description: string;
  tone: "success" | "primary" | "warning" | "destructive";
} {
  const current = getCurrentCharge(account);
  if (!current) {
    return {
      status: "al_corriente",
      label: "Al corriente",
      description: "No tienes cuotas pendientes.",
      tone: "success",
    };
  }
  if (current.status === "vencido" || current.daysUntilDue < -3) {
    return {
      status: "vencido",
      label: "Pago vencido",
      description: `Tu cuota de ${current.month} venció hace ${Math.abs(current.daysUntilDue)} días.`,
      tone: "destructive",
    };
  }
  if (current.status === "pendiente" || current.daysUntilDue <= 5) {
    return {
      status: "pendiente",
      label: "Pago pendiente",
      description: `Tu cuota de ${current.month} vence el ${current.dueDateDisplay}.`,
      tone: "warning",
    };
  }
  return {
    status: "proximo_pago",
    label: "Próximo pago",
    description: `Tu siguiente cuota vence el ${current.dueDateDisplay}.`,
    tone: "primary",
  };
}

export function getYearTotal(
  account: MaintenanceAccount,
  year: number,
): { paid: number; pending: number; count: number } {
  const yearCharges = account.charges.filter((c) => c.year === year);
  return {
    paid: yearCharges.filter((c) => c.status === "pagado").reduce((s, c) => s + c.amount, 0),
    pending: yearCharges.filter((c) => c.status !== "pagado").reduce((s, c) => s + c.amount, 0),
    count: yearCharges.length,
  };
}

export function getAvailableYears(account: MaintenanceAccount): number[] {
  const years = new Set(account.charges.map((c) => c.year));
  return Array.from(years).sort((a, b) => b - a);
}

export function getChargesByYear(account: MaintenanceAccount, year: number): MaintenanceCharge[] {
  return account.charges
    .filter((c) => c.year === year)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export function getChargeBadge(status: MaintenanceChargeStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "pagado":
      return { label: "Pagado", className: "bg-success/10 text-success" };
    case "proximo":
      return { label: "Próximo", className: "bg-primary/10 text-primary" };
    case "pendiente":
      return { label: "Pendiente", className: "bg-warning/10 text-warning" };
    case "vencido":
      return { label: "Vencido", className: "bg-destructive/10 text-destructive" };
  }
}
