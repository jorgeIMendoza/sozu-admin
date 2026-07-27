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

function extractMostRecentDate(text: string): Date | null {
  const dates: Date[] = [];
  const now = new Date();
  const norm = normalizeSpaces(text);

  // DD/MM/YYYY or DD-MM-YYYY
  const reDMY = /\b(\d{1,2})[/\-](\d{2})[/\-](\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = reDMY.exec(norm)) !== null) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    if (!isNaN(d.getTime()) && d <= now) dates.push(d);
  }

  // YYYY-MM-DD
  const reYMD = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = reYMD.exec(norm)) !== null) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    if (!isNaN(d.getTime()) && d <= now) dates.push(d);
  }

  // DD de MMMM de YYYY
  const reDMes = /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/gi;
  while ((m = reDMes.exec(norm)) !== null) {
    const d = parseSpanishDate(m[1], m[2], m[3]);
    if (d && d <= now) dates.push(d);
  }

  // MMMM YYYY (billing period)
  const reMesYear = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})\b/gi;
  while ((m = reMesYear.exec(norm)) !== null) {
    const monthNum = SPANISH_MONTHS[m[1].toLowerCase()];
    if (monthNum) {
      const d = new Date(parseInt(m[2]), monthNum - 1, 1);
      if (!isNaN(d.getTime()) && d <= now) dates.push(d);
    }
  }

  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a > b ? a : b));
}

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

export function validateComprobanteDomicilioPdf(text: string): PdfValidationResult {
  const norm = normalizeSpaces(text);
  const upper = norm.toUpperCase();

  const KEYWORDS = [
    "CFE", "TELMEX", "IZZI", "TOTALPLAY", "MEGACABLE", "TELEFONOS",
    "GAS NATURAL", "AGUA", "BANCO", "CLABE", "ESTADO DE CUENTA",
    "COMPROBANTE DE DOMICILIO", "DOMICILIO",
  ];
  if (!KEYWORDS.some(kw => upper.includes(kw))) {
    return { ok: false, reason: "El documento no corresponde a un comprobante de domicilio válido (CFE, agua, banco, etc.)." };
  }

  const date = extractMostRecentDate(norm);
  if (!date) {
    return { ok: false, reason: "No se encontró la fecha de emisión en el comprobante de domicilio." };
  }

  if (!isWithin3Months(date)) {
    return { ok: false, reason: "El comprobante de domicilio tiene más de 3 meses de antigüedad. Sube uno reciente." };
  }

  return { ok: true };
}

export function validateActaNacimientoPdf(text: string): PdfValidationResult {
  const norm = normalizeSpaces(text);

  if (!containsPhrase(norm, "Acta de Nacimiento")) {
    return { ok: false, reason: "El documento no corresponde a un Acta de Nacimiento oficial." };
  }

  // Marcadores del acta digital oficial (CEVAR / Registro Civil).
  const hasIdentificador = /Identificador\s+Electr[oó]nico/i.test(norm);
  const hasRegistroCivil = /registrocivil\.gob\.mx/i.test(norm) || /Registro\s+Civil/i.test(norm);

  // Firma Electrónica: bloque base64 partido en grupos de 2 caracteres separados
  // por espacios (cambia por persona, pero el patrón es constante). Ej:
  // "UE VB RT Ay MD cy OU hN Q1 hS RE E3 fE VE VU FS RE 8g RE FW SU R8 ...".
  const hasFirmaLabel = /Firma\s+Electr[oó]nica/i.test(norm);
  const hasFirmaPattern = /(?:[A-Za-z0-9+/]{2}\s){12,}/.test(norm);
  const hasFirmaElectronica = hasFirmaLabel && hasFirmaPattern;

  if (!hasIdentificador && !hasRegistroCivil && !hasFirmaElectronica) {
    return {
      ok: false,
      reason: "No se detectaron los elementos de un Acta de Nacimiento digital oficial (Identificador Electrónico / Registro Civil / Firma Electrónica).",
    };
  }

  // CURP presente (clave de la persona registrada).
  const hasCurp = /[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d/.test(norm);
  if (!hasCurp) {
    return { ok: false, reason: "No se encontró la CURP en el Acta de Nacimiento." };
  }

  // El acta no caduca → no se valida antigüedad.
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
