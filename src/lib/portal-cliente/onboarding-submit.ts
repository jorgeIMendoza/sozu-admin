// Envío de la solicitud del onboarding de propietarios a la Edge Function
// `registrar-solicitud-propietario`. Los PDFs NO viajan en el JSON (el gateway
// rechaza bodies > ~1 MB con 413): se suben directo a Storage por URL firmada,
// SOLO en este envío (nada llega a Storage antes → sin huérfanos).
//
// Flujo:
//   1) action:"urls"  → pide una URL de subida firmada por documento.
//   2) uploadToSignedUrl → sube cada PDF (leído de IndexedDB) directo a Storage.
//   3) action:"crear" → crea persona/entidad/solicitud + registra las rutas subidas.
//   4) al éxito, limpia los archivos retenidos en IndexedDB.

import { supabase } from "@/integrations/supabase/client";
import { getDocBlob, clearDocBlobs } from "./onboarding-doc-idb";
import type { OnboardingState, UploadedDoc, VerificationCheck } from "./onboarding-store";

const FN = "registrar-solicitud-propietario";
const BUCKET = "documentos";

/** Valor de un campo extraído de un documento (CURP/CSF), o undefined. */
function field(doc: UploadedDoc | undefined, key: string): string | undefined {
  const v = doc?.fields.find((f) => f.key === key)?.value?.trim();
  return v ? v : undefined;
}

export interface SubmitResult {
  caseId: string;
  docsGuardados: number;
  docsErrores: string[];
}

interface UploadSlot {
  tipo: string;
  path: string;
  token: string;
}

/** Extrae el código de error del cuerpo de una FunctionsHttpError, si se puede. */
async function codigoError(error: unknown): Promise<string | undefined> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") return (await ctx.json())?.error;
  } catch {
    /* usa el genérico */
  }
  return undefined;
}

/**
 * Arma el payload desde el estado del onboarding y crea la solicitud.
 * Lanza Error con mensaje legible si falta la unidad o si el backend falla.
 */
export async function submitSolicitudPropietario(
  onb: OnboardingState,
  checks: VerificationCheck[],
): Promise<SubmitResult> {
  const idPropiedad = onb.selectedUnit ? Number(onb.selectedUnit.id) : Number(onb.unitId);
  if (!Number.isFinite(idPropiedad) || idPropiedad <= 0) {
    throw new Error("Selecciona una unidad válida en el Paso 1 antes de enviar.");
  }
  if (!onb.accountEmail) {
    throw new Error("Falta el correo de tu cuenta (Paso 2).");
  }

  const curpDoc = onb.docs.find((d) => d.type === "curp");
  const csfDoc = onb.docs.find((d) => d.type === "csf");
  const persona = {
    nombre: field(curpDoc, "nombre") ?? field(csfDoc, "razon_social"),
    curp: field(curpDoc, "curp"),
    rfc: field(csfDoc, "rfc"),
    fechaNacimiento: field(curpDoc, "fecha_nacimiento"),
    sexo: field(curpDoc, "sexo"),
  };

  // Documentos con archivo disponible en IndexedDB (uno por tipo).
  const docsConBlob: { tipo: string; blob: Blob; contentType: string }[] = [];
  for (const d of onb.docs) {
    const b = await getDocBlob(d.id);
    if (b) docsConBlob.push({ tipo: d.type as string, blob: b.blob, contentType: b.contentType });
  }

  // 1) Pedir URLs firmadas + 2) subir cada PDF a Storage.
  const rutas: { tipo: string; path: string }[] = [];
  if (docsConBlob.length > 0) {
    const { data: urlsData, error: urlsErr } = await supabase.functions.invoke(FN, {
      body: { action: "urls", documentos: docsConBlob.map((d) => ({ tipo: d.tipo })) },
    });
    if (urlsErr) {
      throw new Error(mensajeError(await codigoError(urlsErr)) ?? "No se pudo preparar la subida de documentos.");
    }
    const uploads: UploadSlot[] = (urlsData as { uploads?: UploadSlot[] })?.uploads ?? [];

    for (const slot of uploads) {
      const doc = docsConBlob.find((d) => d.tipo === slot.tipo);
      if (!doc) continue;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(slot.path, slot.token, doc.blob, { contentType: doc.contentType });
      if (upErr) {
        // No abortamos por un doc: el resto sube y el área de SOZU pide el faltante.
         
        console.warn(`[onboarding] subida falló (${slot.tipo}):`, upErr.message);
        continue;
      }
      rutas.push({ tipo: slot.tipo, path: slot.path });
    }
  }

  // 3) Crear la solicitud con las rutas ya subidas.
  const { data, error } = await supabase.functions.invoke(FN, {
    body: {
      action: "crear",
      idPropiedad,
      email: onb.accountEmail,
      telefono: onb.accountPhone ? onb.accountPhone.replace(/\D/g, "") : undefined,
      tipoPersona: onb.personType,
      tipoCompra: onb.purchaseType,
      antiguedadCompra: onb.purchaseRecency,
      persona,
      verificacion: checks.map((c) => ({ key: c.key, status: c.status, label: c.label })),
      consentimiento: onb.privacyAccepted,
      documentos: rutas,
    },
  });

  if (error) {
    throw new Error(mensajeError(await codigoError(error)) ?? "No se pudo enviar tu solicitud. Intenta de nuevo.");
  }

  const caseId = (data as { caseId?: string })?.caseId;
  if (!caseId) throw new Error("El servidor no devolvió un número de caso. Intenta de nuevo.");

  // Envío exitoso: los archivos ya están en Storage; liberar IndexedDB.
  await clearDocBlobs();

  return {
    caseId,
    docsGuardados: (data as { docsGuardados?: number }).docsGuardados ?? 0,
    docsErrores: (data as { docsErrores?: string[] }).docsErrores ?? [],
  };
}

/** Traduce los códigos de error del backend a mensajes para el usuario. */
function mensajeError(code?: string): string | undefined {
  switch (code) {
    case "propiedad_no_encontrada":
      return "La unidad seleccionada no está disponible. Revisa tu selección del Paso 1.";
    case "id_propiedad_requerido":
      return "Falta seleccionar la unidad (Paso 1).";
    case "email_requerido":
      return "Falta el correo de tu cuenta (Paso 2).";
    case "signed_url_failed":
      return "No se pudo preparar la subida de tus documentos. Intenta de nuevo.";
    case "tipo_entidad_propietario_ausente":
      return "Configuración pendiente en el sistema. Avísale a SOZU (falta el tipo de entidad Propietario).";
    default:
      return undefined;
  }
}
