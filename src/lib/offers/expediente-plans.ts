import type { PaymentItem, PlanPagosData } from "./formal-reservation-data";

const APARTADO_AMOUNT = 20000;

export const PAYMENT_PLANS = {
  corto: {
    id: "corto" as const,
    name: "Plan corto",
    tagline: "Mayor enganche, sin mensualidades",
    enganchePct: 0.3,
    mensualidadesCount: 0,
    deliveryMonthsAhead: 12,
    badge: null as string | null,
  },
  medio: {
    id: "medio" as const,
    name: "Plan medio",
    tagline: "Balance enganche + mensualidades",
    enganchePct: 0.2,
    mensualidadesCount: 12,
    deliveryMonthsAhead: 18,
    badge: "Más popular" as string | null,
  },
  largo: {
    id: "largo" as const,
    name: "Plan extendido",
    tagline: "Menor enganche, plazo largo",
    enganchePct: 0.1,
    mensualidadesCount: 24,
    deliveryMonthsAhead: 30,
    badge: null as string | null,
  },
};

export type PlanPresetId = keyof typeof PAYMENT_PLANS;

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const fmtDate = (d: Date): string => d.toISOString().slice(0, 10);

export const computePlanDetails = (planId: PlanPresetId, totalPriceMXN: number) => {
  const plan = PAYMENT_PLANS[planId];
  const engancheTotal = Math.round(totalPriceMXN * plan.enganchePct);
  const engancheRestante = Math.max(0, engancheTotal - APARTADO_AMOUNT);
  const restoTotal = totalPriceMXN - engancheTotal;
  const mensualidad =
    plan.mensualidadesCount > 0 ? Math.round((restoTotal * 0.5) / plan.mensualidadesCount) : 0;
  const saldoEntrega = restoTotal - mensualidad * plan.mensualidadesCount;

  return {
    plan,
    engancheTotal,
    engancheRestante,
    mensualidadAmount: mensualidad,
    saldoEntrega,
  };
};

export const generateExpedienteSchedule = (
  planId: PlanPresetId,
  totalPriceMXN: number,
  apartadoPaidAt: string,
): PlanPagosData => {
  const details = computePlanDetails(planId, totalPriceMXN);
  const startDate = new Date(apartadoPaidAt);
  const schedule: PaymentItem[] = [];

  schedule.push({
    id: "PAY-APARTADO",
    type: "apartado",
    concepto: "Apartado pagado",
    fechaProgramada: fmtDate(startDate),
    montoMXN: APARTADO_AMOUNT,
    status: "pagado",
  });

  if (details.engancheRestante > 0) {
    schedule.push({
      id: "PAY-ENGANCHE",
      type: "enganche_saldo",
      concepto: "Saldo del enganche",
      fechaProgramada: fmtDate(addDays(startDate, 7)),
      montoMXN: details.engancheRestante,
      status: "programado",
    });
  }

  for (let i = 1; i <= details.plan.mensualidadesCount; i++) {
    schedule.push({
      id: `PAY-MENS-${i}`,
      type: "mensualidad",
      concepto: `Mensualidad ${i} de ${details.plan.mensualidadesCount}`,
      fechaProgramada: fmtDate(addMonths(startDate, i)),
      montoMXN: details.mensualidadAmount,
      status: "programado",
    });
  }

  const deliveryDate = addMonths(startDate, details.plan.deliveryMonthsAhead);
  if (details.saldoEntrega > 0) {
    schedule.push({
      id: "PAY-ENTREGA",
      type: "saldo_entrega",
      concepto: "Saldo a la entrega",
      fechaProgramada: fmtDate(deliveryDate),
      montoMXN: details.saldoEntrega,
      status: "programado",
    });
  }

  return {
    selectedPlanId: planId,
    totalPriceMXN,
    appliedFromApartado: APARTADO_AMOUNT,
    engancheTotalMXN: details.engancheTotal,
    engancheRestanteMXN: details.engancheRestante,
    mensualidadesCount: details.plan.mensualidadesCount,
    mensualidadAmountMXN: details.mensualidadAmount,
    saldoEntregaMXN: details.saldoEntrega,
    estimatedDeliveryDate: fmtDate(deliveryDate),
    schedule,
    selectedAt: new Date().toISOString(),
  };
};
