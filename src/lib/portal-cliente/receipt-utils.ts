import type { ReceiptData } from "@/components/admin/portal-cliente/detail/PaymentReceiptModal";
import type { InvestmentProperty, PaymentRecord } from "@/lib/portal-cliente/mock-data";
import type { Installment, PropertyPaymentPlan } from "@/lib/portal-cliente/payment-data";

let folioCounter = 245;

function generateFolio(): string {
  folioCounter++;
  return `RC-2026-${String(folioCounter).padStart(6, "0")}`;
}

function formatDate(iso?: string): string {
  if (!iso) {
    const now = new Date();
    return now.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  }
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(iso?: string): string {
  if (!iso) return formatDate();
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildReceiptFromInstallment(
  installment: Installment,
  plan: PropertyPaymentPlan,
  investment: InvestmentProperty,
): ReceiptData {
  return {
    folio: generateFolio(),
    emissionDate: formatDate(installment.paidAt),
    clientName: investment.property.clientName ?? plan.stpInfo.clientRFC,
    clientRFC: investment.property.clientRFC ?? plan.stpInfo.clientRFC,
    projectName: investment.property.projectName,
    unitNumber: investment.property.unitNumber,
    concept: installment.number === 1 ? "Enganche" : "Pago de Parcialidad",
    amount: installment.amount,
    paymentMethod: "Transferencia Interbancaria (STP)",
    clabe: investment.financials.clabe ?? plan.stpInfo.clabe,
    referenceSTP: `NU39${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
    confirmationDate: formatDateTime(installment.confirmationTimestamp),
    totalPaidAccumulated: investment.financials.totalPaid,
    pendingBalance: investment.financials.pendingBalance,
    totalAssetValue: investment.financials.initialPrice,
  };
}

export function buildReceiptFromPaymentRecord(
  payment: PaymentRecord,
  investment: InvestmentProperty,
  productName?: string,
): ReceiptData {
  return {
    folio: generateFolio(),
    emissionDate: formatDate(payment.date),
    clientName: investment.property.clientName ?? "—",
    clientRFC: investment.property.clientRFC ?? "—",
    projectName: investment.property.projectName,
    unitNumber: investment.property.unitNumber,
    productName,
    concept: payment.concept,
    amount: payment.amount,
    paymentMethod: payment.paymentMethodName ?? "Transferencia bancaria",
    clabe: investment.financials.clabe ?? "—",
    referenceSTP: payment.trackingKey ?? "—",
    confirmationDate: formatDate(payment.date),
    totalPaidAccumulated: investment.financials.totalPaid,
    pendingBalance: investment.financials.pendingBalance,
    totalAssetValue: investment.financials.initialPrice,
    pagoId: payment.pagoId,
  };
}

export function buildReceiptFromMaintenance(
  month: string,
  amount: number,
  investment: InvestmentProperty,
): ReceiptData {
  return {
    folio: generateFolio(),
    emissionDate: formatDate(),
    clientName: investment.property.clientName ?? "—",
    clientRFC: investment.property.clientRFC ?? "—",
    projectName: investment.property.projectName,
    unitNumber: investment.property.unitNumber,
    concept: "Mantenimiento",
    amount,
    paymentMethod: "Transferencia bancaria",
    clabe: investment.financials.clabe ?? "—",
    referenceSTP: "—",
    confirmationDate: month,
    totalPaidAccumulated: investment.financials.totalPaid,
    pendingBalance: investment.financials.pendingBalance,
    totalAssetValue: investment.financials.initialPrice,
  };
}
