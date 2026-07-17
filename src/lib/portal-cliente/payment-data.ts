// ── Payment schedule types & real DB hook ──

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InstallmentStatus = "proximo" | "cercano" | "vencido" | "pagado";
export type PaymentConfirmationStatus = "recibido" | "validando" | "confirmado";

/**
 * Un pago (dispersión) aplicado a un acuerdo/concepto. Un mismo concepto puede
 * recibir varias aplicaciones (los pagos son dispersados, no montos exactos),
 * por eso `Installment.applications` es un arreglo.
 */
export interface PaymentApplication {
  pagoId: number;
  amount: number; // aplicaciones_pago.monto (lo aplicado por este pago a este concepto)
  date: string; // ISO YYYY-MM-DD (pago.fecha_pago)
  dateDisplay: string;
  trackingKey?: string;
  cepUrl?: string;
  evidenceUrl?: string;
  methodName?: string;
}

export interface Installment {
  id: string;
  number: number;
  amount: number; // monto planeado del concepto (acuerdos_pago.monto)
  appliedAmount: number; // suma de aplicaciones_pago (pagos dispersados) a este concepto
  dueDate: string; // ISO YYYY-MM-DD
  dueDateDisplay: string;
  daysUntilDue: number; // negative = overdue
  status: InstallmentStatus;
  concepto: string;
  paidAt?: string;
  confirmationStatus?: PaymentConfirmationStatus;
  confirmationTimestamp?: string;
  constructionMilestone?: string;
  applications?: PaymentApplication[]; // pagos dispersados que componen este concepto
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

function buildPlan(
  cuentaId: string,
  rows: AcuerdoRow[],
  clabeStp?: string | null,
  appsByAcuerdo: Record<number, PaymentApplication[]> = {},
): PropertyPaymentPlan {
  const today = Date.now();
  let parcialidadCount = 0;

  const installments: Installment[] = rows.map((row) => {
    const idConcepto = row.id_concepto;
    let concepto = row.conceptos_pago?.nombre ?? "Pago";
    // Concepto 3 = "Pago a contra entrega" en BD → se muestra como "Pago a escrituración"
    if (idConcepto === 3) concepto = "Pago a escrituración";
    if (idConcepto === 5) { parcialidadCount++; concepto = `Parcialidad ${parcialidadCount}`; }

    const isoDate = String(row.fecha_pago).slice(0, 10);
    const due = new Date(isoDate + "T12:00:00").getTime();
    const daysUntilDue = Math.ceil((due - today) / 86_400_000);
    const isPaid = row.pago_completado;
    const applications = (appsByAcuerdo[row.id] ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const appliedAmount = applications.reduce((s, a) => s + a.amount, 0);

    return {
      id: String(row.id),
      number: Number(row.orden),
      amount: Number(row.monto),
      appliedAmount,
      dueDate: isoDate,
      dueDateDisplay: new Date(isoDate + "T12:00:00").toLocaleDateString("es-MX", {
        day: "numeric", month: "short", year: "numeric",
      }),
      daysUntilDue,
      status: computeStatus(isPaid, isoDate),
      concepto,
      paidAt: isPaid ? isoDate : undefined,
      applications: applications.length ? applications : undefined,
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
          // FK hint explícito: acuerdos_pago tiene 2 FKs a conceptos_pago → embed ambiguo sin él
          .select("id, id_cuenta_cobranza, id_concepto, fecha_pago, monto, pago_completado, orden, conceptos_pago!acuerdos_pago_id_concepto_fkey(nombre)")
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

      const acuerdoRows = (rows ?? []) as unknown as AcuerdoRow[];
      const appsByAcuerdo = await fetchApplicationsByAcuerdo(acuerdoRows.map((r) => r.id));
      return buildPlan(cuentaId!, acuerdoRows, cuenta?.clabe_stp, appsByAcuerdo);
    },
    enabled: !!cuentaId,
    staleTime: 60_000,
  });
}

/**
 * Aplicaciones de pago (pagos dispersados) por acuerdo. Un acuerdo puede tener
 * varias filas en `aplicaciones_pago`, cada una ligada a un `pago` distinto.
 * Excluye multas (`es_multa=true`) - esas no cuentan como abono al concepto.
 */
async function fetchApplicationsByAcuerdo(
  acuerdoIds: number[],
): Promise<Record<number, PaymentApplication[]>> {
  const map: Record<number, PaymentApplication[]> = {};
  if (!acuerdoIds.length) return map;

  try {
  const { data: aplicaciones } = await supabase
    .from("aplicaciones_pago")
    .select("id_acuerdo_pago, id_pago, monto, es_multa")
    .in("id_acuerdo_pago", acuerdoIds)
    .eq("activo", true);
  if (!aplicaciones?.length) return map;

  const realApps = (aplicaciones as any[]).filter((a) => !a.es_multa);
  const pagoIds = [...new Set(realApps.map((a) => Number(a.id_pago)).filter(Boolean))];
  if (!pagoIds.length) return map;

  const { data: pagos } = await supabase
    .from("pagos")
    .select("id, clave_rastreo, fecha_pago, url_cep, url_recibo, id_metodos_pago")
    .in("id", pagoIds)
    .eq("activo", true);
  const pagoById: Record<number, any> = Object.fromEntries((pagos ?? []).map((p: any) => [p.id, p]));

  const metodoIds = [...new Set((pagos ?? []).map((p: any) => p.id_metodos_pago).filter(Boolean))];
  const { data: metodos } = metodoIds.length
    ? await supabase.from("metodos_pago").select("id, nombre").in("id", metodoIds)
    : { data: [] as any[] };
  const metodoNombre: Record<number, string> = Object.fromEntries(
    (metodos ?? []).map((m: any) => [m.id, String(m.nombre)]),
  );

  for (const ap of realApps) {
    const pago = pagoById[Number(ap.id_pago)];
    if (!pago) continue;
    const date = pago.fecha_pago ? String(pago.fecha_pago).slice(0, 10) : "";
    const app: PaymentApplication = {
      pagoId: Number(pago.id),
      amount: Number(ap.monto),
      date,
      dateDisplay: date
        ? new Date(date + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
        : "-",
      trackingKey: pago.clave_rastreo ? String(pago.clave_rastreo) : undefined,
      cepUrl: pago.url_cep ? String(pago.url_cep) : undefined,
      evidenceUrl: pago.url_recibo ? String(pago.url_recibo) : undefined,
      methodName: pago.id_metodos_pago ? metodoNombre[Number(pago.id_metodos_pago)] : undefined,
    };
    (map[Number(ap.id_acuerdo_pago)] ??= []).push(app);
  }
  return map;
  } catch {
    // Nunca romper el calendario de pagos por un fallo al traer aplicaciones
    return map;
  }
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
