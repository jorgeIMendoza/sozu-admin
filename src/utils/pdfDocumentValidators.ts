const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  return normalizeSpaces(text).toLowerCase().includes(normalizeSpaces(phrase).toLowerCase());
}

function parseSpanishDate(day: string, month: string, year: string): Date | null {
  const monthNum = SPANISH_MONTHS[month.toLowerCase()];
  if (!monthNum) return null;
  const date = new Date(parseInt(year, 10), monthNum - 1, parseInt(day, 10));
  return isNaN(date.getTime()) ? null : date;
}

function isWithin3Months(date: Date): boolean {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  return date >= cutoff;
}

export type PdfValidationResult = { ok: true } | { ok: false; reason: string };

export function validateCURPPdf(text: string): PdfValidationResult {
  const norm = normalizeSpaces(text);

  if (!containsPhrase(norm, "CURP Certificada: verificada con el Registro Civil")) {
    return { ok: false, reason: "El documento no corresponde a una CURP oficial emitida por RENAPO." };
  }

  if (!containsPhrase(norm, "Consulta la versión integral de nuestro Aviso de Privacidad en https://www.gob.mx/segob/renapo")) {
    return { ok: false, reason: "El documento no corresponde a una CURP oficial emitida por RENAPO." };
  }

  // "Ciudad de México, a DD de MMMM de YYYY"
  const dateMatch = norm.match(
    /Ciudad\s+de\s+M[eé]xico[,\s]*a\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i,
  );
  if (!dateMatch) {
    return { ok: false, reason: "No se encontró la fecha de emisión en la CURP." };
  }

  const docDate = parseSpanishDate(dateMatch[1], dateMatch[2], dateMatch[3]);
  if (!docDate) {
    return { ok: false, reason: "La fecha de emisión de la CURP no es válida." };
  }

  if (!isWithin3Months(docDate)) {
    return {
      ok: false,
      reason: "La CURP tiene más de 3 meses de antigüedad. Descarga una versión actualizada en gob.mx/curp.",
    };
  }

  return { ok: true };
}

export function validateCSFPdf(text: string): PdfValidationResult {
  const norm = normalizeSpaces(text);

  if (!containsPhrase(norm, "Cadena Original Sello")) {
    return { ok: false, reason: "El documento no corresponde a una Constancia de Situación Fiscal del SAT." };
  }

  // Split into two stable sub-phrases to avoid ¡ spacing variance
  if (
    !containsPhrase(norm, "La corrupción tiene consecuencias") ||
    !containsPhrase(norm, "presenta una queja o denuncia")
  ) {
    return { ok: false, reason: "El documento no corresponde a una Constancia de Situación Fiscal del SAT." };
  }

  // "A DD DE MMMM DE YYYY" in Lugar y Fecha de Emisión block (uppercase in CSF)
  const dateMatch = norm.match(
    /\bA\s+(\d{1,2})\s+DE\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+DE\s+(\d{4})/i,
  );
  if (!dateMatch) {
    return { ok: false, reason: "No se encontró la fecha de emisión en la Constancia de Situación Fiscal." };
  }

  const docDate = parseSpanishDate(dateMatch[1], dateMatch[2], dateMatch[3]);
  if (!docDate) {
    return { ok: false, reason: "La fecha de emisión de la Constancia de Situación Fiscal no es válida." };
  }

  if (!isWithin3Months(docDate)) {
    return {
      ok: false,
      reason: "La Constancia de Situación Fiscal tiene más de 3 meses de antigüedad. Descárgala actualizada en el portal del SAT.",
    };
  }

  return { ok: true };
}
