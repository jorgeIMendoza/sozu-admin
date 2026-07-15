import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  BadgeCheck,
  Building2,
  CreditCard,
  Info,
  Landmark,
  CalendarCheck,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCcw,
} from "lucide-react";
import type { StageInfo, InvestmentProperty } from "@/lib/portal-cliente/mock-data";
import {
  getMortgageProcess,
  saveMortgageProcess,
  clearMortgageProcess,
  getPreValidationStatusInfo,
  type MortgageChoice,
  type MortgageProcess,
  type SelectedBank,
  type PreValidationStatus,
  type StatusInfo,
  type StatusTone,
  type PrequalificationData,
} from "@/lib/portal-cliente/mortgage-data";
import PreQualificationFlow from "./PreQualificationFlow";
import SupportLauncher from "@/components/admin/portal-cliente/support/SupportLauncher";
import type { SupportContext } from "@/lib/portal-cliente/advisor-data";
import { toast } from "sonner";
import {
  useSolicitudCreditoVigente,
  useCrearSolicitudCredito,
  puedeCambiarBanco,
  type SolicitudCredito,
  type SolicitudEstatus,
} from "@/hooks/usePortalBancos/useSolicitudesCredito";
import { useBancosConvenio } from "@/hooks/usePortalBancos/useBancosConvenio";

interface PagoFinalSheetProps {
  stage: StageInfo;
  investment: InvestmentProperty;
  open: boolean;
  onClose: () => void;
  onViewPaymentInstructions?: () => void;
}

type Step = "method" | "mortgage-select" | "prequalification" | "status";

type PaymentMethod = "propios" | "credito" | null;

// Tone → tailwind class fragments
const toneStyles: Record<
  StatusTone,
  { card: string; iconWrap: string; iconColor: string; label: string }
> = {
  info: {
    card: "border-primary/20 bg-primary/5",
    iconWrap: "bg-primary/10",
    iconColor: "text-primary",
    label: "text-primary",
  },
  success: {
    card: "border-success/20 bg-success/5",
    iconWrap: "bg-success/10",
    iconColor: "text-success",
    label: "text-success",
  },
  warning: {
    card: "border-warning/20 bg-warning/5",
    iconWrap: "bg-warning/10",
    iconColor: "text-warning",
    label: "text-warning",
  },
  destructive: {
    card: "border-destructive/20 bg-destructive/5",
    iconWrap: "bg-destructive/10",
    iconColor: "text-destructive",
    label: "text-destructive",
  },
};

const toneIcon = (tone: StatusTone) => {
  switch (tone) {
    case "success":
      return CheckCircle2;
    case "destructive":
      return AlertCircle;
    case "warning":
    case "info":
    default:
      return Clock;
  }
};

import MortgageBankSelector from "./MortgageBankSelector";

// Mapea el estatus de la solicitud persistida al estado que pinta el status card.
const estatusToPreStatus = (e: SolicitudEstatus): PreValidationStatus => {
  switch (e) {
    case "rechazado":
      return "rejected";
    case "formalizado":
      return "completed";
    case "pre_aprobado":
    case "oferta_vinculante":
      return "pre_approved";
    default:
      return "in_progress"; // solicitud ya enviada, banco revisando
  }
};

// Reconstruye el MortgageProcess desde la solicitud persistida en BD.
// Necesario tras logout/login o recarga: el store en memoria se pierde, pero la
// selección de banco es la de `bancos_solicitudes` (fuente de verdad).
const buildProcessFromSolicitud = (
  propertyId: string,
  s: SolicitudCredito,
  bancos: ReturnType<typeof useBancosConvenio>["data"],
): MortgageProcess => {
  const banco = bancos?.find((b) => b.id_banco === s.id_banco);
  const bank: SelectedBank = {
    idBanco: s.id_banco,
    nombre: banco?.nombre ?? `Banco ${s.id_banco}`,
    rates: {
      tasaMin: banco?.tasa_min ?? null,
      tasaMax: banco?.tasa_max ?? null,
      catMin: banco?.cat_min ?? null,
      catMax: banco?.cat_max ?? null,
    },
  };
  const prequalification: PrequalificationData = {
    idBanco: s.id_banco,
    bankName: bank.nombre,
    montoFinanciar: s.monto_financiar,
    plazoAnios: s.plazo_anios,
    estimatedMonthlyMin: s.mensualidad_estimada_min ?? undefined,
    estimatedMonthlyMax: s.mensualidad_estimada_max ?? undefined,
    estimatedRateMin: s.tasa_estimada_min ?? undefined,
    estimatedRateMax: s.tasa_estimada_max ?? undefined,
    estimatedCatMin: s.cat_estimado_min ?? undefined,
    estimatedCatMax: s.cat_estimado_max ?? undefined,
    consentimientoCompartirDatos: true,
    submittedAt: s.fecha_envio,
  };
  return {
    propertyId,
    declaredAt: s.fecha_envio,
    choice: { type: "preferred", bank },
    preferredStatus: estatusToPreStatus(s.estatus),
    prequalification,
  };
};

const PagoFinalSheet = ({
  stage,
  investment,
  open,
  onClose,
  onViewPaymentInstructions,
}: PagoFinalSheetProps) => {
  const { financials, property } = investment;
  const cuentaId = Number(property.id);
  const queryClient = useQueryClient();
  const { data: solicitudVigente } = useSolicitudCreditoVigente(cuentaId);
  const { data: bancos } = useBancosConvenio();
  const crearSolicitud = useCrearSolicitudCredito();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<PaymentMethod>(null);
  const [process, setProcess] = useState<MortgageProcess | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const isFullyPaid = financials.pendingBalance <= 0;

  // Hydrate persisted mortgage process when sheet opens.
  // Prioridad: (1) store en memoria; (2) solicitud persistida en BD — sobrevive
  // logout/login y recarga, y BLOQUEA re-selección de banco (la selección es
  // definitiva mientras el banco responde); (3) crédito elegido sin solicitud
  // aún enviada → permitir elegir banco; (4) método sin definir.
  useEffect(() => {
    if (!open) return;
    const existing = getMortgageProcess(property.id);
    if (existing) {
      setProcess(existing);
      setStep("status");
      setMethod("credito");
    } else if (solicitudVigente) {
      // Solicitud ya enviada al banco: reconstruir desde BD y mostrar estatus.
      // handleChangeBank / canChangeBank aplican el gate puedeCambiarBanco.
      setProcess(buildProcessFromSolicitud(property.id, solicitudVigente, bancos));
      setMethod("credito");
      setStep("status");
    } else if (property.tipoFinanciamiento === "CREDITO_HIPOTECARIO") {
      // Eligió crédito pero aún no envía solicitud: mostrar selector de banco.
      setProcess(null);
      setMethod("credito");
      setStep("mortgage-select");
    } else {
      setProcess(null);
      setStep("method");
      setMethod(null);
    }
  }, [open, property.id, property.tipoFinanciamiento, solicitudVigente, bancos]);

  const handleClose = () => {
    onClose();
  };

  const handlePropiosAction = async () => {
    await (supabase as any)
      .from('cuentas_cobranza')
      .update({ tipo_financiamiento: 'RECURSOS_PROPIOS' })
      .eq('id', cuentaId);
    queryClient.invalidateQueries({ queryKey: ['portfolio-cliente'] });
    if (onViewPaymentInstructions) {
      onClose();
      setTimeout(() => onViewPaymentInstructions(), 200);
    }
  };

  const handleConfirmMortgage = async (choice: MortgageChoice) => {
    const newProcess: MortgageProcess = {
      propertyId: property.id,
      declaredAt: new Date().toISOString(),
      choice,
      preferredStatus: "not_started",
    };
    saveMortgageProcess(newProcess);
    setProcess(newProcess);

    await (supabase as any)
      .from('cuentas_cobranza')
      .update({ tipo_financiamiento: 'CREDITO_HIPOTECARIO' })
      .eq('id', cuentaId);

    await (supabase as any)
      .from('creditos_hipotecarios')
      .upsert(
        { id_cuenta_cobranza: cuentaId, id_banco: choice.bank.idBanco, monto_credito: 0 },
        { onConflict: 'id_cuenta_cobranza' },
      );

    queryClient.invalidateQueries({ queryKey: ['portfolio-cliente'] });
    setStep("prequalification");
  };

  const handlePrequalificationComplete = (data: PrequalificationData) => {
    setProcess((prev) => {
      if (!prev) return prev;
      const updated: MortgageProcess = {
        ...prev,
        prequalification: data,
        preferredStatus: "in_progress",
        lastUpdate: new Date().toISOString(),
      };
      saveMortgageProcess(updated);
      return updated;
    });

    // Persistir el lead en BD (graceful: si la tabla no existe, sigue en memoria)
    crearSolicitud.mutate({ cuentaId, idBanco: data.idBanco, data });

    setStep("status");
  };

  const handleChangeBank = () => {
    // El banco es dueño del cambio: solo se permite si la solicitud expiró
    // (SLA cumplido) o fue rechazada. SLA null/<1 → selección definitiva.
    if (!puedeCambiarBanco(solicitudVigente)) {
      toast.info(
        solicitudVigente?.fecha_expiracion
          ? "Tu solicitud sigue vigente con el banco. Podrás cambiar cuando el banco responda o venza el plazo."
          : "La selección de banco es definitiva y no puede cambiarse.",
      );
      return;
    }
    clearMortgageProcess(property.id);
    setProcess(null);
    setStep("mortgage-select");
  };

  const sheetSideClass = isDesktop
    ? "w-full max-w-[520px] overflow-y-auto [&>button:last-child]:hidden"
    : "rounded-t-2xl max-h-[75dvh] overflow-y-auto [&>button:last-child]:hidden";

  // ── Fully paid state ──
  if (isFullyPaid) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          className={`${sheetSideClass} px-5 pb-8`}
        >
          <div className="flex flex-col items-center text-center pt-6 pb-4 gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <BadgeCheck className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">
                Unidad liquidada
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                {property.projectName} {property.unitNumber} está 100% pagada. Ya
                puedes agendar tu cita de escrituración y entrega.
              </p>
            </div>
            <Button className="w-full mt-2 rounded-xl h-12 text-sm font-semibold gap-2">
              <CalendarCheck className="w-4 h-4" />
              Agendar cita de escrituración
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Status card renderer ──
  const renderStatus = () => {
    if (!process) return null;
    const bankName = process.choice.bank.nombre;
    const statusInfo: StatusInfo = getPreValidationStatusInfo(process.preferredStatus || "not_started");
    const tone = toneStyles[statusInfo.tone];
    const StatusIcon = toneIcon(statusInfo.tone);

    const preq = process.prequalification;
    const hasEstimate = preq?.estimatedMonthlyMin != null;
    const formattedSubmitted = preq
      ? new Date(preq.submittedAt).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
    const fmtN = (n: number) =>
      n.toLocaleString("es-MX", { maximumFractionDigits: 0 });

    // Solo se puede cambiar de banco si existe una solicitud persistida cuyo
    // SLA venció o fue rechazada. Sin SLA definido (o sin persistencia) → definitivo.
    const canChangeBank = !!solicitudVigente && puedeCambiarBanco(solicitudVigente);

    const nextSteps = [
      preq
        ? `Tu solicitud de crédito fue enviada a ${bankName} el ${formattedSubmitted}.`
        : `Envía tu solicitud a ${bankName} para iniciar tu crédito.`,
      `El banco revisará tu solicitud y te contactará con un broker dedicado.`,
      `SOZU coordinará con ${bankName} y el notario para tu escrituración.`,
    ];

    return (
      <div className="mt-5 space-y-4 animate-fade-in">
        {/* Main status card */}
        <div className={`p-4 rounded-xl border ${tone.card}`}>
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-lg ${tone.iconWrap} flex items-center justify-center flex-shrink-0`}
            >
              <StatusIcon className={`w-5 h-5 ${tone.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-[10px] font-semibold uppercase tracking-widest ${tone.label}`}
              >
                {statusInfo.label}
              </p>
              <p className="font-display font-semibold text-sm text-foreground mt-1">
                Crédito hipotecario · {bankName}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {statusInfo.description}
              </p>
            </div>
          </div>
        </div>

        {/* Solicitud enviada - resumen con estimación (solo si el banco tiene tasas) */}
        {preq && hasEstimate && (
          <div className="p-4 rounded-xl border border-border space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Estimación enviada a {bankName}
              </p>
              <p className="text-[10px] text-muted-foreground">{formattedSubmitted}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Mensualidad estimada
              </p>
              <p className="font-display font-bold text-lg text-foreground tabular-nums mt-0.5">
                ${fmtN(preq.estimatedMonthlyMin!)} - ${fmtN(preq.estimatedMonthlyMax!)}{" "}
                <span className="text-xs font-normal text-muted-foreground">MXN/mes</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Monto</p>
                <p className="text-xs font-medium text-foreground tabular-nums mt-0.5">
                  ${fmtN(preq.montoFinanciar)} MXN
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Plazo</p>
                <p className="text-xs font-medium text-foreground mt-0.5">{preq.plazoAnios} años</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tasa</p>
                <p className="text-xs font-medium text-foreground tabular-nums mt-0.5">
                  {preq.estimatedRateMin}% - {preq.estimatedRateMax}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">CAT</p>
                <p className="text-xs font-medium text-foreground tabular-nums mt-0.5">
                  {preq.estimatedCatMin != null && preq.estimatedCatMax != null
                    ? `${preq.estimatedCatMin}% - ${preq.estimatedCatMax}%`
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lo que sigue */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground mb-3">
            Lo que sigue
          </p>
          <ol className="space-y-2.5">
            {nextSteps.map((s, i) => (
              <li key={i} className="flex gap-3 text-xs leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-foreground/90 text-background flex items-center justify-center text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="text-foreground/80 pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {!preq && (
            <Button
              className="w-full rounded-xl h-12 text-sm font-semibold gap-2"
              onClick={() => setStep("prequalification")}
            >
              <Landmark className="w-4 h-4" />
              Enviar solicitud a {bankName}
            </Button>
          )}
          {preq && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-foreground/80 leading-relaxed">
                Tu solicitud fue enviada el {formattedSubmitted}. El broker se pondrá en contacto contigo lo antes posible.
              </p>
            </div>
          )}
          {canChangeBank && (
            <Button
              variant="outline"
              className="w-full rounded-xl h-11 text-sm font-medium gap-2"
              onClick={handleChangeBank}
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Cambiar banco
            </Button>
          )}
          <button
            onClick={handleClose}
            className="w-full h-10 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  };

  // ── Method step renderer ──
  const renderMethod = () => (
    <div className="animate-fade-in">
      <div className="mt-5 p-4 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Requisito para escrituración y entrega
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Para agendar tu cita de escrituración y entrega del departamento, tu
              unidad debe estar liquidada en su totalidad.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-foreground mb-1">
          ¿Cómo terminarás de pagar tu departamento?
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Tu elección nos permitirá preparar correctamente el proceso de
          escrituración.
        </p>

        <RadioGroup
          value={method || ""}
          onValueChange={(v) => setMethod(v as PaymentMethod)}
          className="gap-3"
        >
          <label
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              method === "propios"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-primary/30"
            }`}
          >
            <RadioGroupItem value="propios" />
            <Building2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Recursos propios</p>
              <p className="text-xs text-muted-foreground">
                Transferencia interbancaria por STP
              </p>
            </div>
          </label>

          <label
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              method === "credito"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-primary/30"
            }`}
          >
            <RadioGroupItem value="credito" />
            <Landmark className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Crédito hipotecario
              </p>
              <p className="text-xs text-muted-foreground">
                Financiamiento con una institución bancaria
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <div className="mt-6">
        {!method && (
          <Button disabled className="w-full rounded-xl h-12 text-sm">
            Selecciona un método de pago
          </Button>
        )}
        {method === "propios" && (
          <Button
            className="w-full rounded-xl h-12 text-sm font-semibold gap-2"
            onClick={handlePropiosAction}
          >
            Ver instrucciones de pago
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
        {method === "credito" && (
          <Button
            className="w-full rounded-xl h-12 text-sm font-semibold gap-2"
            onClick={() => setStep("mortgage-select")}
          >
            Continuar
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={`${sheetSideClass} px-5 pb-8`}
      >
        <SheetHeader className="text-left pb-3">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <SheetTitle className="text-foreground font-display">
                Pago final
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {property.projectName} {property.unitNumber}
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Financial summary */}
        <div className="flex justify-between items-center py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">Saldo a liquidar</span>
          <span className="text-lg font-bold text-foreground tabular-nums">
            ${financials.pendingBalance.toLocaleString("es-MX")} MXN
          </span>
        </div>
        {stage.details?.["Fecha límite"] && (
          <div className="flex justify-between items-center py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Fecha objetivo</span>
            <span className="text-sm font-medium text-foreground">
              {stage.details["Fecha límite"]}
            </span>
          </div>
        )}

        {step === "method" && renderMethod()}
        {step === "mortgage-select" && (
          <div className="mt-5">
            <MortgageBankSelector
              onConfirm={handleConfirmMortgage}
              onBack={() => setStep("method")}
            />
          </div>
        )}
        {step === "prequalification" && process?.choice.type === "preferred" && (
          <div className="mt-5">
            <PreQualificationFlow
              bank={process.choice.bank}
              pendingBalance={financials.pendingBalance}
              onComplete={handlePrequalificationComplete}
              onCancel={() => {
                clearMortgageProcess(property.id);
                setProcess(null);
                setStep("mortgage-select");
              }}
            />
          </div>
        )}
        {step === "status" && renderStatus()}

        {!isFullyPaid && (() => {
          const supportContext: SupportContext = {
            propertyId: property.id,
            propertyName: property.projectName,
            unitNumber: property.unitNumber,
            flowName: "Pago Final",
            flowStep:
              method === "credito"
                ? `Crédito hipotecario${
                    process?.choice.type === "preferred"
                      ? ` (${process.choice.bank.nombre} seleccionado)`
                      : ""
                  }`
                : method === "propios"
                  ? "Financiamiento propio"
                  : "Eligiendo método de pago",
            phaseOverride: "pago_final",
          };
          return (
            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
                ¿Necesitas ayuda con esta decisión?
              </p>
              <SupportLauncher context={supportContext} variant="compact" />
            </div>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
};

export default PagoFinalSheet;
