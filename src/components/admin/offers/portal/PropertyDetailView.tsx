import { useEffect } from "react";
import { usePropertyDetailUrlState } from "@/hooks/offers/usePropertyDetailUrlState";
import PropertyDetailHeader from "./detail/PropertyDetailHeader";
import FinancialCard from "./detail/FinancialCard";
import NextActionBlock from "./detail/NextActionBlock";
import NextInstallmentCard from "./detail/NextInstallmentCard";
import PaymentInstructionsView from "./detail/PaymentInstructionsView";
import PaymentStatusTracker from "./detail/PaymentStatusTracker";
import InvestmentStepper from "./detail/InvestmentStepper";
import DetailQuickActions from "./detail/DetailQuickActions";
import InvestmentPerformance from "./detail/InvestmentPerformance";
import AdditionalProducts from "./detail/AdditionalProducts";
import TechnicalAnnexes from "./detail/TechnicalAnnexes";
import StageDetailSheet from "./StageDetailSheet";
import PagoFinalSheet from "./detail/PagoFinalSheet";
import EscrituracionSheet from "./detail/EscrituracionSheet";
import EntregaSheet from "./detail/EntregaSheet";
import PaymentsSheet from "./PaymentsSheet";
import MaintenanceModule from "./MaintenanceModule";
import ConstructionProgress from "./detail/ConstructionProgress";
import ResaleFlow from "./resale/ResaleFlow";
import DaikuPaymentCenter from "./DaikuPaymentCenter";
import SupportLauncher from "./support/SupportLauncher";
import WarrantyBlock from "./post-delivery/WarrantyBlock";
import IncidentsBlock from "./post-delivery/IncidentsBlock";
import ManualsBlock from "./post-delivery/ManualsBlock";
import type { SupportContext } from "@/lib/offers/advisor-data";
import type { InvestmentProperty, StageInfo } from "@/lib/offers/mock-data";
import { getPropertyStatus } from "@/lib/offers/mock-data";
import { usePaymentPlan, getNextInstallment, getLastPaidInstallment } from "@/lib/offers/payment-data";
import { getConstructionProgress, shouldShowConstructionProgress } from "@/lib/offers/construction-progress-data";

type DetailView = "main" | "technical" | "payment-instructions" | "resale";

interface PropertyDetailViewProps {
  investment: InvestmentProperty;
  onBack: () => void;
}

const PropertyDetailView = ({ investment, onBack }: PropertyDetailViewProps) => {
  const { property, financials, stages } = investment;
  const urlState = usePropertyDetailUrlState();

  const selectedStage = urlState.stage
    ? stages.find((s) => s.id === urlState.stage) ?? null
    : null;
  const paymentsOpen = urlState.sheet === "payments";
  const detailView = urlState.view;
  const isResaleFlow = urlState.flow === "resale";

  const status = getPropertyStatus(investment);
  const progress = financials.initialPrice > 0 ? (financials.totalPaid / financials.initialPrice) * 100 : 0;
  const isDelivered = status.label === "Entregada";
  const currentStage = stages.find((s) => s.status === "active") || stages[0];

  // STP payment plan
  const paymentPlan = usePaymentPlan(property.id);
  const nextInstallment = paymentPlan ? getNextInstallment(paymentPlan) : undefined;
  const lastPaid = paymentPlan ? getLastPaidInstallment(paymentPlan) : undefined;
  const isPreventaOrPago = currentStage.id === "preventa" || currentStage.id === "pago_final";
  const hasSTPFlow = !!paymentPlan && isPreventaOrPago;

  // Defensive: clean invalid stage id from URL
  useEffect(() => {
    if (urlState.stage && !selectedStage) {
      urlState.set({ stage: null }, { replace: true });
    }
  }, [urlState, selectedStage]);

  // Mutual exclusion enforcement (priority: flow > sheet > stage)
  useEffect(() => {
    const hasStage = !!urlState.stage;
    const hasSheet = !!urlState.sheet;
    const hasFlow = !!urlState.flow;
    const conflict =
      (hasStage && hasFlow) || (hasSheet && hasFlow) || (hasStage && hasSheet);
    if (!conflict) return;
    if (hasFlow) urlState.set({ stage: null, sheet: null }, { replace: true });
    else if (hasSheet) urlState.set({ stage: null }, { replace: true });
  }, [urlState]);

  const handleStartResale = () =>
    urlState.set({ flow: "resale", step: "intro" });

  const handleCloseResale = () =>
    urlState.set({ flow: null, step: null, scenario: null }, { replace: true });

  const handleAction = (action: string) => {
    switch (action) {
      case "payments":
        urlState.set({ sheet: "payments" }, { replace: true });
        break;
      case "balance":
        if (hasSTPFlow) {
          urlState.set({ view: "payment-instructions" });
        } else {
          urlState.set({ stage: "pago_final" }, { replace: true });
        }
        break;
      case "details":
        urlState.set({ view: "technical" });
        break;
      case "resale":
        handleStartResale();
        break;
    }
  };

  const handleStageCtaAction = (action: string) => {
    if (action === "resale") {
      urlState.set({ stage: null }, { replace: true });
      handleStartResale();
    }
  };

  const handleStageClose = () =>
    urlState.set({ stage: null }, { replace: true });

  if (isResaleFlow) {
    return <ResaleFlow property={investment} onClose={handleCloseResale} />;
  }

  if (detailView === "technical") {
    return (
      <div className="pb-24 animate-fade-in">
        <PropertyDetailHeader
          projectName={property.projectName}
          unitNumber={property.unitNumber}
          statusLabel="Anexos técnicos"
          statusColor="primary"
          onBack={() => urlState.set({ view: "main" })}
        />
        <TechnicalAnnexes propertyId={property.id} />
      </div>
    );
  }

  if (detailView === "payment-instructions" && paymentPlan && nextInstallment) {
    return (
      <PaymentInstructionsView
        stpInfo={paymentPlan.stpInfo}
        installment={nextInstallment}
        onBack={() => urlState.set({ view: "main" })}
      />
    );
  }

  return (
    <div className="pb-24 animate-fade-in">
      {/* 1. Compact sticky header */}
      <PropertyDetailHeader
        projectName={property.projectName}
        unitNumber={property.unitNumber}
        statusLabel={status.label}
        statusColor={status.color}
        onBack={onBack}
      />

      {/* 2. Financial card — compact for STP flow */}
      <FinancialCard
        initialPrice={financials.initialPrice}
        totalPaid={financials.totalPaid}
        pendingBalance={financials.pendingBalance}
        appreciation={financials.estimatedAppreciation}
        progress={progress}
        hasPending={!hasSTPFlow && financials.pendingBalance > 0}
        onPayNow={() => handleAction("balance")}
        compact={hasSTPFlow}
      />

      {/* 3. STP: Next installment card (replaces old NextActionBlock for preventa) */}
      {hasSTPFlow && nextInstallment && (
        <NextInstallmentCard
          installment={nextInstallment}
          installmentLabel={`Parcialidad ${nextInstallment.number} de ${paymentPlan.totalInstallments}`}
          onViewInstructions={() => urlState.set({ view: "payment-instructions" })}
        />
      )}

      {/* 3b. STP: Last payment status tracker */}
      {hasSTPFlow && lastPaid && (
        <PaymentStatusTracker installment={lastPaid} paymentPlan={paymentPlan} investment={investment} />
      )}

      {/* 3c. Non-STP: original next action block */}
      {!hasSTPFlow && (
        <NextActionBlock
          currentStage={currentStage}
          onAction={() =>
            currentStage.cta?.action === "resale"
              ? handleStartResale()
              : urlState.set({ stage: currentStage.id }, { replace: true })
          }
        />
      )}

      {/* 4. Investment stepper */}
      <InvestmentStepper stages={stages} onStageTap={(s) => urlState.set({ stage: s.id }, { replace: true })} />

      {/* 4b. Daiku-style installments payment center (preventa + multi-installment) */}
      {currentStage?.id === "preventa" && paymentPlan && paymentPlan.totalInstallments > 1 && (
        <DaikuPaymentCenter property={investment} plan={paymentPlan} />
      )}

      {/* 5. Additional products */}
      {investment.additionalProducts && investment.additionalProducts.length > 0 && (
        <AdditionalProducts products={investment.additionalProducts} />
      )}

      {/* 5b. Construction progress (preventa/escrituracion/entrega only) */}
      {shouldShowConstructionProgress(currentStage?.id) &&
        getConstructionProgress(property.id) && (
          <div id="construction-progress">
            <ConstructionProgress data={getConstructionProgress(property.id)!} />
          </div>
        )}

      {/* 6. Quick actions by category */}
      <DetailQuickActions onAction={handleAction} isDelivered={isDelivered} />

      {/* Maintenance (if delivered) */}
      {isDelivered && investment.maintenance && (
        <MaintenanceModule
          maintenance={investment.maintenance}
          investment={investment}
          onResaleClick={handleStartResale}
        />
      )}

      {/* Post-entrega: garantía + manuales */}
      {currentStage?.id === "post_entrega" && (
        <>
          <WarrantyBlock propertyId={property.id} />
          <IncidentsBlock propertyId={property.id} />
          <ManualsBlock propertyId={property.id} />
        </>
      )}

      {/* Investment performance expandable */}
      <InvestmentPerformance financials={financials} />

      {/* Pago Final enhanced sheet */}
      {selectedStage?.id === "pago_final" ? (
        <PagoFinalSheet
          stage={selectedStage}
          investment={investment}
          open={!!selectedStage}
          onClose={handleStageClose}
          onViewPaymentInstructions={hasSTPFlow ? () => urlState.set({ view: "payment-instructions" }) : undefined}
        />
      ) : selectedStage?.id === "escrituracion" ? (
        <EscrituracionSheet
          stage={selectedStage}
          investment={investment}
          open={!!selectedStage}
          onClose={handleStageClose}
        />
      ) : selectedStage?.id === "entrega" ? (
        <EntregaSheet
          stage={selectedStage}
          investment={investment}
          open={!!selectedStage}
          onClose={handleStageClose}
        />
      ) : (
        <StageDetailSheet
          stage={selectedStage}
          open={!!selectedStage}
          onClose={handleStageClose}
          onCtaAction={handleStageCtaAction}
        />
      )}
      <PaymentsSheet
        open={paymentsOpen}
        onClose={() => urlState.set({ sheet: null }, { replace: true })}
        payments={investment.payments}
      />

      <div className="px-4 mt-6">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          ¿Tienes preguntas sobre tu propiedad?
        </p>
        <SupportLauncher
          context={{
            propertyId: property.id,
            propertyName: property.projectName,
            unitNumber: property.unitNumber,
            flowName: `Detalle ${currentStage?.label ?? ""}`.trim(),
          } satisfies SupportContext}
          variant="expanded"
        />
      </div>
    </div>
  );
};

export default PropertyDetailView;
