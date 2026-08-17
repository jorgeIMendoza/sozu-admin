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

  // Nombre — RENAPO tiene dos formatos:
  //  (a) "Constancia de la CURP" (actual): el nombre (mayúsculas) aparece junto a
  //      la clave y antes de las etiquetas "Clave: Nombre". El texto de pdfjs sale
  //      desordenado (el cuerpo con "PRESENTE" va primero), por eso se ancla en la
  //      clave CURP, no en "PRESENTE" ni en el label "Nombre".
  //  (b) formato antiguo con campos Nombre(s)/Primer apellido/Segundo apellido.
  const NAME_RUN = "([A-ZÁÉÍÓÚÑ]{2,}(?:\\s+[A-ZÁÉÍÓÚÑ]{2,}){1,5})";
  let nombre: string | null = null;

  // (a1) nombre en mayúsculas inmediatamente después de la clave CURP.
  if (curp) {
    const m = t.match(new RegExp(curp + "\\s+" + NAME_RUN));
    if (m) nombre = m[1].replace(/\s+/g, " ").trim();
  }
  // (a2) nombre en mayúsculas justo antes de la etiqueta "Clave".
  if (!nombre) {
    const m = t.match(new RegExp(NAME_RUN + "\\s+Clave\\b"));
    if (m) nombre = m[1].replace(/\s+/g, " ").trim();
  }
  // (b) campos separados.
  if (!nombre) {
    const structured = [
      labelValue(t, ["Nombre\\(s\\)"]),
      labelValue(t, ["Primer[\\s]?[Aa]pellido", "Apellido[\\s]?[Pp]aterno"]),
      labelValue(t, ["Segundo[\\s]?[Aa]pellido", "Apellido[\\s]?[Mm]aterno"]),
    ].filter(Boolean).join(" ").trim();
    if (structured.length >= 5) nombre = structured;
  }

  const fechaNacimiento =
    (curp ? fechaFromCurp(curp) : null) ??
    t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)?.[0] ??
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
    t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)?.[0] ??
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

  // La CSF trae campos separados y etiquetados. Sobre texto normalizado (espacios
  // colapsados) `labelValue` corta los valores de 2+ palabras en mayúsculas (cree
  // que la 2a palabra es otra etiqueta), así que capturamos el valor MAYÚSCULA
  // entre cada etiqueta y la siguiente.
  const between = (start: string, ends: string[]): string | null => {
    const m = t.match(
      new RegExp(start + "\\s*:?\\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{1,70}?)\\s+(?:" + ends.join("|") + ")"),
    );
    return m ? m[1].replace(/\s+/g, " ").trim() : null;
  };

  const razonSocial = labelValue(t, ["Denominaci[oó]n[/\\s]*(?:o\\s*)?Raz[oó]n\\s*Social"], 80);
  const nombreS = between("Nombre\\s*\\(s\\)", ["Primer\\s+Apellido"]);
  const apPaterno = between("Primer\\s+Apellido", ["Segundo\\s+Apellido"]);
  const apMaterno = between("Segundo\\s+Apellido", ["Fecha", "Nombre\\s+Comercial", "Datos", "CURP", "RFC"]);
  const nombreCompleto = [nombreS, apPaterno, apMaterno].filter(Boolean).join(" ").trim();
  const nombre =
    razonSocial ||
    (nombreCompleto.length >= 5
      ? nombreCompleto
      : labelValue(t, ["Nombre\\s*\\(s\\)", "Nombre"], 80));

  const regimen =
    t
      .match(/R[eé]gimen\s+de\s+[Ll]as?\s+[A-Za-zÁÉÍÓÚáéíóúñ\s,]+?(?=\s+\d{2}\/\d{2}\/\d{4}|\s+Fecha\b|$)/)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() ?? labelValue(t, ["R[eé]gimen(?:\\s*Fiscal)?"], 60);

  // Rechaza valores que son en realidad la etiqueta del siguiente campo (campo vacío).
  const cleanNum = (v: string | null): string | null => {
    if (!v) return null;
    const s = v.trim();
    return /\d/.test(s) || s.length <= 3 ? s : null;
  };

  return {
    rfc: t.match(RFC_RE)?.[0] ?? null,
    curp: t.match(CURP_RE)?.[0] ?? null,
    nombre,
    regimen,
    codigoPostal:
      t.match(/C[oó]digo\s*Postal\s*:?\s*(\d{5})/i)?.[1] ??
      t.match(/\bC\.?P\.?\s*:?\s*(\d{5})/i)?.[1] ??
      null,
    calle:
      between("Nombre\\s*de\\s*(?:la\\s*)?Vialidad", ["N[uú]mero\\s+Exterior", "Tipo\\s+de\\s+Vialidad"]) ??
      labelValue(t, ["Nombre\\s*de\\s*(?:la\\s*)?Vialidad", "Vialidad", "Calle"]),
    colonia:
      between("Nombre\\s*de\\s*la\\s*Colonia", ["Nombre\\s+de\\s+la\\s+Localidad", "Nombre\\s+del\\s+Municipio", "Entre\\s+Calle"]) ??
      labelValue(t, ["Nombre\\s*de\\s*la\\s*Colonia", "Colonia"]),
    numExt: cleanNum(labelValue(t, ["N[uú]mero\\s*Exterior", "No\\.?\\s*Exterior", "Num\\.?\\s*Ext"], 12)),
    numInt: cleanNum(labelValue(t, ["N[uú]mero\\s*Interior", "No\\.?\\s*Interior", "Num\\.?\\s*Int"], 12)),
  };
}
