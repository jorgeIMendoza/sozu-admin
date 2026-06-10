import { FileText, HelpCircle, MessageCircle } from "lucide-react";
import { generateContratoText, type ContratoSection } from "@/lib/offers/contrato-template";
import type { FormalReservation } from "@/lib/offers/formal-reservation-data";
import { getOfferById } from "@/lib/offers/offer-data";

const ADVISOR_PHONE = "523310137670";
const ADVISOR_NAME = "Ramón";

const resolveOfferLabels = (fr: FormalReservation) => {
  const offer = getOfferById(fr.offerId);
  return {
    developmentName: offer?.property?.projectName ?? "Tu unidad",
    propertyLabel: offer
      ? `${offer.property.unitModel} ${offer.property.unitNumber}`
      : "Sin código",
  };
};

/**
 * Versión simplificada del contrato para el periodo provisional, cuando el cliente todavía no
 * tiene plan de pagos elegido. La cláusula 3 se marca como "pendiente de definir".
 */
const generatePartialContratoText = (
  fr: FormalReservation,
  propertyLabel: string,
  developmentName: string
): ContratoSection[] => {
  const fi = fr.fiscalIdentity;
  const isMoral = false; // SWAP POINT: derivar de fi cuando se modele tipoComprador en fiscalIdentity

  return [
    {
      number: 1,
      title: "Declaraciones de las partes",
      body: `EL VENDEDOR: SOZU COMERCIALIZADORA SA DE CV, comercializador autorizado del desarrollo <strong>${developmentName}</strong>.

EL COMPRADOR: <strong>${fi?.legalName ?? "[Nombre pendiente]"}</strong>, identificado con RFC <strong>${fi?.rfc ?? "[RFC pendiente]"}</strong>, persona ${isMoral ? "moral" : "física"}. Los datos personales adicionales (CURP, estado civil, ocupación, domicilio) se confirmarán al completar tu expediente.`,
    },
    {
      number: 2,
      title: "Objeto del contrato",
      body: `EL VENDEDOR se obliga a transferir a EL COMPRADOR la propiedad de la unidad <strong>${propertyLabel}</strong>, ubicada en el desarrollo <strong>${developmentName}</strong>, conforme a las especificaciones, planos y memoria descriptiva.`,
    },
    {
      number: 3,
      title: "Precio y forma de pago",
      highlight: true,
      body: `⚠️ <strong>Esta cláusula se completará cuando elijas tu plan de pagos definitivo.</strong>

Al completar tu apartado con la transferencia SPEI por $20,000 MXN, podrás elegir entre los esquemas F1 a F6 (con descuentos progresivos). El plan determinará precio final, enganche, mensualidades y saldo a la entrega. Todos los esquemas están detallados en tu oferta digital.`,
    },
    {
      number: 4,
      title: "Plazo y entrega",
      highlight: true,
      body: `EL VENDEDOR estima la entrega física conforme al cronograma de avance de obra del desarrollo. La fecha estimada se confirmará en tu expediente. Cualquier modificación deberá notificarse con al menos 30 días naturales de anticipación, conforme a PROFECO.`,
    },
    {
      number: 5,
      title: "Obligaciones del comprador",
      body: `EL COMPRADOR se obliga a: (i) realizar los pagos conforme al plan elegido; (ii) mantener actualizada su información fiscal; (iii) suscribir el contrato definitivo una vez completado el pago total; (iv) cubrir gastos de escrituración, impuestos y honorarios notariales que correspondan.`,
    },
    {
      number: 6,
      title: "Obligaciones del vendedor",
      body: `EL VENDEDOR se obliga a: (i) entregar la unidad libre de gravámenes, hipotecas o embargos; (ii) tramitar la escritura pública una vez cubierto el precio total; (iii) entregar conforme a especificaciones pactadas; (iv) responder por vicios ocultos conforme a la Cláusula Octava.`,
    },
    {
      number: 7,
      title: "Penalidades por incumplimiento",
      highlight: true,
      body: `<strong>Atraso del comprador:</strong> intereses moratorios equivalentes a TIIE 28 días + 5 puntos porcentuales sobre el saldo insoluto desde la fecha de vencimiento.

<strong>Cancelación:</strong> si EL COMPRADOR cancela sin causa justificada después de pagado el apartado, EL VENDEDOR retendrá hasta <strong>20%</strong> de los montos pagados como pena convencional, reembolsando el restante en máximo 60 días.`,
    },
    {
      number: 8,
      title: "Garantía de vicios ocultos",
      body: `Conforme a artículos 2142-2161 del Código Civil Federal, EL VENDEDOR garantiza la unidad contra vicios ocultos por <strong>1 año</strong> desde la entrega física. EL COMPRADOR notificará dentro de 30 días naturales del descubrimiento. No cubre desgaste natural, uso indebido o modificaciones posteriores.`,
    },
  ];
};

const ContratoPreliminarReadSection = ({
  formalReservation,
  readOnly = false,
}: {
  formalReservation: FormalReservation;
  readOnly?: boolean;
}) => {
  const { developmentName, propertyLabel } = resolveOfferLabels(formalReservation);

  const hasFullData =
    !!formalReservation.fiscalIdentity &&
    !!formalReservation.expediente?.datosPersonales?.data &&
    !!formalReservation.expediente?.planPagos?.data;

  const sections: ContratoSection[] = hasFullData
    ? generateContratoText(formalReservation, propertyLabel, developmentName)
    : generatePartialContratoText(formalReservation, propertyLabel, developmentName);

  const handleQuestionAboutClause = (clauseNumber: number, clauseTitle: string) => {
    const clientName = formalReservation.fiscalIdentity?.legalName ?? "cliente";
    const msg = encodeURIComponent(
      `Hola ${ADVISOR_NAME}, soy ${clientName} (apartado ${formalReservation.id}). Tengo una duda sobre la Cláusula ${clauseNumber}: "${clauseTitle}". ¿Podrías ayudarme a entenderla?`
    );
    window.open(`https://wa.me/${ADVISOR_PHONE}?text=${msg}`, "_blank");
  };

  const handleGeneralQuestion = () => {
    const clientName = formalReservation.fiscalIdentity?.legalName ?? "cliente";
    const msg = encodeURIComponent(
      `Hola ${ADVISOR_NAME}, soy ${clientName} (apartado ${formalReservation.id}). Tengo dudas sobre el contrato preliminar.`
    );
    window.open(`https://wa.me/${ADVISOR_PHONE}?text=${msg}`, "_blank");
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Contrato preliminar</h2>
        </div>
        <button
          type="button"
          onClick={handleGeneralQuestion}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card border border-border text-[11px] font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          <MessageCircle className="w-3 h-3" />
          Tengo dudas
        </button>
      </div>

      <div className="p-5 sm:p-7">
        <div className="text-center pb-5 mb-5 border-b border-border">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Contrato preliminar de compraventa
          </p>
          <h3 className="text-lg font-bold text-foreground">
            {developmentName} · {propertyLabel}
          </h3>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Apartado provisional · ID {formalReservation.id}
          </p>
        </div>

        <div className="space-y-5">
          {sections.map((sec) => (
            <div
              key={sec.number}
              className={`rounded-xl ${sec.highlight ? "border border-primary/20 bg-primary/[0.03] p-4" : "p-1"}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Cláusula {sec.number}
                  </p>
                  <h4 className="text-sm font-semibold text-foreground mt-0.5">{sec.title}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuestionAboutClause(sec.number, sec.title)}
                  title={`Preguntar sobre la cláusula ${sec.number}`}
                  className="w-7 h-7 rounded-full bg-muted hover:bg-primary/10 flex items-center justify-center flex-shrink-0 transition-colors group"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                </button>
              </div>
              <p
                className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: sec.body }}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-border">
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Este contrato preliminar resume los términos de tu compraventa. La versión definitiva,
            con el plan de pagos específico que elijas, se generará para firma con e.firma SAT
            después de completar tu apartado.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContratoPreliminarReadSection;
