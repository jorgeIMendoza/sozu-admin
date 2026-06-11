import { useState } from "react";
import { CheckCircle2, ChevronDown, Wallet, Clock, Calendar, Sparkles } from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import type { FormalReservation, PlanPagosData } from "@/lib/offers/formal-reservation-data";
import {
  PAYMENT_PLANS,
  computePlanDetails,
  generateExpedienteSchedule,
  type PlanPresetId,
} from "@/lib/offers/expediente-plans";

// SWAP POINT: en producción leer de offer.priceMXN
const FALLBACK_PRICE_MXN = 3500000;

const SeccionPlanPagos = ({ formalReservation }: { formalReservation: FormalReservation }) => {
  const setPlanPagos = useFormalReservationStore((s) => s.setPlanPagos);
  const unlockNextSections = useFormalReservationStore((s) => s.unlockNextSections);

  const seccion = formalReservation.expediente!.planPagos;
  const data = seccion.data;
  const isCompleted = seccion.status === "completed";
  const isInProgress = seccion.status === "in_progress";

  const [expanded, setExpanded] = useState(!isCompleted);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanPresetId | null>(
    data?.selectedPlanId ?? null,
  );

  const totalPrice = FALLBACK_PRICE_MXN;
  const statusLabel = isCompleted ? "Completada" : isInProgress ? "En progreso" : "Pendiente";

  const handleConfirmPlan = () => {
    if (!selectedPlanId) return;
    const apartadoPaidAt = formalReservation.payment?.detectedAt ?? new Date().toISOString();
    const planData = generateExpedienteSchedule(selectedPlanId, totalPrice, apartadoPaidAt);
    setPlanPagos(formalReservation.id, planData);
    unlockNextSections(formalReservation.id);
    setExpanded(false);
  };

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : isInProgress ? (
            <Clock className="w-4 h-4 text-warning" />
          ) : (
            <Wallet className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sección 3
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {statusLabel}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">Plan de pagos</p>
          {!expanded && data && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {PAYMENT_PLANS[data.selectedPlanId].name} · ${(data.totalPriceMXN / 1000000).toFixed(2)}M MXN
            </p>
          )}
          {!expanded && !data && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Elige cómo pagar el resto del precio total
            </p>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-border">
          {isCompleted && data ? (
            <PlanDetailView
              data={data}
              onChange={() => {
                setSelectedPlanId(data.selectedPlanId);
                // Re-open selection by temporarily clearing completion is handled via store; here we just allow user to re-select via cards re-render
              }}
              formalReservation={formalReservation}
            />
          ) : (
            <>
              <div className="pt-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Precio total de tu unidad:{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    ${totalPrice.toLocaleString("es-MX")} MXN
                  </span>
                  . Tu apartado de $20,000 ya aplica. Elige cómo pagar el resto.
                </p>
              </div>

              <div className="space-y-2">
                {(Object.keys(PAYMENT_PLANS) as PlanPresetId[]).map((planId) => {
                  const plan = PAYMENT_PLANS[planId];
                  const details = computePlanDetails(planId, totalPrice);
                  const isSelected = selectedPlanId === planId;
                  return (
                    <button
                      type="button"
                      key={planId}
                      onClick={() => setSelectedPlanId(planId)}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/[0.03]"
                          : "border-border bg-card hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                            {plan.badge && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                                <Sparkles className="w-2.5 h-2.5" />
                                {plan.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{plan.tagline}</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                            isSelected ? "border-primary bg-primary" : "border-border"
                          }`}
                        >
                          {isSelected && <div className="w-full h-full rounded-full ring-2 ring-card ring-inset" />}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <PlanCell
                          title="Enganche"
                          main={`$${(details.engancheTotal / 1000).toFixed(0)}K`}
                          sub={`$${(details.engancheRestante / 1000).toFixed(0)}K restante`}
                        />
                        <PlanCell
                          title="Mensualidades"
                          main={
                            plan.mensualidadesCount === 0
                              ? "Sin"
                              : `${plan.mensualidadesCount} × $${(details.mensualidadAmount / 1000).toFixed(0)}K`
                          }
                          sub={plan.mensualidadesCount === 0 ? "—" : "mensuales"}
                        />
                        <PlanCell
                          title="Entrega"
                          main={`$${(details.saldoEntrega / 1000).toFixed(0)}K`}
                          sub={`mes ${plan.deliveryMonthsAhead}`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedPlanId && (
                <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Vista previa del cronograma
                  </p>
                  <PlanTimelinePreview
                    planId={selectedPlanId}
                    totalPrice={totalPrice}
                    apartadoPaidAt={formalReservation.payment?.detectedAt ?? new Date().toISOString()}
                  />
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleConfirmPlan}
                  disabled={!selectedPlanId}
                  className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar plan de pagos
                </button>
                {!selectedPlanId && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Selecciona un plan para continuar
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const PlanCell = ({ title, main, sub }: { title: string; main: string; sub: string }) => (
  <div>
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</p>
    <p className="text-xs font-semibold text-foreground tabular-nums mt-0.5">{main}</p>
    <p className="text-[10px] text-muted-foreground">{sub}</p>
  </div>
);

const PlanTimelinePreview = ({
  planId,
  totalPrice,
  apartadoPaidAt,
}: {
  planId: PlanPresetId;
  totalPrice: number;
  apartadoPaidAt: string;
}) => {
  const planData = generateExpedienteSchedule(planId, totalPrice, apartadoPaidAt);
  const keyMilestones = [
    planData.schedule[0],
    planData.schedule.find((s) => s.type === "enganche_saldo"),
    planData.schedule.find((s) => s.type === "mensualidad"),
    planData.schedule[planData.schedule.length - 1],
  ].filter(Boolean) as typeof planData.schedule;

  return (
    <div className="space-y-0">
      {keyMilestones.map((item, idx) => {
        const isPaid = item.status === "pagado";
        const isLast = idx === keyMilestones.length - 1;
        return (
          <div key={item.id} className="relative flex gap-3 pb-4">
            {!isLast && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                isPaid ? "bg-success" : "bg-card border-2 border-border"
              }`}
            >
              {isPaid && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-xs font-semibold ${isPaid ? "text-success" : "text-foreground"}`}>
                  {item.concepto}
                </p>
                <p className="text-xs font-semibold tabular-nums text-foreground">
                  ${item.montoMXN.toLocaleString("es-MX")}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isPaid ? "Pagado el " : ""}
                {new Date(item.fechaProgramada).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PlanDetailView = ({
  data,
  formalReservation,
}: {
  data: PlanPagosData;
  onChange: () => void;
  formalReservation: FormalReservation;
}) => {
  const updateSeccionStatus = useFormalReservationStore((s) => s.updateSeccionStatus);
  const plan = PAYMENT_PLANS[data.selectedPlanId];
  const deliveryDate = new Date(data.estimatedDeliveryDate);

  const handleChangePlan = () => {
    updateSeccionStatus(formalReservation.id, "planPagos", "pending");
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="rounded-xl bg-success/10 border border-success/30 p-4 space-y-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <p className="text-sm font-semibold text-foreground">{plan.name} seleccionado</p>
        </div>
        <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DetailField label="Precio total" value={`$${data.totalPriceMXN.toLocaleString("es-MX")}`} />
        <DetailField label="Apartado ✓" value="$20,000 aplicados" highlight />
        <DetailField label="Saldo enganche" value={`$${data.engancheRestanteMXN.toLocaleString("es-MX")}`} />
        <DetailField label="Saldo entrega" value={`$${data.saldoEntregaMXN.toLocaleString("es-MX")}`} />
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/[0.04] border border-primary/20">
        <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
        <p className="text-xs text-foreground">
          Entrega estimada:{" "}
          <span className="font-semibold">
            {deliveryDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
          </span>
        </p>
      </div>

      <button
        type="button"
        onClick={handleChangePlan}
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        Cambiar plan
      </button>
    </div>
  );
};

const DetailField = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className={`rounded-lg border border-border p-3 ${highlight ? "bg-success/5" : "bg-card"}`}>
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
    <p
      className={`text-sm font-semibold tabular-nums mt-0.5 ${
        highlight ? "text-success" : "text-foreground"
      }`}
    >
      {value}
    </p>
  </div>
);

export default SeccionPlanPagos;
