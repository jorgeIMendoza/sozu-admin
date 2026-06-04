// ── Payment schedule types & real DB hook ──

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InstallmentStatus = "proximo" | "cercano" | "vencido" | "pagado";
export type PaymentConfirmationStatus = "recibido" | "validando" | "confirmado";

export interface Installment {
  id: string;
  number: number;
  amount: number;
  dueDate: string; // ISO YYYY-MM-DD
  dueDateDisplay: string;
  daysUntilDue: number; // negative = overdue
  status: InstallmentStatus;
  concepto: string;
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
  estimatedDeliveryDate?: string;
  accelerationNoticeDate?: string;
}

const STP_CONSTANTS = {
  bankName: "STP (Sistema de Transferencias y Pagos)",
  beneficiary: "SOZU Desarrollos S.A. de C.V.",
  fallbackClabe: "646180157000000000",
};

// ── Status computation ──

function computeStatus(pago_completado: boolean, fechaPago: string): InstallmentStatus {
  if (pago_completado) return "pagado";
  const today = Date.now();
  const due = new Date(fechaPago).getTime();
  const days = Math.ceil((due - today) / 86_400_000);
  if (days < 0) return "vencido";
  if (days <= 15) return "cercano";
  return "proximo";
}

// ── Builder ──

interface AcuerdoRow {
  id: number;
  id_cuenta_cobranza: number;
  id_concepto: number;
  fecha_pago: string;
  monto: string;
  pago_completado: boolean;
  orden: string;
  conceptos_pago: { nombre: string } | null;
}

function buildPlan(cuentaId: string, rows: AcuerdoRow[], clabeStp?: string | null): PropertyPaymentPlan {
  const today = Date.now();
  let parcialidadCount = 0;

  const installments: Installment[] = rows.map((row) => {
    const idConcepto = row.id_concepto;
    let concepto = row.conceptos_pago?.nombre ?? "Pago";
    if (idConcepto === 5) { parcialidadCount++; concepto = `Parcialidad ${parcialidadCount}`; }

    const isoDate = String(row.fecha_pago).slice(0, 10);
    const due = new Date(isoDate + "T12:00:00").getTime();
    const daysUntilDue = Math.ceil((due - today) / 86_400_000);
    const isPaid = row.pago_completado;

    return {
      id: String(row.id),
      number: Number(row.orden),
      amount: Number(row.monto),
      dueDate: isoDate,
      dueDateDisplay: new Date(isoDate + "T12:00:00").toLocaleDateString("es-MX", {
        day: "numeric", month: "short", year: "numeric",
      }),
      daysUntilDue,
      status: computeStatus(isPaid, isoDate),
      concepto,
      paidAt: isPaid ? isoDate : undefined,
    };
  });

  const completedInstallments = installments.filter((i) => i.status === "pagado").length;

  return {
    propertyId: cuentaId,
    totalInstallments: installments.length,
    completedInstallments,
    installments,
    stpInfo: {
      clabe: clabeStp ?? STP_CONSTANTS.fallbackClabe,
      bankName: STP_CONSTANTS.bankName,
      beneficiary: STP_CONSTANTS.beneficiary,
      reference: `SOZU-${cuentaId}`,
      propertyId: cuentaId,
      clientRFC: "",
    },
  };
}

// ── Real hook ──

export function usePaymentSchedule(cuentaId: string | undefined) {
  return useQuery({
    queryKey: ["payment-schedule", cuentaId],
    queryFn: async () => {
      const [{ data: rows, error: e1 }, { data: cuenta, error: e2 }] = await Promise.all([
        supabase
          .from("acuerdos_pago")
          .select("id, id_cuenta_cobranza, id_concepto, fecha_pago, monto, pago_completado, orden, conceptos_pago(nombre)")
          .eq("id_cuenta_cobranza", Number(cuentaId))
          .order("orden"),
        supabase
          .from("cuentas_cobranza")
          .select("clabe_stp")
          .eq("id", Number(cuentaId))
          .maybeSingle(),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return buildPlan(cuentaId!, (rows ?? []) as AcuerdoRow[], cuenta?.clabe_stp);
    },
    enabled: !!cuentaId,
    staleTime: 60_000,
  });
}

// ── Backward-compat alias (usePaymentPlan → usePaymentSchedule) ──

export function usePaymentPlan(cuentaId: string | undefined): PropertyPaymentPlan | undefined {
  return usePaymentSchedule(cuentaId).data;
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

// ── Pure plan helpers ──

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
  const progressPct = plan.totalInstallments > 0
    ? (paid.length / plan.totalInstallments) * 100
    : 0;
  return { paidCount: paid.length, pendingCount: pending.length, paidAmount, pendingAmount, progressPct };
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

  const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / 86_400_000);
  const tier: AccelerationTier =
    daysUntilDelivery > 15 ? "informative" : daysUntilDelivery > 7 ? "urgent" : "critical";

  return { tier, daysUntilDelivery, remainingBalance, remainingInstallmentsCount };
}

export function formatDeliveryDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });
}

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

  if (!overdue && !nearest) {
    sorted.filter((i) => i.status === "proximo").slice(0, 3).forEach((i) => visibleSet.add(i.id));
  }

  return sorted.filter((i) => visibleSet.has(i.id));
}
