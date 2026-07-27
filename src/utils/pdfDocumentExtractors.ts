// Extracción de campos desde el texto de PDFs oficiales (CURP RENAPO, CSF SAT).
// Client-side, best-effort: los valores se muestran al cliente en un modal editable
// antes de guardarse en `personas`, por lo que una extracción parcial es aceptable.
// Los regex están portados de la Edge Function `verificar-documento-pdf` para
// mantener consistencia; ver Ejecuciones_manuales para la ruta server-side (más segura).

const CURP_RE = /[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d/;
const RFC_RE = /[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}/;

function norm(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Valor que sigue a una de las etiquetas dadas, hasta el siguiente separador
 * razonable (2+ espacios, salto de línea, o el inicio de otra etiqueta con `:`).
 */
function labelValue(text: string, labels: string[], maxLen = 70): string | null {
  for (const lbl of labels) {
    const re = new RegExp(
      lbl + "\\s*:?\\s*([^\\n]{2," + maxLen + "}?)(?=\\s{2,}|\\n|$|\\b[A-ZÁÉÍÓÚ][A-Za-zÁÉÍÓÚáéíóú().\\s]{2,30}\\s*:)",
      "i",
    );
    const m = text.match(re);
    if (m && m[1]) {
      const v = m[1].trim().replace(/[|;·]+$/, "").trim();
      if (v && v.length >= 2) return v;
    }
  }
  return null;
}

/** Deriva fecha de nacimiento (DD/MM/AAAA) desde los dígitos de la CURP. */
function fechaFromCurp(curp: string): string | null {
  const yy = curp.slice(4, 6);
  const mm = curp.slice(6, 8);
  const dd = curp.slice(8, 10);
  if (!/^\d{2}$/.test(yy) || !/^\d{2}$/.test(mm) || !/^\d{2}$/.test(dd)) return null;
  // Homoclave: dígito en pos 16 es número para <2000, letra para >=2000
  const century = /[A-Z]/.test(curp[16] ?? "") ? "20" : "19";
  return `${dd}/${mm}/${century}${yy}`;
}

export interface CURPExtractedFields {
  curp: string | null;
  nombre: string | null;
  fechaNacimiento: string | null;
  sexo: "H" | "M" | null;
}

export function extractCURPFields(text: string): CURPExtractedFields {
  const t = norm(text);
  const curp = t.match(CURP_RE)?.[0] ?? null;

  // Sexo: char 10 de la CURP (H/M) — fuente más confiable que el texto libre.
  let sexo: "H" | "M" | null = null;
  if (curp) {
    const s = curp[10];
    if (s === "H" || s === "M") sexo = s;
  }
  if (!sexo) {
    const s = t.match(/\b(HOMBRE|MUJER|MASCULINO|FEMENINO)\b/i)?.[1];
    if (s) sexo = /^(HOMBRE|MASCULINO)/i.test(s) ? "H" : "M";
  }

  const nombres = labelValue(t, ["Nombre\\(s\\)", "Nombres?"]);
  const primerAp = labelValue(t, ["Primer[\\s]?[Aa]pellido", "Apellido[\\s]?[Pp]aterno"]);
  const segundoAp = labelValue(t, ["Segundo[\\s]?[Aa]pellido", "Apellido[\\s]?[Mm]aterno"]);
  const nombre = [nombres, primerAp, segundoAp].filter(Boolean).join(" ").trim() || null;

  const fechaNacimiento =
    (curp ? fechaFromCurp(curp) : null) ??
    t.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/)?.[0] ??
    null;

  return { curp, nombre, fechaNacimiento, sexo };
}

export interface ActaExtractedFields {
  curp: string | null;
  nombre: string | null;
  fechaNacimiento: string | null;
  sexo: "H" | "M" | null;
  lugarNacimiento: string | null;
}

export function extractActaNacimientoFields(text: string): ActaExtractedFields {
  const t = norm(text);
  const curp = t.match(CURP_RE)?.[0] ?? null;

  let sexo: "H" | "M" | null = null;
  if (curp) {
    const s = curp[10];
    if (s === "H" || s === "M") sexo = s;
  }

  // En el acta el nombre aparece ANTES de las etiquetas:
  // "...Datos de la Persona Registrada EDUARDO DAVID PEÑA ARAUJO Nombre(s):..."
  // Capturamos el bloque entre ese título y "Nombre(s)".
  let nombre: string | null = null;
  const block = t.match(/Datos\s+de\s+la\s+Persona\s+Registrada\s+(.+?)\s+Nombre\s*\(s\)/i)?.[1];
  if (block) {
    const clean = block.replace(/[-]{2,}/g, " ").replace(/\s+/g, " ").trim();
    if (clean.length >= 3 && clean.length <= 90) nombre = clean;
  }

  const fechaNacimiento =
    (curp ? fechaFromCurp(curp) : null) ??
    t.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/)?.[0] ??
    null;

  const lugarNacimiento = t.match(/Lugar\s+de\s+Nacimiento\s*:?\s*([A-ZÁÉÍÓÚÑ ]{3,40}?)(?=\s{2,}|Datos|CURP|$)/i)?.[1]?.trim() ?? null;

  return { curp, nombre, fechaNacimiento, sexo, lugarNacimiento };
}

export interface CSFExtractedFields {
  rfc: string | null;
  curp: string | null;
  nombre: string | null;
  regimen: string | null;
  codigoPostal: string | null;
  calle: string | null;
  colonia: string | null;
  numExt: string | null;
  numInt: string | null;
}

export function extractCSFFields(text: string): CSFExtractedFields {
  const t = norm(text);

  return {
    rfc: t.match(RFC_RE)?.[0] ?? null,
    curp: t.match(CURP_RE)?.[0] ?? null,
    nombre: labelValue(t, [
      "Denominaci[oó]n[/\\s]*(?:o\\s*)?Raz[oó]n\\s*Social",
      "Nombre\\s*\\(s\\)",
      "Nombre",
    ], 80),
    regimen: labelValue(t, ["R[eé]gimen(?:\\s*Fiscal)?"], 60),
    codigoPostal:
      t.match(/C[oó]digo\s*Postal\s*:?\s*(\d{5})/i)?.[1] ??
      t.match(/\bC\.?P\.?\s*:?\s*(\d{5})/i)?.[1] ??
      null,
    calle: labelValue(t, ["Nombre\\s*de\\s*(?:la\\s*)?Vialidad", "Vialidad", "Calle"]),
    colonia: labelValue(t, ["Nombre\\s*de\\s*la\\s*Colonia", "Colonia"]),
    numExt: labelValue(t, ["N[uú]mero\\s*Exterior", "No\\.?\\s*Exterior", "Num\\.?\\s*Ext"], 12),
    numInt: labelValue(t, ["N[uú]mero\\s*Interior", "No\\.?\\s*Interior", "Num\\.?\\s*Int"], 12),
  };
}
