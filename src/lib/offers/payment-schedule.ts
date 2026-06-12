import type { FormalReservation } from "./formal-reservation-data";
import type { PaymentPlan } from "./offer-data";

export type PaymentScheduleItem = {
  id: string;
  label: string;
  category: "downpayment" | "monthly" | "delivery";
  monthIndex?: number;
  amount: number;
  paidAmount: number;
  dueDate: string; // ISO
  status: "paid" | "partial" | "current" | "upcoming";
};

interface GenerateScheduleParams {
  formalReservation: FormalReservation;
  plan: PaymentPlan;
  signedAt: string;
  estimatedDeliveryISO?: string;
  enganchePaymentDueDays?: number;
}

export const generatePaymentSchedule = ({
  formalReservation,
  plan,
  signedAt,
  estimatedDeliveryISO,
  enganchePaymentDueDays = 15,
}: GenerateScheduleParams): PaymentScheduleItem[] => {
  if (!plan) return [];

  const downPayment = plan.downPaymentAmount;
  const deliveryPayment = plan.finalPaymentAmount;
  const monthsCount = plan.installments?.count ?? 0;
  const monthlyPayment = plan.installments?.monthlyAmount ?? 0;

  const appliedAmount = formalReservation.appliedAmountMXN ?? 5000;
  const signedDate = new Date(signedAt);

  const schedule: PaymentScheduleItem[] = [];

  const downpaymentDue = new Date(signedDate);
  downpaymentDue.setDate(downpaymentDue.getDate() + enganchePaymentDueDays);

  const downpaymentStatus: PaymentScheduleItem["status"] =
    appliedAmount >= downPayment ? "paid" : "partial";

  schedule.push({
    id: "downpayment",
    label: "Enganche",
    category: "downpayment",
    amount: downPayment,
    paidAmount: Math.min(appliedAmount, downPayment),
    dueDate: downpaymentDue.toISOString(),
    status: downpaymentStatus,
  });

  for (let i = 1; i <= monthsCount; i++) {
    const monthDue = new Date(signedDate);
    monthDue.setMonth(monthDue.getMonth() + i);

    schedule.push({
      id: `month_${i}`,
      label: `Mensualidad ${i}`,
      category: "monthly",
      monthIndex: i,
      amount: monthlyPayment,
      paidAmount: 0,
      dueDate: monthDue.toISOString(),
      status: "upcoming",
    });
  }

  const deliveryDue = estimatedDeliveryISO
    ? new Date(estimatedDeliveryISO)
    : (() => {
        const d = new Date(signedDate);
        d.setMonth(d.getMonth() + monthsCount + 1);
        return d;
      })();

  schedule.push({
    id: "delivery",
    label: "Liquidación a la entrega",
    category: "delivery",
    amount: deliveryPayment,
    paidAmount: 0,
    dueDate: deliveryDue.toISOString(),
    status: "upcoming",
  });

  return schedule;
};

export const findNextPendingPayment = (
  schedule: PaymentScheduleItem[]
): PaymentScheduleItem | null => {
  return schedule.find((item) => item.status !== "paid") ?? null;
};

export const calculateScheduleTotals = (schedule: PaymentScheduleItem[]) => {
  let totalPaid = 0;
  let totalPending = 0;
  for (const item of schedule) {
    totalPaid += item.paidAmount;
    totalPending += item.amount - item.paidAmount;
  }
  return { totalPaid, totalPending };
};
