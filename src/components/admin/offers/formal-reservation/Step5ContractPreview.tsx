import { useState, useMemo } from "react";
import {
  useFormalReservationStore,
  type FormalReservation,
} from "@/lib/offers/formal-reservation-data";
import { useOfferById, type PreReservation } from "@/lib/offers/offer-data";
import {
  ArrowRight,
  ArrowLeft,
  Download,
  AlertTriangle,
  ShieldCheck,
  FileText,
} from "lucide-react";

interface Props {
  formalReservation: FormalReservation;
  preReservation?: PreReservation;
}

const fmt = (n: number) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;

const Step5ContractPreview = ({ formalReservation }: Props) => {
  const setCurrentStep = useFormalReservationStore((s) => s.setCurrentStep);
  const offer = useOfferById(formalReservation.offerId);
  const [readConfirmed, setReadConfirmed] = useState(false);

  const personal = formalReservation.personalData ?? {};
  const buyerType = formalReservation.buyerType;
  const appliedAmount = formalReservation.appliedAmountMXN ?? 5000;

  const property = offer?.property;
  const development = offer?.development;
  const plan = offer?.paymentPlans.find((p) => p.id === formalReservation.selectedPlanId);
  const listPrice = property?.listPrice ?? 0;

  const finalPrice = plan?.finalPrice ?? listPrice;
  const downPayment = plan?.downPaymentAmount ?? 0;
  const remainingDownPayment = Math.max(0, downPayment - appliedAmount);
  const monthsCount = plan?.installments?.count ?? 0;
  const monthly = plan?.installments?.monthlyAmount ?? 0;
  const finalPayment = plan?.finalPaymentAmount ?? 0;

  const developerLegalName =
    development?.legalName ?? "Tallwood Desarrollos Inmobiliarios SA de CV";

  const todayLong = useMemo(
    () =>
      new Date().toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const buyerName =
    buyerType === "legal_entity" ? personal.companyName : personal.fullName;

  const buyerIdentifier =
    buyerType === "legal_entity"
      ? `RFC ${personal.companyRFC ?? "—"}`
      : buyerType === "individual_mexican"
      ? `RFC ${personal.rfc ?? "—"} · CURP ${personal.curp ?? "—"}`
      : `Pasaporte ${personal.passportNumber ?? "—"} (${personal.passportCountry ?? "—"})`;

  const addr = personal.address;
  const fullAddress = addr
    ? [
        addr.street,
        addr.exteriorNumber,
        addr.interiorNumber ? `int. ${addr.interiorNumber}` : "",
        addr.neighborhood ? `Col. ${addr.neighborhood}` : "",
        addr.zipCode ? `CP ${addr.zipCode}` : "",
        addr.municipality,
        addr.state,
        addr.country ?? "México",
      ]
        .filter(Boolean)
        .join(", ")
    : "[Domicilio del comprador]";

  const developmentName = property?.projectName ?? development?.legalName ?? "[Desarrollo]";
  const developmentAddress = offer?.location.address ?? "[Domicilio del desarrollo]";
  const unitNumber = property?.unitNumber ?? "[Unidad]";
  const area = property?.area ?? 0;
  const parking = property?.parkingSpots ?? 1;

  const handleContinue = () => {
    if (readConfirmed) setCurrentStep(formalReservation.id, 6);
  };

  const handleDownload = () => {
    // SWAP POINT: en producción, generar PDF real
    console.log("Descargar PDF del contrato preliminar", formalReservation.id);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Paso 5 de 6 · Contrato preliminar
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
          Revisa tu contrato preliminar
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Verifica que todos tus datos sean correctos. Si encuentras algún error, vuelve a los
          pasos anteriores y corrígelo antes de firmar.
        </p>
      </div>

      <div className="rounded-xl bg-warning/5 border border-warning/30 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Este es un contrato preliminar
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            La escritura definitiva se firmará ante notario al completar el pago.
            Revisa cuidadosamente — modificaciones posteriores requieren acuerdo de ambas partes.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">
              Contrato preliminar de compraventa
            </span>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-background border border-border text-foreground text-xs font-semibold hover:border-foreground/30 transition-colors flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar PDF
          </button>
        </div>

        <div className="max-h-[600px] overflow-y-auto bg-white">
          <div
            className="px-6 md:px-12 py-8 md:py-12 text-neutral-800 leading-relaxed space-y-5 text-[13px] md:text-[14px]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            <div className="text-center space-y-1 pb-4 border-b border-neutral-200">
              <h2 className="text-lg md:text-xl font-bold tracking-wide uppercase">
                Contrato preliminar de compraventa
              </h2>
              <p className="text-xs text-neutral-500">
                Folio: {formalReservation.id}
              </p>
            </div>

            <p className="text-justify">
              En la ciudad de Guadalajara, Jalisco, a {todayLong}, se celebra el presente
              Contrato Preliminar de Compraventa que celebran, por una parte,{" "}
              <strong>{developerLegalName}</strong>, representada por su apoderado legal, a quien
              en lo sucesivo se le denominará <strong>"EL VENDEDOR"</strong>; y por la otra parte,{" "}
              <strong>{buyerName ?? "[Comprador]"}</strong>, identificado con {buyerIdentifier},
              con domicilio en {fullAddress}, a quien en lo sucesivo se le denominará{" "}
              <strong>"EL COMPRADOR"</strong>, al tenor de las siguientes declaraciones y cláusulas.
            </p>

            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider">Declaraciones</h3>
              <p className="text-justify">
                <strong>I. Declara EL VENDEDOR:</strong> ser una sociedad legalmente constituida
                bajo las leyes de los Estados Unidos Mexicanos, con capacidad legal para celebrar
                el presente contrato y ser propietario del inmueble materia del mismo, identificado
                como {developmentName}, unidad {unitNumber}, comercializado a través de SOZU.
              </p>
              <p className="text-justify">
                <strong>II. Declara EL COMPRADOR:</strong> tener pleno conocimiento de las
                características de la unidad, haber recibido información completa sobre el
                desarrollo, contar con capacidad legal y económica para adquirir el inmueble, y que
                sus datos generales son verídicos.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider">Cláusulas</h3>

              <p className="text-justify">
                <strong>PRIMERA. Objeto.</strong> EL VENDEDOR se obliga a vender y EL COMPRADOR
                se obliga a comprar la unidad <strong>{unitNumber}</strong> del desarrollo{" "}
                <strong>{developmentName}</strong>, ubicada en {developmentAddress}, con una
                superficie aproximada de {area} m², incluyendo {parking} cajón
                {parking > 1 ? "es" : ""} de estacionamiento.
              </p>

              <p className="text-justify">
                <strong>SEGUNDA. Precio y forma de pago.</strong> El precio total pactado es de{" "}
                <strong>{fmt(finalPrice)}</strong>
                {plan && plan.discountPct > 0 && (
                  <>
                    {" "}
                    (con descuento del {plan.discountPct}% sobre el precio de lista de{" "}
                    {fmt(listPrice)} por aplicación del plan {plan.name})
                  </>
                )}
                , pagadero conforme al siguiente esquema:
              </p>

              <div className="pl-5 space-y-2">
                <p className="text-justify">
                  <strong>(a) Enganche:</strong> {fmt(downPayment)}, equivalente al{" "}
                  {plan?.downPaymentPct ?? 0}% del precio. De este monto, EL COMPRADOR ha aportado
                  previamente la cantidad de <strong>{fmt(appliedAmount)}</strong> como
                  pre-apartado, quedando un saldo pendiente de{" "}
                  <strong>{fmt(remainingDownPayment)}</strong> pagadero a la firma del presente
                  contrato.
                </p>
                <p className="text-justify">
                  <strong>(b) Parcialidades:</strong> {monthsCount} mensualidades de{" "}
                  {fmt(monthly)} cada una, pagaderas el día 5 de cada mes a partir del mes
                  siguiente a la firma.
                </p>
                <p className="text-justify">
                  <strong>(c) Liquidación a la entrega:</strong> {fmt(finalPayment)}, equivalente
                  al {plan?.finalPaymentPct ?? 0}% del precio, pagaderos contra entrega física de
                  la unidad.
                </p>
              </div>

              <p className="text-justify">
                <strong>TERCERA. Plazo de entrega.</strong> EL VENDEDOR se compromete a entregar
                la unidad terminada a más tardar en la fecha de entrega estimada del desarrollo,
                comprometiéndose a notificar con al menos 30 días naturales de anticipación la
                fecha exacta de entrega.
              </p>

              <p className="text-justify">
                <strong>CUARTA. Penalizaciones.</strong> El incumplimiento en cualquiera de los
                pagos pactados en la cláusula segunda generará intereses moratorios a razón del
                1.5% mensual sobre el monto vencido. El retraso superior a 60 días en el pago de
                dos o más parcialidades consecutivas faculta a EL VENDEDOR a rescindir el presente
                contrato, reteniendo como indemnización hasta el 10% de los pagos realizados.
              </p>

              <p className="text-justify">
                <strong>QUINTA. Cesión de derechos.</strong> EL COMPRADOR podrá ceder los derechos
                derivados del presente contrato previa autorización escrita de EL VENDEDOR, quien
                no podrá negar dicha autorización sin causa justificada.
              </p>

              <p className="text-justify">
                <strong>SEXTA. Domicilios.</strong> Para todos los efectos del presente contrato,
                las partes señalan como domicilios los siguientes: EL VENDEDOR, el de su domicilio
                social; EL COMPRADOR, {fullAddress}.
              </p>

              <p className="text-justify">
                <strong>SÉPTIMA. Jurisdicción.</strong> Para la interpretación y cumplimiento del
                presente contrato, las partes se someten a la jurisdicción de los tribunales
                competentes de la ciudad de Guadalajara, Jalisco, renunciando a cualquier otra
                jurisdicción que pudiera corresponderles por razón de sus domicilios presentes o
                futuros.
              </p>

              <p className="text-justify">
                <strong>OCTAVA. Escritura definitiva.</strong> Una vez completado el pago total
                del precio pactado, las partes se obligan a celebrar la escritura pública de
                compraventa ante notario público dentro de los 60 días naturales siguientes,
                siendo los gastos notariales, impuestos y derechos a cargo de EL COMPRADOR
                conforme a la práctica del mercado.
              </p>
            </div>

            <div className="space-y-6 pt-4">
              <p className="text-justify">
                Leído que fue el presente contrato por las partes, y enteradas de su contenido y
                alcance legal, lo firman al calce y al margen para constancia, en la ciudad de
                Guadalajara, Jalisco, el día {todayLong}.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                <div className="text-center space-y-2">
                  <div className="border-t border-neutral-400 pt-2">
                    <p className="text-xs font-bold uppercase tracking-wider">EL VENDEDOR</p>
                    <p className="text-xs text-neutral-600 mt-1">{developerLegalName}</p>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="border-t border-neutral-400 pt-2">
                    <p className="text-xs font-bold uppercase tracking-wider">EL COMPRADOR</p>
                    <p className="text-xs text-neutral-600 mt-1">{buyerName ?? "[Comprador]"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-success/5 border border-success/20 p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tu firma se realizará de forma digital con <strong className="text-foreground">e.firma del SAT</strong> a
          través de MIFIEL, conforme a la NOM-151-SCFI-2016 y el Código de Comercio. Tiene la
          misma validez legal que una firma autógrafa.
        </p>
      </div>

      <div className="rounded-xl bg-card border border-border p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={readConfirmed}
            onChange={(e) => setReadConfirmed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
          />
          <span className="text-sm text-foreground leading-relaxed">
            He leído y entiendo el contenido del contrato preliminar. Los datos son correctos y
            estoy de acuerdo con los términos y condiciones.
          </span>
        </label>
      </div>

      <div className="flex justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setCurrentStep(formalReservation.id, 4)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-foreground/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </button>
        <button
          type="button"
          disabled={!readConfirmed}
          onClick={handleContinue}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          Continuar a firma
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Step5ContractPreview;
