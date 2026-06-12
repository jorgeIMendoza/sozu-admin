import { Sparkles, AlertTriangle, AlertCircle, ChevronRight } from "lucide-react";
import { fmtMXN as fmt } from "@/lib/utils";
import { type AccelerationTier, formatDeliveryDate } from "@/lib/offers/payment-data";
import SupportLauncher from "@/components/admin/offers/portal/support/SupportLauncher";
import type { SupportContext } from "@/lib/offers/advisor-data";

interface AccelerationBannerProps {
  tier: Exclude<AccelerationTier, "none">;
  daysUntilDelivery: number;
  remainingBalance: number;
  remainingInstallmentsCount: number;
  estimatedDeliveryDate: string;
  onCoordinate: () => void;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
}

const AccelerationBanner = ({
  tier,
  daysUntilDelivery,
  remainingBalance,
  remainingInstallmentsCount,
  estimatedDeliveryDate,
  onCoordinate,
  propertyId,
  propertyName,
  unitNumber,
}: AccelerationBannerProps) => {
  const config = {
    informative: {
      container: "bg-primary/[0.05] border-primary/20",
      iconWrap: "bg-primary/15 text-primary",
      label: "BUENAS NOTICIAS",
      labelColor: "text-primary",
      Icon: Sparkles,
      headlineSize: "text-base",
      headline: "Tu propiedad estará lista antes de tiempo",
      btn: "bg-primary text-primary-foreground hover:bg-primary/90",
      microcopy: "Sin compromiso. Conoce tus opciones de liquidación.",
    },
    urgent: {
      container: "bg-warning/10 border-warning/30",
      iconWrap: "bg-warning/15 text-warning",
      label: "ACCIÓN REQUERIDA",
      labelColor: "text-warning",
      Icon: AlertTriangle,
      headlineSize: "text-base",
      headline: `Tu propiedad estará lista en ${Math.max(daysUntilDelivery, 0)} días`,
      btn: "bg-warning text-warning-foreground hover:bg-warning/90",
      microcopy: "Selecciona financiamiento propio o crédito hipotecario.",
    },
    critical: {
      container: "bg-destructive/10 border-destructive/30",
      iconWrap: "bg-destructive/15 text-destructive",
      label: "URGENTE · LIQUIDACIÓN PENDIENTE",
      labelColor: "text-destructive",
      Icon: AlertCircle,
      headlineSize: "text-lg",
      headline: "Tu propiedad está lista para entrega",
      btn: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      microcopy: "El siguiente paso es escriturar tu departamento.",
    },
  }[tier];

  const Icon = config.Icon;
  const avgPerInstallment =
    remainingInstallmentsCount > 0 ? remainingBalance / remainingInstallmentsCount : 0;

  const body =
    tier === "informative" ? (
      <>
        Tu departamento estará terminado el{" "}
        <span className="font-semibold text-foreground">
          {formatDeliveryDate(estimatedDeliveryDate)}
        </span>
        . Por contrato, esto significa que tendrás que liquidar las{" "}
        <span className="font-semibold text-foreground">
          {remainingInstallmentsCount} parcialidades restantes
        </span>{" "}
        en una sola exhibición antes de la entrega. Empieza a prepararte: puedes liquidar con
        fondos propios o solicitar un crédito hipotecario.
      </>
    ) : tier === "urgent" ? (
      <>
        Faltan{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {Math.max(daysUntilDelivery, 0)} días
        </span>{" "}
        para la entrega de tu departamento. Necesitamos saber cómo vas a liquidar el saldo
        restante para coordinar la escrituración. Si optas por crédito hipotecario, el banco
        necesita al menos{" "}
        <span className="font-semibold text-foreground">2 a 3 semanas</span> para aprobarlo.
      </>
    ) : (
      <>
        Tu departamento está listo para escriturarse y entregarse. Por contrato, el saldo restante
        de{" "}
        <span className="font-semibold text-foreground">
          {remainingInstallmentsCount} parcialidades
        </span>{" "}
        se liquida en una sola exhibición.{" "}
        <span className="font-semibold text-foreground">Contáctanos hoy mismo</span> para definir
        tu método de liquidación y agendar firma.
      </>
    );

  return (
    <div className={`rounded-2xl p-5 mb-5 animate-fade-in border ${config.container}`}>
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${config.iconWrap}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-[10px] uppercase tracking-widest font-semibold ${config.labelColor}`}
          >
            {config.label}
          </p>
          <h3
            className={`font-display font-bold text-foreground leading-tight mt-1 ${config.headlineSize}`}
          >
            {config.headline}
          </h3>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{body}</p>

      <div className="rounded-xl bg-card border border-border p-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Saldo a liquidar
            </p>
            <p className="font-display font-bold text-xl tabular-nums text-foreground mt-0.5">
              {fmt(remainingBalance)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Equivale a
            </p>
            <p className="font-display font-semibold text-sm text-foreground mt-0.5 tabular-nums">
              {remainingInstallmentsCount} parcialidades
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              de {fmt(Math.round(avgPerInstallment))} c/u
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onCoordinate}
        className={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${config.btn}`}
      >
        Coordinar liquidación
        <ChevronRight className="w-4 h-4" />
      </button>

      <p className="text-[11px] text-muted-foreground text-center mt-3 leading-relaxed">
        {config.microcopy}
      </p>

      {(() => {
        const supportContext: SupportContext = {
          propertyId,
          propertyName,
          unitNumber,
          flowName: "Liquidación anticipada",
          flowStep: `Tier ${tier}`,
          additionalNotes: `${Math.max(daysUntilDelivery, 0)} días hasta entrega · Saldo: ${fmt(remainingBalance)}`,
          phaseOverride: "pago_final",
        };
        return (
          <div className="mt-4">
            <SupportLauncher context={supportContext} variant="compact" />
          </div>
        );
      })()}
    </div>
  );
};

export default AccelerationBanner;
