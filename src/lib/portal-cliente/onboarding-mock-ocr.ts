// Mock OCR — genera campos verosímiles por tipo de documento.
// Se reemplaza por integración real en `DocumentUploader`. // SWAP POINT: OCR real.

import type { DocField, DocStatus, DocType, PortalState } from "@/lib/portal-cliente/onboarding-store";

function rng<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const NOMBRES = [
  "MARÍA FERNANDA GARCÍA LÓPEZ",
  "JUAN CARLOS HERNÁNDEZ RUIZ",
  "ANA SOFÍA MENDOZA TORRES",
  "LUIS ROBERTO CASTRO SILVA",
];

const NOTARIAS = ["Notaría Pública 27, Guadalajara", "Notaría Pública 12, Zapopan"];

function status(conf: number): DocStatus {
  if (conf < 0.75) return "por_confirmar";
  return "en_revision";
}

export interface OcrResult {
  fields: DocField[];
  confidence: number;
  status: DocStatus;
}

/**
 * Genera campos mock. Recibe el estado del portal para poder alinear
 * (o desalinear, según panel DEMO) escritura ↔ unidad seleccionada ↔ dueño original.
 */
export async function simulateOcr(
  docType: DocType,
  filename: string,
  state: PortalState,
  docId: string,
): Promise<OcrResult> {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));

  const confidence = 0.6 + Math.random() * 0.38;
  const st = status(confidence);
  const property = state.properties.find((p) => p.id === state.onboarding.unitId);
  const nombre = NOMBRES[0]; // el "usuario" siempre es el mismo nombre en ID
  const folioReal = property?.folioReal ?? "GDL-0000-000000";
  const dueñoOriginal = property?.originalOwnerId ?? "user-original-001";

  const mk = (fields: Omit<DocField, "sourceDocId" | "status">[]): DocField[] =>
    fields.map((f) => ({ ...f, sourceDocId: docId, status: st }));

  switch (docType) {
    case "id_oficial":
      return {
        confidence,
        status: st,
        fields: mk([
          { key: "nombre", label: "Nombre", value: nombre },
          { key: "curp", label: "CURP", value: "GALM850612MJCRPR03" },
          { key: "sexo", label: "Sexo", value: "M" },
          { key: "vigencia", label: "Vigencia", value: "2029" },
        ]),
      };
    case "escritura":
      return {
        confidence,
        status: st,
        fields: mk([
          { key: "adquirente", label: "Adquirente", value: nombre },
          { key: "vendedor", label: "Vendedor / enajenante", value: dueñoOriginal },
          { key: "folio_real", label: "Folio real", value: folioReal },
          { key: "notaria", label: "Notaría", value: rng(NOTARIAS) },
          { key: "escritura_num", label: "N° de escritura", value: "38,412" },
          { key: "sello_rpp", label: "Sello de inscripción RPP", value: "Presente" },
          { key: "inmueble", label: "Descripción del inmueble", value: property?.address ?? "—" },
        ]),
      };
    case "certificado_rpp":
      return {
        confidence,
        status: st,
        fields: mk([
          { key: "titular_registral", label: "Titular registral vigente", value: nombre },
          { key: "folio_real", label: "Folio real", value: folioReal },
          { key: "gravamenes", label: "Gravámenes", value: "Ninguno" },
          { key: "fecha_emision", label: "Fecha de emisión", value: new Date().toLocaleDateString("es-MX") },
        ]),
      };
    case "predial":
      return {
        confidence,
        status: st,
        fields: mk([
          { key: "titular", label: "Titular fiscal", value: nombre },
          { key: "folio_real", label: "Folio real", value: folioReal },
          { key: "clave_catastral", label: "Clave catastral", value: "14-A-045-0402" },
          { key: "periodo_pagado", label: "Periodo pagado", value: "2026 completo" },
        ]),
      };
    case "curp":
      return {
        confidence,
        status: st,
        fields: mk([
          { key: "curp", label: "CURP", value: "GALM850612MJCRPR03" },
          { key: "nombre", label: "Nombre", value: nombre },
          { key: "fecha_nacimiento", label: "Fecha de nacimiento", value: "12/06/1985" },
        ]),
      };
    case "csf":
      return state.onboarding.personType === "moral"
        ? {
            confidence,
            status: st,
            fields: mk([
              { key: "rfc", label: "RFC", value: "IME240115ABC" },
              { key: "razon_social", label: "Razón social", value: "INMOBILIARIA MENDOZA S.A. DE C.V." },
              { key: "regimen", label: "Régimen", value: "General de Ley Personas Morales" },
              { key: "domicilio_fiscal", label: "Domicilio fiscal", value: "Av. Chapultepec 480, Guadalajara, 44140" },
            ]),
          }
        : {
            confidence,
            status: st,
            fields: mk([
              { key: "rfc", label: "RFC", value: "GALM850612XY1" },
              { key: "regimen", label: "Régimen", value: "Sueldos y salarios" },
              { key: "codigo_postal", label: "Código postal fiscal", value: "44140" },
            ]),
          };

    case "acta_constitutiva":
      return {
        confidence,
        status: st,
        fields: mk([
          { key: "razon_social", label: "Razón social / denominación", value: "INMOBILIARIA MENDOZA S.A. DE C.V." },
          { key: "rfc", label: "RFC de la moral", value: "IME240115ABC" },
          { key: "fecha_constitucion", label: "Fecha de constitución", value: "15/01/2024" },
          { key: "objeto_social", label: "Objeto social", value: "Adquisición, arrendamiento y administración de inmuebles" },
        ]),
      };
    case "poder_rl":
      return {
        confidence,
        status: st,
        fields: mk([
          { key: "representante", label: "Nombre del representante", value: nombre },
          { key: "tipo_facultades", label: "Tipo de facultades", value: "Pleitos y cobranzas · Actos de administración · Actos de dominio" },
          { key: "instrumento", label: "Instrumento notarial", value: "Escritura 12,845, Notaría 27 GDL" },
        ]),
      };
    case "id_rl":
      return {
        confidence,
        status: st,
        fields: mk([
          { key: "nombre", label: "Nombre del representante", value: nombre },
          { key: "curp", label: "CURP del representante", value: "GALM850612MJCRPR03" },
          { key: "vigencia", label: "Vigencia", value: "2029" },
        ]),
      };
  }
}

export function filenameFor(f: File | null): string {
  return f?.name ?? "documento.pdf";
}
