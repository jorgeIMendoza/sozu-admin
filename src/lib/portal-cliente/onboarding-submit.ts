// Envío de la solicitud del onboarding de propietarios a la Edge Function
// `registrar-solicitud-propietario` (persistencia real, pre-login con la anon
// key). Sustituye al caseId mock que antes se generaba en localStorage.

import { supabase } from "@/integrations/supabase/client";
import { getDocBytes } from "./onboarding-doc-bytes";
import type { OnboardingState, UploadedDoc, VerificationCheck } from "./onboarding-store";

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

/**
 * Arma el payload desde el estado del onboarding y llama a la Edge Function.
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

  // Documentos confirmados con contenido disponible en memoria.
  const documentos = onb.docs
    .map((d) => {
      const b = getDocBytes(d.id);
      if (!b) return null;
      return {
        tipo: d.type,
        nombreArchivo: b.filename,
        archivoBase64: b.base64,
        contentType: b.contentType,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const { data, error } = await supabase.functions.invoke("registrar-solicitud-propietario", {
    body: {
      idPropiedad,
      email: onb.accountEmail,
      tipoPersona: onb.personType,
      tipoCompra: onb.purchaseType,
      antiguedadCompra: onb.purchaseRecency,
      persona,
      verificacion: checks.map((c) => ({ key: c.key, status: c.status, label: c.label })),
      consentimiento: onb.privacyAccepted,
      documentos,
    },
  });

  if (error) {
    // functions.invoke da un mensaje genérico en no-2xx; intenta leer el cuerpo.
    let code: string | undefined;
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") code = (await ctx.json())?.error;
    } catch {
      /* ignora: usa el mensaje genérico */
    }
    throw new Error(mensajeError(code) ?? "No se pudo enviar tu solicitud. Intenta de nuevo.");
  }

  const caseId = (data as { caseId?: string })?.caseId;
  if (!caseId) throw new Error("El servidor no devolvió un número de caso. Intenta de nuevo.");

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
    case "tipo_entidad_propietario_ausente":
      return "Configuración pendiente en el sistema. Avísale a SOZU (falta el tipo de entidad Propietario).";
    default:
      return undefined;
  }
}
