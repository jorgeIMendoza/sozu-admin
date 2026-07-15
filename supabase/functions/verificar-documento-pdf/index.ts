import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DocumentType =
  | "curp"
  | "acta_nacimiento"
  | "constancia_fiscal"
  | "comprobante_domicilio"
  | "acta_matrimonio";

interface VerifyPdfRequest {
  documentUrl: string;
  documentType: DocumentType;
}

interface ValidationResult {
  is_valid_document: boolean;
  document_type: DocumentType;
  confidence: number;
  extracted_fields: Record<string, string | null>;
  validation_signals: string[];
  rejection_reason: string | null;
  is_image_pdf: boolean;
}

// ─── PDF text extractor ──────────────────────────────────────────────────────

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function extractTextFromPDF(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];

  // BT...ET content blocks
  const btEt = /BT[\s\S]*?ET/g;
  let block: RegExpExecArray | null;
  while ((block = btEt.exec(raw)) !== null) {
    const content = block[0];
    // (text) Tj | (text) ' | (text) "
    const tj = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
    let m: RegExpExecArray | null;
    while ((m = tj.exec(content)) !== null) {
      const decoded = decodePdfString(m[1]);
      if (decoded.trim()) parts.push(decoded);
    }
    // [(text) -num (text)] TJ
    const tjArr = /\[([^\]]*)\]\s*TJ/g;
    while ((m = tjArr.exec(content)) !== null) {
      const items = m[1].match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) ?? [];
      const text = items.map((p) => decodePdfString(p.slice(1, -1))).join("");
      if (text.trim()) parts.push(text);
    }
  }

  // Hex strings <4142> Tj (common in SAT/RENAPO PDFs)
  const hexTj = /<([0-9A-Fa-f]+)>\s*Tj/g;
  let hm: RegExpExecArray | null;
  while ((hm = hexTj.exec(raw)) !== null) {
    const h = hm[1];
    let decoded = "";
    for (let i = 0; i < h.length; i += 2)
      decoded += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
    if (decoded.trim()) parts.push(decoded);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// ─── Common patterns ─────────────────────────────────────────────────────────

const CURP_RE =
  /[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d/g;
const RFC_RE = /[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}/g;
const DATE_NUMERIC = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/;
const DATE_LITERAL =
  /\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}/i;

function firstDate(text: string): string | null {
  return (text.match(DATE_LITERAL) ?? text.match(DATE_NUMERIC))?.[0] ?? null;
}

function allCurps(text: string): string[] {
  return [...text.matchAll(CURP_RE)].map((m) => m[0]);
}

// ─── Validators ──────────────────────────────────────────────────────────────

function validateCurp(text: string) {
  const signals: string[] = [];
  const fields: Record<string, string | null> = {
    curp: null,
    fecha_nacimiento: null,
    sexo: null,
    entidad_nacimiento: null,
  };
  let score = 0;

  if (/CLAVE\s+[ÚU]NICA\s+DE\s+REGISTRO/i.test(text)) {
    signals.push("Título CURP oficial");
    score += 35;
  }
  if (/REGISTRO\s+NACIONAL\s+DE\s+POBLACI[ÓO]N/i.test(text)) {
    signals.push("RENAPO");
    score += 25;
  }
  if (/\bCURP\b/.test(text)) {
    signals.push("Keyword CURP");
    score += 10;
  }

  const curps = allCurps(text);
  if (curps.length > 0) {
    fields.curp = curps[0];
    signals.push(`CURP: ${curps[0]}`);
    score += 30;
  }

  fields.fecha_nacimiento = firstDate(text);

  const sexo = text.match(/\b(HOMBRE|MUJER|MASCULINO|FEMENINO)\b/i)?.[1];
  if (sexo) {
    fields.sexo =
      /^(HOMBRE|MASCULINO)/i.test(sexo) ? "H" : "M";
  }

  // Entidad nacimiento code (2 uppercase letters after sex char in CURP)
  if (fields.curp) {
    fields.entidad_nacimiento = fields.curp.slice(11, 13);
  }

  return { fields, signals, score };
}

function validateConstanciaFiscal(text: string) {
  const signals: string[] = [];
  const fields: Record<string, string | null> = {
    rfc: null,
    curp: null,
    nombre_razon_social: null,
    regimen_fiscal: null,
  };
  let score = 0;

  if (/CONSTANCIA\s+DE\s+SITUACI[ÓO]N\s+FISCAL/i.test(text)) {
    signals.push("Título constancia fiscal");
    score += 40;
  }
  if (/SERVICIO\s+DE\s+ADMINISTRACI[ÓO]N\s+TRIBUTARIA/i.test(text)) {
    signals.push("SAT");
    score += 25;
  }
  if (/\bRFC\b/.test(text)) {
    signals.push("Keyword RFC");
    score += 10;
  }

  const rfcs = [...text.matchAll(RFC_RE)].map((m) => m[0]);
  if (rfcs.length > 0) {
    fields.rfc = rfcs[0];
    signals.push(`RFC: ${rfcs[0]}`);
    score += 20;
  }

  const curps = allCurps(text);
  if (curps.length > 0) {
    fields.curp = curps[0];
    score += 5;
  }

  const regimen = text.match(/R[EÉ]GIMEN\s+FISCAL[:\s]+([^\n]{5,60})/i)?.[1];
  if (regimen) fields.regimen_fiscal = regimen.trim();

  return { fields, signals, score };
}

function validateActaNacimiento(text: string) {
  const signals: string[] = [];
  const fields: Record<string, string | null> = {
    curp: null,
    fecha_nacimiento: null,
    lugar_nacimiento: null,
  };
  let score = 0;

  if (/ACTA\s+DE\s+NACIMIENTO/i.test(text)) {
    signals.push("Título acta de nacimiento");
    score += 45;
  }
  if (/REGISTRO\s+CIVIL/i.test(text)) {
    signals.push("Registro Civil");
    score += 25;
  }
  if (/OFICIAL[ÍI]A/i.test(text)) {
    signals.push("Oficialía");
    score += 10;
  }
  if (/NACIMIENTO/i.test(text) && score < 45) {
    signals.push("Keyword nacimiento");
    score += 5;
  }

  const curps = allCurps(text);
  if (curps.length > 0) {
    fields.curp = curps[0];
    signals.push(`CURP: ${curps[0]}`);
    score += 15;
  }

  fields.fecha_nacimiento = firstDate(text);

  const lugar = text.match(
    /MUNICIPIO[:\s]+([^\n,]{3,40})/i
  )?.[1] ?? text.match(/ESTADO[:\s]+([^\n,]{3,30})/i)?.[1] ?? null;
  if (lugar) fields.lugar_nacimiento = lugar.trim();

  return { fields, signals, score };
}

function validateComprobanteDomicilio(text: string) {
  const signals: string[] = [];
  const fields: Record<string, string | null> = {
    proveedor: null,
    fecha_emision: null,
    codigo_postal: null,
  };
  let score = 0;

  const proveedores: { pattern: RegExp; label: string }[] = [
    {
      pattern: /COMISI[ÓO]N\s+FEDERAL\s+DE\s+ELECTRICIDAD|\bCFE\b/i,
      label: "CFE",
    },
    { pattern: /\bTELMEX\b/i, label: "Telmex" },
    { pattern: /\bIZZI\b/i, label: "Izzi" },
    { pattern: /\bTOTALPLAY\b/i, label: "Totalplay" },
    { pattern: /\bMEGACABLE\b/i, label: "Megacable" },
    { pattern: /\bTELCEL\b/i, label: "Telcel" },
    { pattern: /\bAT&T\b/i, label: "AT&T" },
    { pattern: /\bAXTEL\b/i, label: "Axtel" },
    { pattern: /AGUAS?\s+(?:Y\s+)?(?:SANEAMIENTO|MUNICIPALES?|POTABLE)/i, label: "Agua municipal" },
    { pattern: /GAS\s+NATURAL|NATURGY|\bGAS\b.{0,10}SERVICIO/i, label: "Gas" },
    { pattern: /ESTADO\s+DE\s+CUENTA\s+BANCARIO|BANCO/i, label: "Banco" },
  ];

  for (const p of proveedores) {
    if (p.pattern.test(text)) {
      fields.proveedor = p.label;
      signals.push(`Proveedor: ${p.label}`);
      score += 40;
      break;
    }
  }

  // General utility keywords if no provider matched
  if (!fields.proveedor) {
    if (/RECIBO\s+DE\s+(?:LUZ|AGUA|GAS|SERVICIO)|COMPROBANTE\s+DE\s+DOMICILIO/i.test(text)) {
      signals.push("Recibo de servicio");
      score += 20;
    }
    if (/PERIODO\s+DE\s+FACTURACI[ÓO]N|LECTURA\s+ANTERIOR|CONSUMO\s+KWH/i.test(text)) {
      signals.push("Campos de consumo");
      score += 15;
    }
  }

  const fecha = firstDate(text);
  if (fecha) {
    fields.fecha_emision = fecha;
    signals.push(`Fecha: ${fecha}`);
    score += 20;
  }

  const cp = text.match(/C\.?P\.?\s*(\d{5})/)?.[1];
  if (cp) {
    fields.codigo_postal = cp;
    signals.push(`CP: ${cp}`);
    score += 20;
  }

  if (/TOTAL\s+A\s+PAGAR|IMPORTE\s+A\s+PAGAR|SALDO\s+(?:TOTAL|A\s+FAVOR)/i.test(text)) {
    signals.push("Campo de pago");
    score += 10;
  }

  return { fields, signals, score };
}

function validateActaMatrimonio(text: string) {
  const signals: string[] = [];
  const fields: Record<string, string | null> = {
    fecha_matrimonio: null,
    lugar_matrimonio: null,
    curp_contrayente_1: null,
    curp_contrayente_2: null,
  };
  let score = 0;

  if (/ACTA\s+DE\s+MATRIMONIO/i.test(text)) {
    signals.push("Título acta de matrimonio");
    score += 50;
  }
  if (/REGISTRO\s+CIVIL/i.test(text)) {
    signals.push("Registro Civil");
    score += 20;
  }
  if (/CONTRAJERON\s+MATRIMONIO|CELEBRACI[ÓO]N\s+DE\s+MATRIMONIO|UNIERON\s+EN\s+MATRIMONIO/i.test(text)) {
    signals.push("Acto matrimonial");
    score += 20;
  }
  if (/CONTRAYENTE|C[ÓO]NYUGE|ESPOSO|ESPOSA/i.test(text)) {
    signals.push("Partes del matrimonio");
    score += 10;
  }

  fields.fecha_matrimonio = firstDate(text);

  const curps = allCurps(text);
  if (curps[0]) {
    fields.curp_contrayente_1 = curps[0];
    score += 10;
  }
  if (curps[1]) {
    fields.curp_contrayente_2 = curps[1];
  }

  const lugar = text.match(/MUNICIPIO[:\s]+([^\n,]{3,40})/i)?.[1] ?? null;
  if (lugar) fields.lugar_matrimonio = lugar.trim();

  return { fields, signals, score };
}

const VALIDATORS: Record<
  DocumentType,
  (text: string) => { fields: Record<string, string | null>; signals: string[]; score: number }
> = {
  curp: validateCurp,
  constancia_fiscal: validateConstanciaFiscal,
  acta_nacimiento: validateActaNacimiento,
  comprobante_domicilio: validateComprobanteDomicilio,
  acta_matrimonio: validateActaMatrimonio,
};

const CONFIDENCE_THRESHOLD = 60;

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { documentUrl, documentType } =
      (await req.json()) as VerifyPdfRequest;

    if (!documentUrl || !documentType) {
      return new Response(
        JSON.stringify({ error: "documentUrl y documentType son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!VALIDATORS[documentType]) {
      return new Response(
        JSON.stringify({
          error: `Tipo de documento no soportado: ${documentType}. Válidos: curp, acta_nacimiento, constancia_fiscal, comprobante_domicilio, acta_matrimonio`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch PDF
    const pdfRes = await fetch(documentUrl);
    if (!pdfRes.ok)
      throw new Error(`No se pudo descargar el documento: ${pdfRes.status}`);

    const contentType = pdfRes.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf") && !documentUrl.toLowerCase().includes(".pdf")) {
      return new Response(
        JSON.stringify({
          error: "El archivo no parece ser un PDF. Esta función solo valida documentos PDF.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
    const text = extractTextFromPDF(pdfBytes);

    console.log(
      `[verificar-documento-pdf] type=${documentType} text_length=${text.length}`
    );

    // PDFs with embedded images (scans) won't have extractable text
    const isImagePdf = text.length < 80;
    if (isImagePdf) {
      const result: ValidationResult = {
        is_valid_document: false,
        document_type: documentType,
        confidence: 0,
        extracted_fields: {},
        validation_signals: [],
        rejection_reason:
          "El PDF parece ser una imagen escaneada. No es posible validar con análisis de texto. Sube la versión digital del documento.",
        is_image_pdf: true,
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fields, signals, score } = VALIDATORS[documentType](text);
    const confidence = Math.min(score, 100);
    const isValid = confidence >= CONFIDENCE_THRESHOLD;

    const result: ValidationResult = {
      is_valid_document: isValid,
      document_type: documentType,
      confidence,
      extracted_fields: fields,
      validation_signals: signals,
      rejection_reason: isValid
        ? null
        : `Documento no reconocido como ${documentType.replace(/_/g, " ")}. Señales detectadas: ${signals.join(", ") || "ninguna"}. Confidence: ${confidence}/100.`,
      is_image_pdf: false,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[verificar-documento-pdf] error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Error desconocido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
