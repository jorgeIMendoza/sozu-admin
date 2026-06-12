import type { FormalReservation } from "./formal-reservation-data";

export interface ContratoSection {
  number: number;
  title: string;
  body: string;
  highlight?: boolean;
}

const fmtMoney = (n: number) => `$${n.toLocaleString("es-MX")} MXN`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

export const generateContratoText = (
  formalReservation: FormalReservation,
  propertyLabel: string,
  developmentName: string,
): ContratoSection[] => {
  const fi = formalReservation.fiscalIdentity!;
  const virtualCLABE = formalReservation.propertyVirtualCLABE ?? "";
  const dp = formalReservation.expediente!.datosPersonales.data!;
  const plan = formalReservation.expediente!.planPagos.data!;
  const dom = dp.domicilioFiscal;

  const fullAddress = `${dom.calle} ${dom.numeroExterior}${dom.numeroInterior ? ` int. ${dom.numeroInterior}` : ""}, ${dom.colonia}, CP ${dom.codigoPostal}, ${dom.municipio}, ${dom.estado}`;

  const regimenLabel =
    dp.estadoCivil === "casado"
      ? ` bajo régimen de ${dp.regimenPatrimonial === "separacion_bienes" ? "separación de bienes" : "sociedad conyugal"}`
      : "";

  const paidDate = formalReservation.payment?.detectedAt
    ? fmtDate(formalReservation.payment.detectedAt)
    : fmtDate(new Date().toISOString());

  return [
    {
      number: 1,
      title: "Declaraciones de las partes",
      body: `EL VENDEDOR: SOZU COMERCIALIZADORA SA DE CV, sociedad mercantil debidamente constituida bajo las leyes de los Estados Unidos Mexicanos, en su carácter de comercializador autorizado del desarrollo inmobiliario <strong>${developmentName}</strong>.

EL COMPRADOR: <strong>${fi.legalName}</strong>, identificado(a) con RFC <strong>${fi.rfc}</strong> y CURP <strong>${dp.curp}</strong>, mayor de edad, <strong>${dp.estadoCivil}</strong>${regimenLabel}, de nacionalidad <strong>${dp.nacionalidad}</strong>, con domicilio fiscal en <strong>${fullAddress}</strong>, dedicado(a) a la actividad de <strong>${dp.ocupacion}</strong>.`,
    },
    {
      number: 2,
      title: "Objeto del contrato",
      body: `EL VENDEDOR se obliga a transferir a EL COMPRADOR la propiedad de la unidad <strong>${propertyLabel}</strong>, ubicada en el desarrollo <strong>${developmentName}</strong>, conforme a las especificaciones, planos, memoria descriptiva y demás documentación técnica que forma parte integral del presente contrato como Anexo A.`,
    },
    {
      number: 3,
      title: "Precio y forma de pago",
      highlight: true,
      body: `El precio total de la unidad es de <strong>${fmtMoney(plan.totalPriceMXN)}</strong>, el cual será cubierto por EL COMPRADOR conforme al siguiente cronograma:

a) Apartado de <strong>${fmtMoney(plan.appliedFromApartado)}</strong> pagado el <strong>${paidDate}</strong> mediante transferencia SPEI a la CLABE de cobranza ****${virtualCLABE.slice(-4)} (STP).

b) Saldo del enganche por <strong>${fmtMoney(plan.engancheRestanteMXN)}</strong>, pagadero dentro de los 7 días naturales siguientes a la firma del presente.

${plan.mensualidadesCount > 0 ? `c) <strong>${plan.mensualidadesCount} mensualidades</strong> de <strong>${fmtMoney(plan.mensualidadAmountMXN)}</strong> cada una.\n\n` : ""}${plan.mensualidadesCount > 0 ? "d" : "c"}) Saldo final por <strong>${fmtMoney(plan.saldoEntregaMXN)}</strong>, pagadero contra la entrega física de la unidad.`,
    },
    {
      number: 4,
      title: "Plazo y entrega",
      highlight: true,
      body: `EL VENDEDOR estima la entrega física de la unidad para <strong>${new Date(plan.estimatedDeliveryDate).toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</strong>. Cualquier modificación al plazo deberá notificarse a EL COMPRADOR con al menos 30 días naturales de anticipación, conforme a los plazos máximos establecidos por la Ley Federal de Protección al Consumidor (PROFECO).`,
    },
    {
      number: 5,
      title: "Obligaciones del comprador",
      body: `EL COMPRADOR se obliga a: (i) realizar los pagos descritos en la Cláusula Tercera en los plazos pactados; (ii) mantener actualizada su información fiscal y de contacto; (iii) suscribir el contrato definitivo de compraventa una vez completado el pago total; (iv) cubrir los gastos de escrituración, impuestos y honorarios notariales que le correspondan por ley.`,
    },
    {
      number: 6,
      title: "Obligaciones del vendedor",
      body: `EL VENDEDOR se obliga a: (i) entregar la unidad libre de gravámenes, hipotecas, embargos o cualquier limitación de dominio; (ii) tramitar la escritura pública de compraventa una vez cubierto el precio total; (iii) entregar la unidad conforme a las especificaciones pactadas; (iv) responder por vicios ocultos conforme a la Cláusula Octava.`,
    },
    {
      number: 7,
      title: "Penalidades por incumplimiento",
      highlight: true,
      body: `<strong>Atraso del comprador:</strong> en caso de atraso en cualquiera de los pagos, EL COMPRADOR pagará intereses moratorios equivalentes a la Tasa de Interés Interbancaria de Equilibrio (TIIE) a 28 días más 5 puntos porcentuales, calculados sobre el saldo insoluto desde la fecha de vencimiento.

<strong>Cancelación:</strong> si EL COMPRADOR cancela el contrato sin causa justificada, EL VENDEDOR retendrá hasta el <strong>20%</strong> de los montos pagados como pena convencional, reembolsando el restante en un plazo no mayor a 60 días.`,
    },
    {
      number: 8,
      title: "Garantía de vicios ocultos",
      body: `Conforme a los artículos 2142 a 2161 del Código Civil Federal, EL VENDEDOR garantiza la unidad contra vicios ocultos por un periodo de <strong>1 (un) año</strong> contado a partir de la entrega física. EL COMPRADOR deberá notificar cualquier vicio dentro de los 30 días naturales siguientes a su descubrimiento. Esta garantía no cubre desgaste natural, daños por uso indebido o modificaciones posteriores a la entrega.`,
    },
  ];
};
