import type { InvestmentProperty } from "@/lib/offers/types";
import type {
  PropertyPaymentPlan,
  Installment,
  InstallmentStatus,
} from "@/lib/offers/payment-data";

export function buildPaymentPlanFromInvestment(
  investment: InvestmentProperty
): PropertyPaymentPlan | undefined {
  const { property, financials, payments } = investment;
  if (!financials.clabe || payments.length === 0) return undefined;
  // Only for real DB properties (cuentas_cobranza numeric IDs)
  if (!/^\d+$/.test(property.id)) return undefined;

  const today = new Date().setHours(12, 0, 0, 0);
  const installments: Installment[] = payments.map((p, i) => {
    const dueDate = new Date(p.date + "T12:00:00").getTime();
    const daysUntilDue = Math.round((dueDate - today) / 86400000);
    let status: InstallmentStatus;
    if (p.status === "pagado") {
      status = "pagado";
    } else if (daysUntilDue < 0) {
      status = "vencido";
    } else if (daysUntilDue <= 7) {
      status = "cercano";
    } else {
      status = "proximo";
    }
    const dueDateDisplay = new Date(p.date + "T12:00:00").toLocaleDateString(
      "es-MX",
      { day: "numeric", month: "long", year: "numeric" }
    );
    return {
      id: `${property.id}-${i + 1}`,
      number: i + 1,
      amount: p.amount,
      dueDate: p.date,
      dueDateDisplay,
      daysUntilDue,
      status,
      paidAt: p.status === "pagado" ? `${p.date}T00:00:00` : undefined,
      confirmationStatus: p.status === "pagado" ? "confirmado" : undefined,
    };
  });

  return {
    propertyId: property.id,
    totalInstallments: installments.length,
    completedInstallments: installments.filter((i) => i.status === "pagado").length,
    installments,
    stpInfo: {
      clabe: financials.clabe,
      bankName: "STP (Sistema de Transferencias y Pagos)",
      beneficiary: "SOZU Desarrollos S.A. de C.V.",
      reference: property.unitNumber,
      propertyId: property.id,
      clientRFC: property.clientRFC ?? "",
    },
  };
}
