import { useMemo } from "react";
import {
  generatePaymentSchedule,
  findNextPendingPayment,
  calculateScheduleTotals,
  type PaymentScheduleItem,
} from "@/lib/offers/payment-schedule";
import {
  CheckCircle2,
  Calendar,
  TrendingUp,
  Wallet,
  FileText,
  MessageCircle,
  Download,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import type { OfertaComercial, PreReservation } from "@/lib/offers/offer-data";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";
import { formatMXN, formatPropertyTitle } from "@/lib/offers/offer-data";
import { useAgentById } from "@/lib/offers/agent-data";
import PublicShell from "@/components/admin/offers/offer/PublicShell";

interface Props {
  offer: OfertaComercial;
  preReservation: PreReservation;
  formalReservation: FormalReservation;
}

const CustomerAccountView = ({ offer, preReservation, formalReservation }: Props) => {
  const agent = useAgentById(offer.agentId ?? "");
  const propertyLabel = formatPropertyTitle(offer.property);

  const plan = offer.paymentPlans.find((p) => p.id === formalReservation.selectedPlanId);

  const signedAt =
    formalReservation.contractSignature?.signedAt ??
    formalReservation.completedAt ??
    new Date().toISOString();

  const schedule = useMemo(
    () =>
      plan
        ? generatePaymentSchedule({
            formalReservation,
            plan,
            signedAt,
          })
        : [],
    [formalReservation, plan, signedAt]
  );

  const { totalPaid, totalPending } = calculateScheduleTotals(schedule);
  const nextPayment = findNextPendingPayment(schedule);

  const finalPrice = plan?.finalPrice ?? offer.property.listPrice;
  const downpaymentItem = schedule.find((s) => s.id === "downpayment");
  const downpaymentPending = downpaymentItem
    ? downpaymentItem.amount - downpaymentItem.paidAmount
    : 0;
  const downpaymentDueDate = downpaymentItem
    ? new Date(downpaymentItem.dueDate)
    : new Date();
  const daysUntilDownpaymentDue = Math.ceil(
    (downpaymentDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <PublicShell agent={agent}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-12 space-y-6">
        {/* Hero */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Cuenta de cobranza · {formalReservation.id}
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Tu cuenta de {propertyLabel}
          </h1>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-[11px] font-bold">
              <CheckCircle2 className="w-3 h-3" />
              Apartada a tu nombre
            </span>
            {plan && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
                Plan {plan.name}
                {plan.discountPct > 0 && (
                  <span className="text-success">(-{plan.discountPct}%)</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* 3 status cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatusCard
            label="Total pagado"
            amount={totalPaid}
            icon={CheckCircle2}
            tone="success"
            hint={`de ${formatMXN(finalPrice)}`}
          />
          <StatusCard
            label="Saldo del enganche"
            amount={downpaymentPending}
            icon={Wallet}
            tone={daysUntilDownpaymentDue <= 7 && downpaymentPending > 0 ? "warning" : "default"}
            hint={
              downpaymentPending > 0
                ? `Vence en ${daysUntilDownpaymentDue} día${daysUntilDownpaymentDue !== 1 ? "s" : ""}`
                : "Completo"
            }
          />
          <StatusCard
            label="Saldo total restante"
            amount={totalPending}
            icon={TrendingUp}
            tone="default"
            hint="Hasta liquidación"
          />
        </div>

        {/* Próximo pago */}
        {nextPayment && nextPayment.amount - nextPayment.paidAmount > 0 && (
          <NextPaymentCard payment={nextPayment} />
        )}

        {/* Cronograma */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Cronograma de pagos</h2>
          </div>
          <div className="space-y-1">
            {schedule.map((item, idx) => (
              <ScheduleRow key={item.id} item={item} isLast={idx === schedule.length - 1} />
            ))}
          </div>
        </div>

        {/* Historial */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Historial de movimientos</h2>
          </div>
          <div className="flex items-start gap-3 py-2">
            <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Aplicación del pre-apartado
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {new Date(signedAt).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                · Folio {preReservation.id}
              </p>
            </div>
            <span className="text-sm font-bold text-success tabular-nums flex-shrink-0">
              +{formatMXN(formalReservation.appliedAmountMXN ?? 5000)}
            </span>
          </div>
        </div>

        {/* Documentos */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Documentos</h2>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Contrato preliminar firmado</p>
              <p className="text-[11px] text-muted-foreground tabular-nums truncate">
                Folio{" "}
                {formalReservation.contractSignature?.mifielDocumentId ?? formalReservation.id} ·
                Firmado con MIFIEL
              </p>
            </div>
            <button
              onClick={() => console.log("Descargar contrato firmado")}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-card border border-border text-foreground text-xs font-semibold hover:border-foreground/30 transition-colors flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar
            </button>
          </div>
        </div>

        {/* Tu agente */}
        {agent && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-success" />
              <h2 className="text-sm font-semibold text-foreground">Tu agente</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {agent.firstName} te acompaña en esta etapa. Responde por WhatsApp en menos de 2
              horas hábiles.

            </p>
            <a
              href={`https://wa.me/${agent.whatsapp ?? ""}?text=${encodeURIComponent(
                `Hola ${agent.firstName}, tengo una duda sobre mi cuenta ${formalReservation.id} (${propertyLabel}).`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 rounded-xl bg-success text-success-foreground text-xs font-semibold hover:bg-success/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Escribir por WhatsApp
            </a>
          </div>
        )}
      </div>
    </PublicShell>
  );
};

// ── Sub-componentes ──

const StatusCard = ({
  label,
  amount,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  amount: number;
  icon: typeof CheckCircle2;
  tone: "default" | "success" | "warning";
  hint: string;
}) => {
  const toneConfig = {
    default: { bg: "bg-muted text-muted-foreground", amount: "text-foreground" },
    success: { bg: "bg-success/10 text-success", amount: "text-success" },
    warning: { bg: "bg-warning/10 text-warning", amount: "text-warning" },
  }[tone];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneConfig.bg}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </p>
      </div>
      <p className={`text-xl font-bold tabular-nums ${toneConfig.amount}`}>
        {formatMXN(amount)}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
    </div>
  );
};

const NextPaymentCard = ({ payment }: { payment: PaymentScheduleItem }) => {
  const pendingAmount = payment.amount - payment.paidAmount;
  const dueDate = new Date(payment.dueDate);
  const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isUrgent = daysUntilDue <= 7;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isUrgent ? "border-warning/40 bg-warning/5" : "border-primary/30 bg-primary/5"
      }`}
    >
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Próximo pago
          </p>
          <p className="text-base font-bold text-foreground mt-1">
            {payment.category === "downpayment" ? "Completar enganche" : payment.label}
          </p>
          <p
            className={`text-[11px] mt-0.5 tabular-nums ${
              isUrgent ? "text-warning font-semibold" : "text-muted-foreground"
            }`}
          >
            {isUrgent
              ? `Vence en ${daysUntilDue} día${daysUntilDue !== 1 ? "s" : ""}`
              : `Vence el ${dueDate.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}`}
          </p>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums">
          {formatMXN(pendingAmount)}
        </p>
      </div>
      <button
        onClick={() => console.log("Iniciar flujo de pago para:", payment.id)}
        className={`w-full h-11 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
          isUrgent
            ? "bg-warning text-warning-foreground hover:bg-warning/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        Pagar {formatMXN(pendingAmount)}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

const ScheduleRow = ({ item, isLast }: { item: PaymentScheduleItem; isLast: boolean }) => {
  const config = {
    paid: {
      icon: CheckCircle2,
      iconBg: "bg-success/10 text-success",
      pill: "Pagado",
      pillClasses: "bg-success/10 text-success",
    },
    partial: {
      icon: AlertCircle,
      iconBg: "bg-warning/15 text-warning",
      pill: "Parcial",
      pillClasses: "bg-warning/10 text-warning",
    },
    current: {
      icon: Clock,
      iconBg: "bg-warning/15 text-warning ring-4 ring-warning/15",
      pill: "Pendiente",
      pillClasses: "bg-warning/10 text-warning",
    },
    upcoming: {
      icon: Calendar,
      iconBg: "bg-muted/40 text-muted-foreground",
      pill: "Por venir",
      pillClasses: "bg-muted text-muted-foreground",
    },
  }[item.status];

  const Icon = config.icon;
  const pendingAmount = item.amount - item.paidAmount;
  const progressPct = item.amount > 0 ? (item.paidAmount / item.amount) * 100 : 0;

  return (
    <div
      className={`flex items-start gap-3 py-3 ${!isLast ? "border-b border-border" : ""}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.iconBg}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-semibold text-foreground">{item.label}</p>
          <p className="text-sm font-bold text-foreground tabular-nums">
            {formatMXN(item.amount)}
          </p>
        </div>

        {item.status === "partial" && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>Pagado {formatMXN(item.paidAmount)}</span>
              <span>Saldo {formatMXN(pendingAmount)}</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-success rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-1.5 gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {new Date(item.dueDate).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.pillClasses}`}
          >
            {config.pill}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CustomerAccountView;
