// Validación de campos de contacto (regex acordes a los CHECK de la tabla personas)
// y traducción de errores crudos de la BD a mensajes claros. Extraído de crm.tsx.

// Formatos válidos según los CHECK de la tabla personas (chk_personas_email/telefono_formato).
export const PERSONA_EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const PERSONA_PHONE_RE = /^[0-9 ()+\-]{5,20}$/;
export const MSG_TELEFONO_INVALIDO = "El teléfono no es válido. Usa solo números (opcional + espacios o guiones), de 5 a 20 caracteres. Ej: 3312345678";
export const MSG_EMAIL_INVALIDO = "El correo no es válido. Debe tener el formato nombre@dominio.com";

// Traduce errores crudos de la BD (en inglés) a un mensaje claro en español.
export function mensajeErrorContacto(e: any): string {
  const m = (e?.message ?? "").toLowerCase();
  if (m.includes("telefono_formato")) return MSG_TELEFONO_INVALIDO;
  if (m.includes("email_formato")) return MSG_EMAIL_INVALIDO;
  if (m.includes("curp_formato")) return "El CURP no tiene un formato válido.";
  if (m.includes("rfc_formato")) return "El RFC no tiene un formato válido.";
  if (m.includes("duplicate") || m.includes("unique")) return "Ese contacto ya existe (dato duplicado).";
  return "No se pudo guardar el contacto. Revisa los datos e inténtalo de nuevo.";
}
