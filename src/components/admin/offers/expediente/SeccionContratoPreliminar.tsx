import { useState } from "react";
import { CheckCircle2, ChevronDown, FileText, MessageCircle, ShieldCheck, Calendar, Eye, X } from "lucide-react";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";
import { generateContratoText } from "@/lib/offers/contrato-template";
import { getOfferById } from "@/lib/offers/offer-data";
import SeccionLocked from "./SeccionLocked";
import ContratoPreliminarReadSection from "@/components/admin/offers/apartado-provisional/ContratoPreliminarReadSection";

const ADVISOR_PHONE = "523310137670";
const ADVISOR_NAME = "Ramón";

const SeccionContratoPreliminar = ({ formalReservation }: { formalReservation: FormalReservation }) => {
  const acceptContrato = useFormalReservationStore((s) => s.acceptContrato);

  const seccion = formalReservation.expediente!.contratoPreliminar;
  const data = seccion.data;
  const isCompleted = seccion.status === "completed";
  const isLocked = seccion.status === "locked";

  const acceptedDuringProvisional = formalReservation.contratoAcceptedDuringProvisional;
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(!isCompleted && !isLocked && !acceptedDuringProvisional);

  const offer = getOfferById(formalReservation.offerId);
  const developmentName = offer?.property?.projectName ?? "Tu unidad";
  const propertyLabel = offer
    ? `${offer.property.unitModel} ${offer.property.unitNumber}`
    : "Sin código";

  const planData = formalReservation.expediente!.planPagos.data;
  const datosPersonales = formalReservation.expediente!.datosPersonales.data;
  const canGenerate = !!planData && !!datosPersonales && !!formalReservation.fiscalIdentity && !!formalReservation.propertyVirtualCLABE;

  const statusLabel = isCompleted ? "Aceptado" : isLocked ? "Bloqueada" : "Pendiente";

  const handleAccept = () => {
    if (!canGenerate) return;
    acceptContrato(formalReservation.id, {
      acceptedAt: new Date().toISOString(),
      contractVersion: "v1.0",
      contractHash: `SHA256-${Math.random().toString(36).substring(2, 14).toUpperCase()}`,
    });
    setExpanded(false);
  };

  const handleContactAdvisor = () => {
    const phone = "525510137670";
    const msg = encodeURIComponent(
      `Hola Isabel, soy ${formalReservation.fiscalIdentity?.legalName ?? "cliente"} (ID Cuenta ${formalReservation.cuentaCobranzaId}). Tengo dudas sobre el contrato preliminar de mi apartado.`,
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  if (isLocked) {
    return (
      <SeccionLocked
        number={5}
        title="Contrato preliminar"
        description="Revisa el borrador del contrato antes de firmar"
        status={seccion.status}
      />
    );
  }

  // (F.3.C) Si el contrato fue aceptado durante el periodo provisional,
  // renderear la sección como completada de fábrica con link a re-ver el contrato.
  if (acceptedDuringProvisional) {
    const acceptedDate = new Date(acceptedDuringProvisional);
    const formattedDate = acceptedDate.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formattedTime = acceptedDate.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const handleDudasModal = () => {
      const clientName = formalReservation.fiscalIdentity?.legalName ?? "cliente";
      const msg = encodeURIComponent(
        `Hola ${ADVISOR_NAME}, soy ${clientName} (apartado ${formalReservation.id}). Tengo dudas sobre el contrato preliminar que acepté.`,
      );
      window.open(`https://wa.me/${ADVISOR_PHONE}?text=${msg}`, "_blank");
    };

    return (
      <>
        <div className="rounded-2xl bg-card border-2 border-success/30 overflow-hidden">
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sección 5
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/15 text-success">
                  Completado en periodo provisional
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground mt-0.5">Contrato preliminar</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Aceptaste los términos durante tu periodo provisional, antes de hacer la transferencia SPEI.
              </p>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Fecha de aceptación
                </p>
                <p className="text-xs text-foreground mt-0.5">
                  {formattedDate} a las {formattedTime}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setContractModalOpen(true)}
              className="w-full h-10 rounded-xl bg-card border border-border text-foreground text-xs font-semibold hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Ver contrato aceptado
            </button>

            <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
              Si tienes dudas sobre alguna cláusula, contacta a tu asesor desde el panel de contacto.
            </p>
          </div>
        </div>

        {contractModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto"
            onClick={() => setContractModalOpen(false)}
          >
            <div
              className="bg-background rounded-2xl border border-border w-full max-w-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  <p className="text-sm font-semibold text-foreground truncate">Contrato preliminar aceptado</p>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                    Solo lectura
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setContractModalOpen(false)}
                  className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center flex-shrink-0"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-3 sm:p-5">
                <ContratoPreliminarReadSection formalReservation={formalReservation} readOnly />
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  Aceptado: {formattedDate} · {formattedTime}
                </p>
                <button
                  type="button"
                  onClick={handleDudasModal}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card border border-border text-[11px] font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <MessageCircle className="w-3 h-3" />
                  Tengo dudas
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }


  const sections = canGenerate
    ? generateContratoText(formalReservation, propertyLabel, developmentName)
    : [];

  return (
    <div className={`rounded-2xl bg-card border-2 overflow-hidden ${isCompleted ? "border-success/30" : "border-border"}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? "bg-success/15" : "bg-primary/10"}`}>
          {isCompleted ? <CheckCircle2 className="w-5 h-5 text-success" /> : <FileText className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sección 5</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isCompleted ? "text-success" : "text-primary"}`}>{statusLabel}</span>
          </div>
          <p className="text-sm font-semibold text-foreground">Contrato preliminar</p>
          {!expanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {isCompleted ? `Aceptado · ${data?.contractVersion}` : "Lee el contrato y acepta los términos para firmar"}
            </p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border">
          {isCompleted && data && (
            <div className="mt-4 p-4 rounded-xl bg-success/10 border border-success/20 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <p className="text-sm font-semibold text-foreground">Contrato aceptado</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Aceptado el {new Date(data.acceptedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })} · Versión {data.contractVersion}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/80 break-all">Hash: {data.contractHash}</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-background overflow-hidden mt-4">
            <div className="max-h-[480px] overflow-y-auto p-5 space-y-5">
              <div className="text-center pb-4 border-b border-border space-y-1">
                <p className="text-sm font-bold text-foreground uppercase tracking-wider">Contrato preliminar de compraventa</p>
                <p className="text-xs text-muted-foreground">{developmentName} · {propertyLabel}</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  ID Cuenta: {formalReservation.cuentaCobranzaId} · Generado {new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>

              {canGenerate ? (
                <div className="space-y-5">
                  {sections.map((sec) => (
                    <div
                      key={sec.number}
                      className={`space-y-1.5 ${sec.highlight ? "p-3 rounded-lg bg-primary/[0.03] border border-primary/15" : ""}`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Cláusula {sec.number}</p>
                      <p className="text-sm font-semibold text-foreground">{sec.title}</p>
                      <p
                        className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: sec.body }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Necesitas completar secciones 2 y 3 antes de generar el contrato.
                </p>
              )}
            </div>
            <div className="px-3 py-2 border-t border-border bg-muted/20 text-center">
              <p className="text-[10px] text-muted-foreground">↑ Desliza dentro del documento para leer todas las cláusulas</p>
            </div>
          </div>

          {!isCompleted && canGenerate && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleAccept}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Acepto los términos del contrato
              </button>
              <button
                type="button"
                onClick={handleContactAdvisor}
                className="w-full h-11 rounded-xl bg-card border border-border text-foreground text-xs font-semibold hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Tengo dudas — contactar a Isabel
              </button>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
            <ShieldCheck className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Contrato vinculante una vez aceptado. La firma con e.firma SAT (próxima sección) le da validez NOM-151.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeccionContratoPreliminar;
